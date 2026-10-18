import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { publicTargetAmount } from "@/lib/letter-moderation"

export const GENERAL_FUND_SLUG = "fondul-pentru-alte-dorinte"
export const GENERAL_FUND_NAME = "Fondul pentru alte dorințe"

export const FundTxType = {
    EXTERNAL_FULFILLMENT_TRANSFER: "external_fulfillment_transfer",
    FUND_ALLOCATION_TO_LETTER: "fund_allocation_to_letter",
    LATE_DONATION_TRANSFER: "late_donation_transfer",
} as const

export type FundTxTypeValue = (typeof FundTxType)[keyof typeof FundTxType]

export const FundDirection = {
    IN: "IN",
    OUT: "OUT",
} as const

export const FUND_TX_LABELS: Record<string, string> = {
    external_fulfillment_transfer: "Transfer din dorință îndeplinită extern",
    fund_allocation_to_letter: "Alocat unei alte dorințe",
    late_donation_transfer: "Donație finalizată după îndeplinirea externă",
}

export async function ensureGeneralFund() {
    return prisma.fund.upsert({
        where: { slug: GENERAL_FUND_SLUG },
        update: {},
        create: {
            slug: GENERAL_FUND_SLUG,
            name: GENERAL_FUND_NAME,
            description:
                "Banii redirecționați din dorințe îndeplinite extern, folosiți exclusiv pentru alte nevoi verificate.",
        },
    })
}

export async function getFundBalances(fundId?: string) {
    const fund = fundId
        ? await prisma.fund.findUnique({ where: { id: fundId } })
        : await ensureGeneralFund()
    if (!fund) throw new Error("Fond inexistent.")

    const [inAgg, outAgg, helped] = await Promise.all([
        prisma.fundTransaction.aggregate({
            where: { fundId: fund.id, direction: FundDirection.IN },
            _sum: { amount: true },
            _count: true,
        }),
        prisma.fundTransaction.aggregate({
            where: { fundId: fund.id, direction: FundDirection.OUT },
            _sum: { amount: true },
            _count: true,
        }),
        prisma.fundTransaction.findMany({
            where: {
                fundId: fund.id,
                type: FundTxType.FUND_ALLOCATION_TO_LETTER,
                destinationLetterId: { not: null },
            },
            select: { destinationLetterId: true },
            distinct: ["destinationLetterId"],
        }),
    ])

    const totalIn = Number(inAgg._sum.amount || 0)
    const totalOut = Number(outAgg._sum.amount || 0)
    const available = Math.round((totalIn - totalOut) * 100) / 100

    return {
        fund,
        available: Math.max(0, available),
        totalIn,
        totalOut,
        lettersHelped: helped.length,
        inCount: inAgg._count,
        outCount: outAgg._count,
    }
}

export async function getFundAllocatedToLetter(letterId: string) {
    const agg = await prisma.fundTransaction.aggregate({
        where: {
            destinationLetterId: letterId,
            type: FundTxType.FUND_ALLOCATION_TO_LETTER,
            direction: FundDirection.OUT,
        },
        _sum: { amount: true },
    })
    return Number(agg._sum.amount || 0)
}

export async function getSettledDonatedAmount(letterId: string) {
    const letter = await prisma.scrisoare.findUnique({
        where: { id: letterId },
        select: { collectedAmount: true },
    })
    return Number(letter?.collectedAmount || 0)
}

type TxClient = Prisma.TransactionClient

export async function markExternallyFulfilledInTx(
    tx: TxClient,
    input: {
        letterId: string
        adminId: string
        note?: string | null
        confirmFullyFunded?: boolean
    }
) {
    const letter = await tx.scrisoare.findUnique({
        where: { id: input.letterId },
        include: { institution: { select: { publicName: true, name: true } } },
    })
    if (!letter) throw new Error("Scrisoare inexistentă.")

    const target = publicTargetAmount(letter)
    const collected = Number(letter.collectedAmount)
    const alreadyMarked =
        letter.moderationStatus === "externally_fulfilled" ||
        letter.status === "EXTERN_FULFILLED" ||
        Boolean(letter.externallyFulfilledAt)

    const fund = await tx.fund.upsert({
        where: { slug: GENERAL_FUND_SLUG },
        update: {},
        create: {
            slug: GENERAL_FUND_SLUG,
            name: GENERAL_FUND_NAME,
            description:
                "Banii redirecționați din dorințe îndeplinite extern, folosiți exclusiv pentru alte nevoi verificate.",
        },
    })

    const wishLabel = `Dorința lui ${letter.childFirstName}`
    const publicNote =
        collected > 0
            ? `${formatRon(collected)} transferați din dorința «${wishLabel}». Dorința a fost îndeplinită direct de un donator.`
            : `Dorința «${wishLabel}» a fost îndeplinită extern, fără sumă de transferat.`

    const idempotencyKey = `external_fulfillment:${letter.id}`

    // Repair path: status set earlier but ledger row missing (e.g. schema race).
    if (alreadyMarked) {
        if (collected <= 0) {
            return { letter, transferred: 0, alreadyDone: true as const }
        }
        const existing = await tx.fundTransaction.findUnique({
            where: { idempotencyKey },
        })
        if (existing) {
            return { letter, transferred: 0, alreadyDone: true as const }
        }
        await tx.fundTransaction.create({
            data: {
                fundId: fund.id,
                type: FundTxType.EXTERNAL_FULFILLMENT_TRANSFER,
                direction: FundDirection.IN,
                amount: collected,
                sourceLetterId: letter.id,
                note: input.note?.trim() || "Reparare transfer lipsă",
                publicNote,
                createdById: input.adminId,
                idempotencyKey,
            },
        })
        await tx.actionLog.create({
            data: {
                actorType: "ADMIN",
                actorId: input.adminId,
                actionType: "LETTER_EXTERNALLY_FULFILLED_REPAIR",
                targetType: "SCRISOARE",
                targetId: letter.id,
                metadata: JSON.stringify({ transferred: collected, collected, repaired: true }),
            },
        })
        return { letter, transferred: collected, alreadyDone: false as const }
    }

    if (collected >= target && collected > 0 && !input.confirmFullyFunded) {
        throw new Error(
            "FULLY_FUNDED_WARNING: Dorința este deja complet finanțată. Confirmă explicit dacă vrei totuși îndeplinire externă."
        )
    }

    await tx.scrisoare.update({
        where: { id: letter.id },
        data: {
            moderationStatus: "externally_fulfilled",
            status: "EXTERN_FULFILLED",
            externallyFulfilledAt: new Date(),
            externallyFulfilledById: input.adminId,
            externalFulfillmentNote: input.note?.trim() || null,
        },
    })

    let transferred = 0
    if (collected > 0) {
        const existing = await tx.fundTransaction.findUnique({
            where: { idempotencyKey },
        })
        if (existing) {
            return { letter, transferred: 0, alreadyDone: true as const }
        }
        try {
            await tx.fundTransaction.create({
                data: {
                    fundId: fund.id,
                    type: FundTxType.EXTERNAL_FULFILLMENT_TRANSFER,
                    direction: FundDirection.IN,
                    amount: collected,
                    sourceLetterId: letter.id,
                    note: input.note?.trim() || null,
                    publicNote,
                    createdById: input.adminId,
                    idempotencyKey,
                },
            })
            transferred = collected
        } catch (e) {
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === "P2002"
            ) {
                return { letter, transferred: 0, alreadyDone: true as const }
            }
            throw e
        }
    }

    await tx.actionLog.create({
        data: {
            actorType: "ADMIN",
            actorId: input.adminId,
            actionType: "LETTER_EXTERNALLY_FULFILLED",
            targetType: "SCRISOARE",
            targetId: letter.id,
            metadata: JSON.stringify({
                transferred,
                collected,
                target,
                note: input.note?.trim() || null,
            }),
        },
    })

    return { letter, transferred, alreadyDone: false as const }
}

export async function allocateFundToLetterInTx(
    tx: TxClient,
    input: {
        letterId: string
        amount: number
        adminId: string
        note?: string | null
    }
) {
    const amount = Math.round(Number(input.amount) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Sumă invalidă.")
    }

    const fund = await tx.fund.upsert({
        where: { slug: GENERAL_FUND_SLUG },
        update: {},
        create: {
            slug: GENERAL_FUND_SLUG,
            name: GENERAL_FUND_NAME,
            description:
                "Banii redirecționați din dorințe îndeplinite extern, folosiți exclusiv pentru alte nevoi verificate.",
        },
    })

    const [inAgg, outAgg] = await Promise.all([
        tx.fundTransaction.aggregate({
            where: { fundId: fund.id, direction: FundDirection.IN },
            _sum: { amount: true },
        }),
        tx.fundTransaction.aggregate({
            where: { fundId: fund.id, direction: FundDirection.OUT },
            _sum: { amount: true },
        }),
    ])
    const available =
        Math.round((Number(inAgg._sum.amount || 0) - Number(outAgg._sum.amount || 0)) * 100) / 100
    if (amount > available) {
        throw new Error(`Sold insuficient. Disponibil: ${formatRon(available)}.`)
    }

    const letter = await tx.scrisoare.findUnique({ where: { id: input.letterId } })
    if (!letter) throw new Error("Scrisoare inexistentă.")

    const blockedStatuses = [
        "EXTERN_FULFILLED",
        "INCHIS",
        "LIVRAT",
        "ANULAT",
        "RESPINS",
        "FINALIZAT",
    ]
    const blockedModeration = [
        "externally_fulfilled",
        "archived",
        "rejected",
        "draft",
        "pending_review",
    ]
    if (blockedStatuses.includes(letter.status) || blockedModeration.includes(letter.moderationStatus)) {
        throw new Error("Această dorință nu poate primi alocări din fond.")
    }
    if (letter.moderationStatus !== "approved") {
        throw new Error("Doar dorințele aprobate pot primi alocări din fond.")
    }

    const target = publicTargetAmount(letter)
    const collected = Number(letter.collectedAmount)
    const remaining = Math.max(0, target - collected)
    if (remaining <= 0) {
        throw new Error("Dorința este deja complet finanțată.")
    }
    if (amount > remaining) {
        throw new Error(`Suma depășește necesarul rămas (${formatRon(remaining)}).`)
    }

    const wishLabel = `Dorința lui ${letter.childFirstName}`
    const nextCollected = collected + amount

    await tx.fundTransaction.create({
        data: {
            fundId: fund.id,
            type: FundTxType.FUND_ALLOCATION_TO_LETTER,
            direction: FundDirection.OUT,
            amount,
            destinationLetterId: letter.id,
            note: input.note?.trim() || null,
            publicNote: `${formatRon(amount)} alocați către dorința «${wishLabel}»`,
            createdById: input.adminId,
            idempotencyKey: `allocation:${letter.id}:${Date.now()}:${amount}`,
        },
    })

    await tx.scrisoare.update({
        where: { id: letter.id },
        data: {
            collectedAmount: { increment: amount },
            ...(nextCollected >= target && letter.status === "ACTIV"
                ? { status: "FINANTAT" }
                : {}),
        },
    })

    await tx.actionLog.create({
        data: {
            actorType: "ADMIN",
            actorId: input.adminId,
            actionType: "FUND_ALLOCATED_TO_LETTER",
            targetType: "SCRISOARE",
            targetId: letter.id,
            metadata: JSON.stringify({ amount, note: input.note?.trim() || null }),
        },
    })

    return { amount, remainingAfter: Math.max(0, remaining - amount) }
}

/** If a donation settles after external fulfillment, move it into the fund. */
export async function transferLateDonationToFundInTx(
    tx: TxClient,
    input: { letterId: string; donationId: string; amount: number }
) {
    const amount = Number(input.amount)
    if (!(amount > 0)) return

    const letter = await tx.scrisoare.findUnique({
        where: { id: input.letterId },
        select: {
            id: true,
            childFirstName: true,
            moderationStatus: true,
            status: true,
            externallyFulfilledAt: true,
        },
    })
    if (!letter) return
    if (
        letter.moderationStatus !== "externally_fulfilled" &&
        letter.status !== "EXTERN_FULFILLED" &&
        !letter.externallyFulfilledAt
    ) {
        return
    }

    const fund = await tx.fund.upsert({
        where: { slug: GENERAL_FUND_SLUG },
        update: {},
        create: {
            slug: GENERAL_FUND_SLUG,
            name: GENERAL_FUND_NAME,
            description:
                "Banii redirecționați din dorințe îndeplinite extern, folosiți exclusiv pentru alte nevoi verificate.",
        },
    })

    const wishLabel = `Dorința lui ${letter.childFirstName}`
    try {
        await tx.fundTransaction.create({
            data: {
                fundId: fund.id,
                type: FundTxType.LATE_DONATION_TRANSFER,
                direction: FundDirection.IN,
                amount,
                sourceLetterId: letter.id,
                publicNote: `${formatRon(amount)} dintr-o donație finalizată după îndeplinirea externă a dorinței «${wishLabel}»`,
                idempotencyKey: `late_donation:${input.donationId}`,
            },
        })
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return
        throw e
    }
}

function formatRon(amount: number) {
    return new Intl.NumberFormat("ro-RO", {
        style: "currency",
        currency: "RON",
        maximumFractionDigits: 0,
    }).format(amount)
}
