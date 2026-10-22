/** Logistics statuses for NGO ops after a donor confirms direct fulfillment (AWB inbound). */
export const LogisticsStatus = {
    AWAITING_GIFT: "AWAITING_GIFT",
    RECEIVED_BY_NGO: "RECEIVED_BY_NGO",
    SHIPPED_TO_INSTITUTION: "SHIPPED_TO_INSTITUTION",
    DELIVERED_TO_INSTITUTION: "DELIVERED_TO_INSTITUTION",
    VIDEO_PROOF_UPLOADED: "VIDEO_PROOF_UPLOADED",
} as const

export type LogisticsStatusValue = (typeof LogisticsStatus)[keyof typeof LogisticsStatus]

export const LOGISTICS_STATUS_LABELS: Record<string, string> = {
    AWAITING_GIFT: "În așteptarea cadoului",
    RECEIVED_BY_NGO: "Primit de ONG",
    SHIPPED_TO_INSTITUTION: "Expediat către instituție",
    DELIVERED_TO_INSTITUTION: "Livrat instituției",
    VIDEO_PROOF_UPLOADED: "Dovadă video încărcată",
}

/** Claim statuses that mean confirmed direct fulfillment (donor shipped). */
export const CONFIRMED_CLAIM_STATUSES = ["SHIPPED", "COMPLETED"] as const

/** Claims excluded from the „Îndeplinite direct” operational queue. */
export const EXCLUDED_CLAIM_STATUSES = ["EXPIRED", "CANCELED", "CANCELLED", "REJECTED"] as const

export const LOGISTICS_ORDER: LogisticsStatusValue[] = [
    LogisticsStatus.AWAITING_GIFT,
    LogisticsStatus.RECEIVED_BY_NGO,
    LogisticsStatus.SHIPPED_TO_INSTITUTION,
    LogisticsStatus.DELIVERED_TO_INSTITUTION,
    LogisticsStatus.VIDEO_PROOF_UPLOADED,
]

export function logisticsLabel(status?: string | null) {
    if (!status) return LOGISTICS_STATUS_LABELS.AWAITING_GIFT
    return LOGISTICS_STATUS_LABELS[status] || status
}

export function isConfirmedDirectClaim(status?: string | null) {
    return CONFIRMED_CLAIM_STATUSES.includes(
        (status || "") as (typeof CONFIRMED_CLAIM_STATUSES)[number]
    )
}

export function isExcludedClaim(status?: string | null) {
    return EXCLUDED_CLAIM_STATUSES.includes(
        (status || "").toUpperCase() as (typeof EXCLUDED_CLAIM_STATUSES)[number]
    )
}

/** Normalize logistics for claims that predate the new field. */
export function effectiveLogisticsStatus(claim: {
    status: string
    logisticsStatus?: string | null
    receivedByNgoAt?: Date | string | null
    outboundShippedAt?: Date | string | null
    outboundDeliveredAt?: Date | string | null
}): LogisticsStatusValue {
    if (claim.logisticsStatus && LOGISTICS_ORDER.includes(claim.logisticsStatus as LogisticsStatusValue)) {
        return claim.logisticsStatus as LogisticsStatusValue
    }
    if (claim.outboundDeliveredAt) return LogisticsStatus.DELIVERED_TO_INSTITUTION
    if (claim.outboundShippedAt) return LogisticsStatus.SHIPPED_TO_INSTITUTION
    if (claim.receivedByNgoAt) return LogisticsStatus.RECEIVED_BY_NGO
    if (isConfirmedDirectClaim(claim.status)) return LogisticsStatus.AWAITING_GIFT
    return LogisticsStatus.AWAITING_GIFT
}

export function canAdvanceTo(
    current: LogisticsStatusValue,
    next: LogisticsStatusValue
): boolean {
    const from = LOGISTICS_ORDER.indexOf(current)
    const to = LOGISTICS_ORDER.indexOf(next)
    if (from < 0 || to < 0) return false
    // Allow same step (save details) or one step forward; also allow jump to VIDEO after delivered
    if (to === from) return true
    if (to === from + 1) return true
    if (
        next === LogisticsStatus.VIDEO_PROOF_UPLOADED &&
        (current === LogisticsStatus.DELIVERED_TO_INSTITUTION ||
            current === LogisticsStatus.SHIPPED_TO_INSTITUTION ||
            current === LogisticsStatus.VIDEO_PROOF_UPLOADED)
    ) {
        return true
    }
    return false
}

/**
 * Tracking URL only for known Romanian couriers with stable public trackers.
 * Returns null when we cannot reliably build a link.
 */
export function courierTrackingUrl(
    courier?: string | null,
    awb?: string | null
): string | null {
    const number = (awb || "").trim()
    if (!number) return null
    const name = (courier || "").trim().toLowerCase()
    if (!name) return null

    if (name.includes("fan")) {
        return `https://www.fancourier.ro/awb-tracking/?tracking=${encodeURIComponent(number)}`
    }
    if (name.includes("cargus")) {
        return `https://www.cargus.ro/tracking-cargus/?trackingNumber=${encodeURIComponent(number)}`
    }
    if (name.includes("sameday") || name.includes("same day")) {
        return `https://sameday.ro/#awb=${encodeURIComponent(number)}`
    }
    return null
}

export function proofStatusLabel(proofs: { type: string; url: string; moderationStatus: string }[]) {
    const videos = proofs.filter((p) => {
        const t = (p.type || "").toUpperCase()
        return t === "VIDEO" || t.startsWith("VIDEO/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(p.url)
    })
    if (videos.length === 0) return { label: "Fără video", kind: "missing" as const }
    if (videos.some((v) => v.moderationStatus === "APPROVED")) {
        return { label: "Video aprobat", kind: "approved" as const }
    }
    if (videos.some((v) => v.moderationStatus === "PENDING")) {
        return { label: "Video în moderare", kind: "pending" as const }
    }
    return { label: "Video respins", kind: "rejected" as const }
}
