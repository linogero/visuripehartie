import { Prisma } from "@prisma/client"

/** Admin-controlled moderation lifecycle for letters. */
export const LetterModeration = {
    DRAFT: "draft",
    PENDING_REVIEW: "pending_review",
    APPROVED: "approved",
    REJECTED: "rejected",
    FULFILLED: "fulfilled",
    EXTERNALLY_FULFILLED: "externally_fulfilled",
    ARCHIVED: "archived",
} as const

export type LetterModerationStatus =
    (typeof LetterModeration)[keyof typeof LetterModeration]

export const MAX_APPROVED_TARGET_RON = 500
export const MIN_APPROVED_TARGET_RON = 1

export function amountExceedsMaxMessage(limit = MAX_APPROVED_TARGET_RON) {
    return `Suma depășește maximum de ${limit} lei.`
}

/** Legacy values from before the approval workflow rename. */
const LEGACY_MODERATION: Record<string, LetterModerationStatus> = {
    DRAFT: LetterModeration.DRAFT,
    SUBMITTED: LetterModeration.PENDING_REVIEW,
    APPROVED: LetterModeration.APPROVED,
    REJECTED: LetterModeration.REJECTED,
}

export function normalizeModerationStatus(status: string): LetterModerationStatus | string {
    return LEGACY_MODERATION[status] ?? status
}

export function isPendingReview(status: string) {
    const n = normalizeModerationStatus(status)
    return n === LetterModeration.PENDING_REVIEW
}

export function isApprovedPublic(status: string) {
    return normalizeModerationStatus(status) === LetterModeration.APPROVED
}

export function isRejected(status: string) {
    return normalizeModerationStatus(status) === LetterModeration.REJECTED
}

export function isDraft(status: string) {
    return normalizeModerationStatus(status) === LetterModeration.DRAFT
}

export function canPartnerEdit(status: string) {
    const n = normalizeModerationStatus(status)
    return n === LetterModeration.DRAFT || n === LetterModeration.REJECTED
}

/** Letters visible on the public wishlist / public API. */
export const publicWishlistWhere: Prisma.ScrisoareWhereInput = {
    OR: [
        {
            moderationStatus: LetterModeration.APPROVED,
            status: { in: ["ACTIV", "FINANTAT", "IN_ACHIZITIE", "LIVRAT"] },
        },
        {
            moderationStatus: LetterModeration.EXTERNALLY_FULFILLED,
        },
        {
            status: "EXTERN_FULFILLED",
        },
    ],
}

/** Public detail: approved (still fundraising / funded) or fulfilled impact pages use separate queries. */
export const publicDetailWhere: Prisma.ScrisoareWhereInput = {
    moderationStatus: {
        in: [
            LetterModeration.APPROVED,
            LetterModeration.FULFILLED,
            LetterModeration.EXTERNALLY_FULFILLED,
        ],
    },
}

export const MODERATION_LABELS: Record<string, string> = {
    draft: "Ciornă",
    pending_review: "În verificare",
    approved: "Aprobată",
    rejected: "Respinsă",
    fulfilled: "Îndeplinită",
    externally_fulfilled: "Îndeplinită extern",
    archived: "Arhivată",
    // legacy
    DRAFT: "Ciornă",
    SUBMITTED: "În verificare",
    APPROVED: "Aprobată",
    REJECTED: "Respinsă",
}

export function isExternallyFulfilled(letter: {
    moderationStatus?: string | null
    status?: string | null
    externallyFulfilledAt?: Date | string | null
}) {
    return (
        letter.moderationStatus === LetterModeration.EXTERNALLY_FULFILLED ||
        letter.status === "EXTERN_FULFILLED" ||
        Boolean(letter.externallyFulfilledAt)
    )
}

export function publicTargetAmount(letter: {
    approvedTargetAmount?: unknown
    targetAmount: unknown
}): number {
    const approved = letter.approvedTargetAmount != null
        ? Number(letter.approvedTargetAmount)
        : NaN
    if (!Number.isNaN(approved) && approved > 0) return approved
    return Number(letter.targetAmount)
}

export function validateApproval(input: {
    childStory?: string | null
    itemsCount: number
    approvedTargetAmount: number | null | undefined
}): string | null {
    if (!input.childStory?.trim()) {
        return "Scrisoarea trebuie să conțină text înainte de aprobare."
    }
    if (input.itemsCount < 1) {
        return "Este necesar cel puțin un obiect solicitat."
    }
    if (input.approvedTargetAmount == null || Number.isNaN(Number(input.approvedTargetAmount))) {
        return "Completează suma țintă aprobată (approved target) înainte de aprobare."
    }
    const amount = Number(input.approvedTargetAmount)
    if (amount < MIN_APPROVED_TARGET_RON) {
        return `Suma țintă trebuie să fie cel puțin ${MIN_APPROVED_TARGET_RON} RON.`
    }
    if (amount > MAX_APPROVED_TARGET_RON) {
        return amountExceedsMaxMessage()
    }
    return null
}
