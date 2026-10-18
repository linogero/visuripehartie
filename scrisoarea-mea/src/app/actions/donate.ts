"use server"

import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { canDonate } from "@/lib/permissions"
import { amountExceedsMaxMessage, isApprovedPublic, MAX_APPROVED_TARGET_RON, publicTargetAmount } from "@/lib/letter-moderation"
import { SITE_URL } from "@/lib/seo/site"
import { getStripe, isStripeConfigured } from "@/lib/stripe"
import { checkoutHoldSince, failPendingDonation } from "@/lib/donations"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type StartResult = { success: true; url: string } | { success: false; error: string }

function fail(error: string): StartResult {
    return { success: false, error }
}

function cleanName(value: string) {
    return value.trim().replace(/\s+/g, " ").slice(0, 60)
}

export async function startStripeDonation(formData: FormData): Promise<StartResult> {
    if (!isStripeConfigured()) {
        return fail("Plățile cu cardul nu sunt disponibile momentan.")
    }

    const rawAmount = Number(formData.get("amount"))
    const scrisoareId = String(formData.get("scrisoareId") || "")
    const isAnonymous = formData.get("isAnonymous") === "1"
    const email = String(formData.get("email") || "").trim().toLowerCase()
    const firstName = cleanName(String(formData.get("firstName") || ""))
    const lastName = cleanName(String(formData.get("lastName") || ""))

    if (!scrisoareId) return fail("Scrisoare lipsă.")
    if (!Number.isFinite(rawAmount)) return fail("Suma invalidă.")
    const amount = Math.round(rawAmount * 100) / 100
    if (amount < 5) return fail("Minim 5 RON.")
    if (amount > MAX_APPROVED_TARGET_RON) return fail(amountExceedsMaxMessage())

    if (!isAnonymous) {
        if (firstName.length < 2 || lastName.length < 2) {
            return fail("Completează prenumele și numele pentru chitanță, sau donează anonim.")
        }
        if (!EMAIL_RE.test(email)) return fail("Email invalid.")
    } else if (email && !EMAIL_RE.test(email)) {
        return fail("Email invalid.")
    }

    const session = await getSession()
    const letter = await prisma.scrisoare.findUnique({
        where: { id: scrisoareId },
        include: {
            reservations: { where: { status: "PENDING", expiresAt: { gt: new Date() } } },
        },
    })
    if (!letter) return fail("Scrisoare inexistentă.")
    if (!isApprovedPublic(letter.moderationStatus)) {
        return fail("Această scrisoare nu acceptă donații.")
    }
    if (!canDonate(session, letter)) {
        return fail("Nu poți dona pentru această scrisoare.")
    }
    if (
        ["FINANTAT", "INCHIS", "LIVRAT", "IN_ACHIZITIE", "EXTERN_FULFILLED"].includes(letter.status) ||
        letter.moderationStatus === "externally_fulfilled"
    ) {
        return fail("Această scrisoare este deja finanțată, închisă sau îndeplinită extern.")
    }

    const reserved = letter.reservations.reduce((acc, reservation) => acc + Number(reservation.amount), 0)
    const held = await prisma.donation.aggregate({
        where: {
            scrisoareId,
            status: "PENDING",
            createdAt: { gt: checkoutHoldSince() },
        },
        _sum: { amount: true },
    })
    const target = publicTargetAmount(letter)
    const remaining = Math.max(
        0,
        target - Number(letter.collectedAmount) - reserved - Number(held._sum.amount || 0)
    )
    if (remaining <= 0) return fail("Ținta a fost atinsă. Donațiile sunt închise.")
    if (amount > remaining) return fail(`Suma maximă rămasă este ${remaining} RON.`)

    const donation = await prisma.donation.create({
        data: {
            amount,
            currency: "RON",
            donorEmail: email,
            donorName: isAnonymous ? "Anonim" : `${firstName} ${lastName}`,
            isAnonymous,
            status: "PENDING",
            scrisoareId,
            payerUserId: session?.id,
            payerRole: session?.role,
        },
    })

    try {
        const stripe = getStripe()
        const checkout = await stripe.checkout.sessions.create(
            {
                mode: "payment",
                locale: "ro",
                submit_type: "donate",
                integration_identifier: "visuri_hosted_donations",
                client_reference_id: donation.id,
                billing_address_collection: "auto",
                phone_number_collection: { enabled: false },
                customer_creation: "if_required",
                ...(email ? { customer_email: email } : {}),
                expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
                line_items: [
                    {
                        quantity: 1,
                        price_data: {
                            currency: "ron",
                            unit_amount: Math.round(amount * 100),
                            product_data: {
                                name: `Donație pentru ${letter.childFirstName}`,
                                description: "Scrisoare verificată · Visuri pe hârtie",
                            },
                        },
                    },
                ],
                metadata: {
                    donationId: donation.id,
                    scrisoareId,
                    anonymous: isAnonymous ? "1" : "0",
                },
                payment_intent_data: {
                    description: `Donație Visuri pe hârtie pentru ${letter.childFirstName}`,
                    metadata: {
                        donationId: donation.id,
                        anonymous: isAnonymous ? "1" : "0",
                    },
                },
                custom_text: {
                    submit: {
                        message: isAnonymous
                            ? "Donație anonimă. Numele tău nu este publicat pe Visuri pe hârtie."
                            : "Donație pentru o scrisoare verificată. Visuri pe hârtie.",
                    },
                },
                success_url: `${SITE_URL}/donatie/confirmare?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${SITE_URL}/donatie/cancel?donationId=${donation.id}`,
            },
            { idempotencyKey: `donation-${donation.id}` }
        )

        if (!checkout.url) {
            await failPendingDonation(donation.id)
            return fail("Plata nu a putut fi inițiată. Încearcă din nou.")
        }

        await prisma.donation.update({
            where: { id: donation.id },
            data: { stripeSessionId: checkout.id },
        })

        return { success: true, url: checkout.url }
    } catch (error) {
        console.error("[stripe] checkout create failed", error)
        await failPendingDonation(donation.id)
        return fail("Plata nu a putut fi inițiată. Încearcă din nou.")
    }
}
