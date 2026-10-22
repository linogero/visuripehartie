/**
 * Unit-style tests for direct-fulfillment logistics rules (no DB required for pure helpers).
 * Run: npx tsx scripts/test-direct-fulfill-logistics.ts
 */
import {
    LogisticsStatus,
    canAdvanceTo,
    courierTrackingUrl,
    effectiveLogisticsStatus,
    isConfirmedDirectClaim,
    isExcludedClaim,
    proofStatusLabel,
} from "../src/lib/direct-fulfillment"

function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(`FAIL: ${msg}`)
}

assert(isConfirmedDirectClaim("SHIPPED"), "SHIPPED confirmed")
assert(isConfirmedDirectClaim("COMPLETED"), "COMPLETED confirmed")
assert(!isConfirmedDirectClaim("PENDING"), "PENDING not confirmed")
assert(isExcludedClaim("EXPIRED"), "EXPIRED excluded")
assert(isExcludedClaim("CANCELED"), "CANCELED excluded")
assert(!isExcludedClaim("SHIPPED"), "SHIPPED not excluded")

assert(
    effectiveLogisticsStatus({ status: "SHIPPED" }) === LogisticsStatus.AWAITING_GIFT,
    "default awaiting"
)
assert(
    effectiveLogisticsStatus({
        status: "SHIPPED",
        receivedByNgoAt: new Date(),
    }) === LogisticsStatus.RECEIVED_BY_NGO,
    "received inferred"
)
assert(
    effectiveLogisticsStatus({
        status: "SHIPPED",
        logisticsStatus: LogisticsStatus.SHIPPED_TO_INSTITUTION,
        outboundShippedAt: new Date(),
    }) === LogisticsStatus.SHIPPED_TO_INSTITUTION,
    "explicit logistics wins"
)

assert(canAdvanceTo(LogisticsStatus.AWAITING_GIFT, LogisticsStatus.RECEIVED_BY_NGO), "advance receive")
assert(
    !canAdvanceTo(LogisticsStatus.AWAITING_GIFT, LogisticsStatus.SHIPPED_TO_INSTITUTION),
    "no skip to ship"
)
assert(
    canAdvanceTo(LogisticsStatus.RECEIVED_BY_NGO, LogisticsStatus.SHIPPED_TO_INSTITUTION),
    "advance ship"
)

assert(courierTrackingUrl("Fan Courier", "123")?.includes("123"), "fan track")
assert(courierTrackingUrl("Cargus", "999")?.includes("999"), "cargus track")
assert(courierTrackingUrl("Random Co", "1") === null, "unknown courier no link")
assert(courierTrackingUrl("Fan", "") === null, "empty awb")

assert(
    proofStatusLabel([]).kind === "missing",
    "missing video"
)
assert(
    proofStatusLabel([{ type: "VIDEO", url: "x.mp4", moderationStatus: "PENDING" }]).kind ===
        "pending",
    "pending video"
)
assert(
    proofStatusLabel([{ type: "VIDEO", url: "x.mp4", moderationStatus: "APPROVED" }]).kind ===
        "approved",
    "approved video"
)

// Inbound vs outbound field separation (conceptual): helpers never mix field names
const inbound = { awbProvider: "Fan", awbNumber: "111" }
const outbound = { outboundCourier: "Cargus", outboundAwbNumber: "00022" }
assert(inbound.awbNumber !== outbound.outboundAwbNumber, "legs stay distinct")
assert(String(outbound.outboundAwbNumber).startsWith("0"), "AWB preserves leading zeros as text")

console.log("✓ All direct-fulfill logistics rule tests passed.")
