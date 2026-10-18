"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import {
    allocateFundToLetterInTx,
    ensureGeneralFund,
    getFundBalances,
    markExternallyFulfilledInTx,
} from "@/lib/fund"
import { publicTargetAmount } from "@/lib/letter-moderation"

async function requireAdmin() {
    const session = await getSession()
    if (session?.role !== "ADMIN") throw new Error("Unauthorized")
    return session
}

export async function getExternalFulfillmentPreview(letterId: string) {
    await requireAdmin()
    const letter = await prisma.scrisoare.findUnique({
        where: { id: letterId },
        include: { institution: { select: { publicName: true, name: true } } },
    })
    if (!letter) return { ok: false as const, error: "Scrisoare inexistentă." }

    const target = publicTargetAmount(letter)
    const collected = Number(letter.collectedAmount)
    return {
        ok: true as const,
        preview: {
            id: letter.id,
            childFirstName: letter.childFirstName,
            institutionName: letter.institution.publicName || letter.institution.name,
            target,
            collected,
            alreadyExternallyFulfilled:
                letter.moderationStatus === "externally_fulfilled" ||
                letter.status === "EXTERN_FULFILLED" ||
                Boolean(letter.externallyFulfilledAt),
            isFullyFunded: collected >= target && collected > 0,
        },
    }
}

export async function markLetterExternallyFulfilled(formData: FormData) {
    const admin = await requireAdmin()
    const letterId = String(formData.get("letterId") || "")
    const note = String(formData.get("note") || "")
    const confirmFullyFunded = formData.get("confirmFullyFunded") === "1"
    if (!letterId) return { ok: false as const, error: "ID lipsă." }

    try {
        const result = await prisma.$transaction(async (tx) =>
            markExternallyFulfilledInTx(tx, {
                letterId,
                adminId: admin.id,
                note,
                confirmFullyFunded,
            })
        )

        revalidatePath("/admin/scrisori")
        revalidatePath(`/admin/scrisori/${letterId}`)
        revalidatePath("/admin/fond")
        revalidatePath("/fond")
        revalidatePath("/scrisori")
        revalidatePath(`/scrisori/${letterId}`)

        return {
            ok: true as const,
            alreadyDone: result.alreadyDone,
            transferred: result.transferred,
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : "Eroare la îndeplinirea externă."
        if (message.startsWith("FULLY_FUNDED_WARNING:")) {
            return {
                ok: false as const,
                error: message.replace("FULLY_FUNDED_WARNING:", "").trim(),
                needsFullyFundedConfirm: true as const,
            }
        }
        return { ok: false as const, error: message }
    }
}

export async function allocateFromGeneralFund(formData: FormData) {
    const admin = await requireAdmin()
    const letterId = String(formData.get("letterId") || "")
    const amount = Number(formData.get("amount"))
    const note = String(formData.get("note") || "")
    if (!letterId) return { ok: false as const, error: "Selectează o dorință." }

    try {
        const result = await prisma.$transaction(async (tx) =>
            allocateFundToLetterInTx(tx, {
                letterId,
                amount,
                adminId: admin.id,
                note,
            })
        )
        revalidatePath("/admin/fond")
        revalidatePath("/fond")
        revalidatePath("/scrisori")
        revalidatePath(`/scrisori/${letterId}`)
        revalidatePath(`/admin/scrisori/${letterId}`)
        return { ok: true as const, ...result }
    } catch (e) {
        return {
            ok: false as const,
            error: e instanceof Error ? e.message : "Alocarea a eșuat.",
        }
    }
}

export async function getEligibleLettersForFundAllocation() {
    await requireAdmin()
    await ensureGeneralFund()
    const balances = await getFundBalances()
    const letters = await prisma.scrisoare.findMany({
        where: {
            moderationStatus: "approved",
            status: { in: ["ACTIV", "FINANTAT"] },
            NOT: {
                OR: [
                    { status: "EXTERN_FULFILLED" },
                    { moderationStatus: "externally_fulfilled" },
                ],
            },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
            id: true,
            childFirstName: true,
            childAge: true,
            collectedAmount: true,
            approvedTargetAmount: true,
            targetAmount: true,
            status: true,
            publicCode: true,
        },
    })

    return {
        available: balances.available,
        letters: letters
            .map((l) => {
                const target = publicTargetAmount(l)
                const collected = Number(l.collectedAmount)
                const remaining = Math.max(0, target - collected)
                return {
                    id: l.id,
                    label: `${l.childFirstName}, ${l.childAge} ani (${l.publicCode})`,
                    remaining,
                    collected,
                    target,
                }
            })
            .filter((l) => l.remaining > 0),
    }
}
