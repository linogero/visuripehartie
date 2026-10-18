import { revalidatePath } from "next/cache"
import type Stripe from "stripe"
import prisma from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { absoluteUrl } from "@/lib/seo/site"
import { applyMatchingToDonation } from "@/lib/matching"
import { isExternallyFulfilled, publicTargetAmount } from "@/lib/letter-moderation"
import { transferLateDonationToFundInTx } from "@/lib/fund"
import { getStripe } from "@/lib/stripe"

const HOLD_MS = 30 * 60 * 1000

export function checkoutHoldSince() {
    return new Date(Date.now() - HOLD_MS)
}

type FulfillInput = {
    donationId: string
    stripeSessionId: string
    stripePaymentIntentId?: string | null
    amountTotal: number | null
    currency: string | null
}

export async function fulfillPaidDonation(input: FulfillInput) {
    const donation = await prisma.donation.findUnique({
        where: { id: input.donationId },
        include: { scrisoare: true },
    })
    if (!donation || donation.status === "SUCCEEDED") return donation
    if (donation.status !== "PENDING") return donation

    const expected = Math.round(Number(donation.amount) * 100)
    const currency = (input.currency || "").toLowerCase()
    if (input.amountTotal !== expected || currency !== "ron") {
        console.error("[stripe] amount mismatch", donation.id)
        return donation
    }

    const donorAmount = Number(donation.amount)
    const credited = await prisma.$transaction(async (tx) => {
        const updated = await tx.donation.updateMany({
            where: { id: donation.id, status: "PENDING" },
            data: {
                status: "SUCCEEDED",
                stripeSessionId: input.stripeSessionId,
                stripePaymentIntentId: input.stripePaymentIntentId || undefined,
                totalCreditedAmount: donorAmount,
            },
        })
        if (updated.count !== 1) return false

        if (donation.scrisoare) {
            const target = publicTargetAmount(donation.scrisoare)
            const next = Number(donation.scrisoare.collectedAmount) + donorAmount
            const externallyDone = isExternallyFulfilled(donation.scrisoare)
            await tx.scrisoare.update({
                where: { id: donation.scrisoare.id },
                data: {
                    collectedAmount: { increment: donorAmount },
                    ...(!externallyDone &&
                    donation.scrisoare.status === "ACTIV" &&
                    next >= target
                        ? { status: "FINANTAT" }
                        : {}),
                },
            })
            if (externallyDone) {
                await transferLateDonationToFundInTx(tx, {
                    letterId: donation.scrisoare.id,
                    donationId: donation.id,
                    amount: donorAmount,
                })
            }
        }
        return true
    })

    if (!credited) {
        return prisma.donation.findUnique({
            where: { id: donation.id },
            include: { scrisoare: true },
        })
    }

    try {
        await applyMatchingToDonation(donation.id)
        const after = await prisma.donation.findUnique({ where: { id: donation.id } })
        const matched = Number(after?.matchedAmount || 0)
        if (matched > 0 && donation.scrisoare) {
            await prisma.$transaction(async (tx) => {
                const letter = await tx.scrisoare.findUnique({ where: { id: donation.scrisoare!.id } })
                if (!letter) return
                const target = publicTargetAmount(letter)
                const next = Number(letter.collectedAmount) + matched
                const externallyDone = isExternallyFulfilled(letter)
                await tx.scrisoare.update({
                    where: { id: letter.id },
                    data: {
                        collectedAmount: { increment: matched },
                        ...(!externallyDone &&
                        letter.status === "ACTIV" &&
                        next >= target
                            ? { status: "FINANTAT" }
                            : {}),
                    },
                })
                if (externallyDone) {
                    await transferLateDonationToFundInTx(tx, {
                        letterId: letter.id,
                        donationId: `${donation.id}:match`,
                        amount: matched,
                    })
                }
            })
        }
    } catch (error) {
        console.error("[stripe] matching failed", error)
    }

    const email = donation.donorEmail.trim()
    if (email.includes("@")) {
        try {
            await sendEmail({
                to: email,
                template: "DONATION_CONFIRMATION",
                data: {
                    amount: donorAmount,
                    date: donation.createdAt.toLocaleString("ro-RO", {
                        dateStyle: "long",
                        timeStyle: "short",
                        timeZone: "Europe/Bucharest",
                    }),
                    transactionId: input.stripePaymentIntentId || input.stripeSessionId,
                    childName: donation.scrisoare?.childFirstName || "",
                    donorName: donation.donorName || "",
                    letterUrl: donation.scrisoare?.slug
                        ? absoluteUrl(`/scrisori/${donation.scrisoare.slug}`)
                        : "",
                },
            })
        } catch (error) {
            console.error("[stripe] confirmation email failed", error)
        }
    }

    try {
        if (donation.scrisoare?.slug) {
            revalidatePath(`/scrisori/${donation.scrisoare.slug}`)
        }
        revalidatePath("/scrisori")
        revalidatePath("/")
    } catch (error) {
        console.error("[stripe] revalidate failed", error)
    }

    return prisma.donation.findUnique({
        where: { id: donation.id },
        include: { scrisoare: true },
    })
}

export async function syncCheckoutSession(session: Stripe.Checkout.Session) {
    const donationId = session.metadata?.donationId
    if (!donationId) return null
    const paymentIntentId =
        typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id

    if (session.payment_status === "paid") {
        await fulfillPaidDonation({
            donationId,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            amountTotal: session.amount_total,
            currency: session.currency,
        })
    }

    return prisma.donation.findUnique({
        where: { id: donationId },
        include: { scrisoare: true },
    })
}

export async function abandonCheckout(donationId: string) {
    const donation = await prisma.donation.findUnique({ where: { id: donationId } })
    if (!donation || donation.status !== "PENDING") return donation

    if (donation.stripeSessionId) {
        const session = await getStripe().checkout.sessions.retrieve(donation.stripeSessionId)
        if (session.payment_status === "paid") {
            return syncCheckoutSession(session)
        }
    }

    await prisma.donation.updateMany({
        where: { id: donationId, status: "PENDING" },
        data: { status: "CANCELLED" },
    })
    return prisma.donation.findUnique({
        where: { id: donationId },
        include: { scrisoare: true },
    })
}

export async function failPendingDonation(donationId: string) {
    await prisma.donation.updateMany({
        where: { id: donationId, status: "PENDING" },
        data: { status: "FAILED" },
    })
}
