"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { logAction } from "@/lib/audit"
import {
    CONFIRMED_CLAIM_STATUSES,
    LogisticsStatus,
    canAdvanceTo,
    effectiveLogisticsStatus,
    isConfirmedDirectClaim,
    isExcludedClaim,
    type LogisticsStatusValue,
} from "@/lib/direct-fulfillment"
import { isVideoProof, MAX_PROOF_IMAGES, MAX_PROOF_VIDEOS, proofMediaType } from "@/lib/proof-media"
import { saveFile } from "@/lib/storage"

async function requireAdmin() {
    const session = await getSession()
    if (!session || session.role !== "ADMIN") return null
    return session
}

function revalidateClaimPaths(letterId: string, slug?: string | null) {
    revalidatePath("/admin/scrisori")
    revalidatePath(`/admin/scrisori?tab=direct`)
    revalidatePath(`/admin/scrisori/${letterId}`)
    revalidatePath("/admin/proofs")
    revalidatePath(`/scrisori/${letterId}`)
    if (slug) revalidatePath(`/scrisori/${slug}`)
}

async function loadConfirmedClaim(claimId: string) {
    const claim = await prisma.fulfillmentClaim.findUnique({
        where: { id: claimId },
        include: { scrisoare: { select: { id: true, slug: true, publicCode: true, childFirstName: true } } },
    })
    if (!claim) throw new Error("Rezervarea nu există.")
    if (isExcludedClaim(claim.status)) throw new Error("Această rezervare este anulată sau expirată.")
    if (!isConfirmedDirectClaim(claim.status)) {
        throw new Error("Doar îndeplinirile confirmate (cu AWB donator) pot fi gestionate aici.")
    }
    return claim
}

export async function markGiftReceivedByNgo(formData: FormData) {
    const admin = await requireAdmin()
    if (!admin) return { ok: false as const, error: "Neautorizat." }
    const claimId = String(formData.get("claimId") || "")
    if (!claimId) return { ok: false as const, error: "ID lipsă." }

    try {
        const claim = await loadConfirmedClaim(claimId)
        const current = effectiveLogisticsStatus(claim)
        if (!canAdvanceTo(current, LogisticsStatus.RECEIVED_BY_NGO) && current !== LogisticsStatus.RECEIVED_BY_NGO) {
            if (
                current === LogisticsStatus.SHIPPED_TO_INSTITUTION ||
                current === LogisticsStatus.DELIVERED_TO_INSTITUTION ||
                current === LogisticsStatus.VIDEO_PROOF_UPLOADED
            ) {
                return { ok: false as const, error: "Cadoul a fost deja procesat mai departe în flux." }
            }
        }

        await prisma.fulfillmentClaim.update({
            where: { id: claimId },
            data: {
                logisticsStatus: LogisticsStatus.RECEIVED_BY_NGO,
                receivedByNgoAt: claim.receivedByNgoAt || new Date(),
                receivedByNgoById: claim.receivedByNgoById || admin.id,
                logisticsUpdatedAt: new Date(),
                logisticsUpdatedById: admin.id,
            },
        })

        await logAction({
            actorType: "ADMIN",
            actorId: admin.id,
            actionType: "DIRECT_FULFILL_RECEIVED_BY_NGO",
            targetType: "SCRISOARE",
            targetId: claim.scrisoareId,
            metadata: { claimId },
        })

        revalidateClaimPaths(claim.scrisoareId, claim.scrisoare.slug)
        return { ok: true as const }
    } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "Eroare." }
    }
}

export async function saveOutboundShipment(formData: FormData) {
    const admin = await requireAdmin()
    if (!admin) return { ok: false as const, error: "Neautorizat." }
    const claimId = String(formData.get("claimId") || "")
    const courier = String(formData.get("outboundCourier") || "").trim()
    const awb = String(formData.get("outboundAwbNumber") || "").trim()
    const shippedAtRaw = String(formData.get("outboundShippedAt") || "").trim()
    const note = String(formData.get("outboundInternalNote") || "").trim()
    const markDispatched = formData.get("markDispatched") === "1"

    if (!claimId) return { ok: false as const, error: "ID lipsă." }

    try {
        const claim = await loadConfirmedClaim(claimId)
        const current = effectiveLogisticsStatus(claim)

        if (markDispatched) {
            if (!courier) return { ok: false as const, error: "Completează curierul pentru expediere." }
            if (!awb) return { ok: false as const, error: "Completează numărul AWB pentru expediere." }
            if (
                current !== LogisticsStatus.RECEIVED_BY_NGO &&
                current !== LogisticsStatus.SHIPPED_TO_INSTITUTION &&
                current !== LogisticsStatus.AWAITING_GIFT
            ) {
                // Allow dispatch from RECEIVED or re-save SHIPPED; also allow if they received+ship in one go after AWAITING if gift already marked received first preferred
                if (current === LogisticsStatus.DELIVERED_TO_INSTITUTION || current === LogisticsStatus.VIDEO_PROOF_UPLOADED) {
                    return { ok: false as const, error: "Cadoul este deja livrat sau are dovadă — nu poți re-expedia." }
                }
            }
            // Must be at least received before dispatch
            if (current === LogisticsStatus.AWAITING_GIFT) {
                return {
                    ok: false as const,
                    error: "Marchează mai întâi „Primit de ONG”, apoi expediază către instituție.",
                }
            }
        }

        const shippedAt = shippedAtRaw ? new Date(shippedAtRaw) : markDispatched ? new Date() : claim.outboundShippedAt
        if (markDispatched && shippedAt && Number.isNaN(shippedAt.getTime())) {
            return { ok: false as const, error: "Data expedierii este invalidă." }
        }

        const nextStatus: LogisticsStatusValue = markDispatched
            ? LogisticsStatus.SHIPPED_TO_INSTITUTION
            : current === LogisticsStatus.AWAITING_GIFT
              ? LogisticsStatus.AWAITING_GIFT
              : current

        // Never touch inbound awbProvider / awbNumber
        await prisma.fulfillmentClaim.update({
            where: { id: claimId },
            data: {
                outboundCourier: courier || claim.outboundCourier,
                outboundAwbNumber: awb || claim.outboundAwbNumber,
                outboundInternalNote: note || null,
                ...(markDispatched
                    ? {
                          outboundShippedAt: shippedAt,
                          logisticsStatus: LogisticsStatus.SHIPPED_TO_INSTITUTION,
                      }
                    : {
                          logisticsStatus: nextStatus,
                          ...(shippedAtRaw && shippedAt && !Number.isNaN(shippedAt.getTime())
                              ? { outboundShippedAt: shippedAt }
                              : {}),
                      }),
                logisticsUpdatedAt: new Date(),
                logisticsUpdatedById: admin.id,
            },
        })

        await logAction({
            actorType: "ADMIN",
            actorId: admin.id,
            actionType: markDispatched
                ? "DIRECT_FULFILL_SHIPPED_TO_INSTITUTION"
                : "DIRECT_FULFILL_OUTBOUND_SAVED",
            targetType: "SCRISOARE",
            targetId: claim.scrisoareId,
            metadata: {
                claimId,
                outboundCourier: courier || claim.outboundCourier,
                outboundAwbNumber: awb || claim.outboundAwbNumber,
                markDispatched,
            },
        })

        revalidateClaimPaths(claim.scrisoareId, claim.scrisoare.slug)
        return { ok: true as const }
    } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "Eroare." }
    }
}

export async function markDeliveredToInstitution(formData: FormData) {
    const admin = await requireAdmin()
    if (!admin) return { ok: false as const, error: "Neautorizat." }
    const claimId = String(formData.get("claimId") || "")
    if (!claimId) return { ok: false as const, error: "ID lipsă." }

    try {
        const claim = await loadConfirmedClaim(claimId)
        const current = effectiveLogisticsStatus(claim)
        if (
            current !== LogisticsStatus.SHIPPED_TO_INSTITUTION &&
            current !== LogisticsStatus.DELIVERED_TO_INSTITUTION
        ) {
            return {
                ok: false as const,
                error: "Marchează mai întâi expedierea către instituție (cu curier și AWB).",
            }
        }
        if (!claim.outboundCourier?.trim() || !claim.outboundAwbNumber?.trim()) {
            return { ok: false as const, error: "Lipsește AWB-ul de ieșire (ONG → Instituție)." }
        }

        await prisma.fulfillmentClaim.update({
            where: { id: claimId },
            data: {
                logisticsStatus: LogisticsStatus.DELIVERED_TO_INSTITUTION,
                outboundDeliveredAt: claim.outboundDeliveredAt || new Date(),
                status: claim.status === "SHIPPED" ? "COMPLETED" : claim.status,
                logisticsUpdatedAt: new Date(),
                logisticsUpdatedById: admin.id,
            },
        })

        await logAction({
            actorType: "ADMIN",
            actorId: admin.id,
            actionType: "DIRECT_FULFILL_DELIVERED_TO_INSTITUTION",
            targetType: "SCRISOARE",
            targetId: claim.scrisoareId,
            metadata: { claimId },
        })

        revalidateClaimPaths(claim.scrisoareId, claim.scrisoare.slug)
        return { ok: true as const }
    } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "Eroare." }
    }
}

const IMAGE_LIMIT = 4.5 * 1024 * 1024

function storedProofUrl(value: string) {
    if (value.startsWith("/uploads/")) return true
    try {
        const url = new URL(value)
        return url.protocol === "https:" || url.protocol === "http:"
    } catch {
        return false
    }
}

/** Admin uploads video/photo proof for a direct-fulfillment letter (reuses ProofMedia). */
export async function uploadAdminDirectProof(scrisoareId: string, formData: FormData) {
    const admin = await requireAdmin()
    if (!admin) return { ok: false as const, error: "Neautorizat." }

    try {
        const letter = await prisma.scrisoare.findUnique({
            where: { id: scrisoareId },
            select: { id: true, slug: true, proofApproved: true },
        })
        if (!letter) return { ok: false as const, error: "Scrisoare inexistentă." }
        if (letter.proofApproved) {
            return { ok: false as const, error: "Dovada a fost deja aprobată pentru această scrisoare." }
        }

        const confirmed = await prisma.fulfillmentClaim.findFirst({
            where: {
                scrisoareId,
                status: { in: [...CONFIRMED_CLAIM_STATUSES] },
            },
        })
        if (!confirmed) {
            return {
                ok: false as const,
                error: "Nu există o îndeplinire directă confirmată pentru această scrisoare.",
            }
        }

        const providedUrl = String(formData.get("mediaUrl") || "").trim()
        const providedType = String(formData.get("mediaType") || "").trim()
        const file = formData.get("proofFile")

        let url = ""
        let type: "VIDEO" | "PHOTO" = "PHOTO"

        if (providedUrl && storedProofUrl(providedUrl)) {
            url = providedUrl
            type = isVideoProof(providedType, providedUrl) ? "VIDEO" : "PHOTO"
        } else if (file instanceof File && file.size > 0) {
            const isVideo = proofMediaType(file) === "VIDEO"
            const isImage =
                file.type.startsWith("image/") ||
                (!isVideo && /\.(jpe?g|png|gif|webp|avif)$/i.test(file.name))
            if (!isVideo && !isImage) throw new Error("Sunt acceptate doar poze sau video.")
            if (!isVideo && file.size > IMAGE_LIMIT) {
                throw new Error("Fișierul este prea mare. Încearcă o poză sub 4.5MB.")
            }
            type = isVideo ? "VIDEO" : "PHOTO"
            url = await saveFile(file)
        } else {
            throw new Error("Încarcă o poză sau un video.")
        }

        if (!url || url.includes("placehold.co") || url.includes("text=Error") || url.includes("No+Storage")) {
            throw new Error("Dovada nu a putut fi salvată. Încearcă din nou.")
        }

        const active = await prisma.proofMedia.findMany({
            where: { scrisoareId, moderationStatus: { in: ["PENDING", "APPROVED"] } },
            select: { type: true, url: true },
        })
        const activeVideos = active.filter((p) => isVideoProof(p.type, p.url)).length
        const activeImages = active.length - activeVideos
        if (type === "VIDEO" && activeVideos >= MAX_PROOF_VIDEOS) {
            throw new Error("Poți încărca un singur videoclip.")
        }
        if (type === "PHOTO" && activeImages >= MAX_PROOF_IMAGES) {
            throw new Error("Poți încărca maximum 3 imagini.")
        }

        await prisma.proofMedia.create({
            data: {
                scrisoareId,
                url,
                type,
                moderationStatus: "PENDING",
            },
        })

        if (type === "VIDEO") {
            const logistics = effectiveLogisticsStatus(confirmed)
            if (
                logistics === LogisticsStatus.DELIVERED_TO_INSTITUTION ||
                logistics === LogisticsStatus.SHIPPED_TO_INSTITUTION ||
                logistics === LogisticsStatus.VIDEO_PROOF_UPLOADED
            ) {
                await prisma.fulfillmentClaim.update({
                    where: { id: confirmed.id },
                    data: {
                        logisticsStatus: LogisticsStatus.VIDEO_PROOF_UPLOADED,
                        logisticsUpdatedAt: new Date(),
                        logisticsUpdatedById: admin.id,
                    },
                })
            }
        }

        await logAction({
            actorType: "ADMIN",
            actorId: admin.id,
            actionType: "DIRECT_FULFILL_PROOF_UPLOADED",
            targetType: "PROOF",
            targetId: scrisoareId,
            metadata: { claimId: confirmed.id, type },
        })

        revalidateClaimPaths(scrisoareId, letter.slug)
        return { ok: true as const, type }
    } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "Eroare la încărcare." }
    }
}
