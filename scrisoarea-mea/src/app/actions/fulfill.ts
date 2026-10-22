"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth"

const RESERVATION_MS = 72 * 60 * 60 * 1000

// 1. Create a claim to fulfill the wish (Lock it for 72h)
export async function createFulfillmentClaim(scrisoareId: string) {
    const session = await getSession()
    if (!session || (session.role !== "DONOR" && session.role !== "SPONSOR")) {
        throw new Error("Trebuie să te autentifici cu succes pentru a putea pregăti acest cadou.")
    }
    const donorEmail = session.email.trim().toLowerCase()

    // Atomic check: Is it already claimed or fully funded?
    // We capture result here
    const result = await prisma.$transaction(async (tx) => {
        const letter = await tx.scrisoare.findUniqueOrThrow({ where: { id: scrisoareId } })

        // Check active claims
        const activeClaim = await tx.fulfillmentClaim.findFirst({
            where: {
                scrisoareId,
                status: { in: ['PENDING', 'SHIPPED', 'COMPLETED'] },
                // Don't count EXPIRED or CANCELED
                expiresAt: { gt: new Date() } // Should we respect expiration? Yes if pending.
                // Logic: If there is a PENDING claim that is NOT expired, lock it.
                // If there is a SHIPPED/COMPLETED claim, it is permanently locked anyway.
            }
        })

        if (activeClaim) {
            if (['SHIPPED', 'COMPLETED'].includes(activeClaim.status)) {
                throw new Error("Această dorință este deja în curs de îndeplinire.")
            }
            if (activeClaim.status === 'PENDING' && activeClaim.expiresAt > new Date()) {
                throw new Error("Cineva tocmai a preluat această dorință (rezervată temp).")
            }
        }

        if (Number(letter.collectedAmount) >= Number(letter.targetAmount) || ['FINANTAT', 'INCHIS', 'LIVRAT'].includes(letter.status)) {
            throw new Error("Această cerere este deja finanțată.")
        }

        const claim = await tx.fulfillmentClaim.create({
            data: {
                scrisoareId,
                donorEmail,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + RESERVATION_MS)
            }
        })

        return {
            success: true,
            claimId: claim.id,
            expiresAt: claim.expiresAt.toISOString(),
            slug: letter.slug,
        }
    })

    revalidatePath(`/scrisori/${result.slug || scrisoareId}`)
    revalidatePath(`/scrisori/${scrisoareId}`)
    return result
}

// 2. Upload AWB (Confirm shipping)
export async function submitAwb(claimId: string, awbNumber: string, awbProvider: string) {
    const awb = awbNumber.trim()
    const provider = awbProvider.trim()
    if (!awb || !provider) throw new Error("Completează curierul și numărul AWB.")

    const session = await getSession()
    if (!session) throw new Error("Trebuie să fii autentificat.")

    const claim = await prisma.fulfillmentClaim.findUnique({ where: { id: claimId } })
    if (!claim || claim.donorEmail?.toLowerCase() !== session.email.trim().toLowerCase()) {
        throw new Error("Această rezervare nu îți aparține.")
    }

    await prisma.fulfillmentClaim.update({
        where: { id: claimId },
        data: {
            awbNumber: awb,
            awbProvider: provider,
            status: "SHIPPED",
            // NGO logistics starts after inbound ship; do not touch outbound fields
            logisticsStatus: "AWAITING_GIFT",
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
    })

    revalidatePath("/scrisori")
    revalidatePath("/admin/scrisori?tab=direct")
}
