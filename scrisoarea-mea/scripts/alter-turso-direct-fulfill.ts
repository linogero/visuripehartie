/**
 * Idempotent Turso DDL for NGO logistics on FulfillmentClaim.
 * Run: npx tsx scripts/alter-turso-direct-fulfill.ts
 */
import { existsSync, readFileSync } from "fs"
import { createClient } from "@libsql/client"

function loadEnv(p: string) {
    if (!existsSync(p)) return
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith("#")) continue
        const i = t.indexOf("=")
        if (i < 0) continue
        const k = t.slice(0, i).trim()
        let v = t.slice(i + 1).trim()
        if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
        ) {
            v = v.slice(1, -1)
        }
        if (!process.env[k] && v && v !== "[SENSITIVE]") process.env[k] = v
    }
}

loadEnv(".env.local")
loadEnv(".env.old-production-full")
loadEnv(".env")

const url = process.env.TURSO_DATABASE_URL
const tok = process.env.TURSO_AUTH_TOKEN
if (!url || !tok) {
    console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN")
    process.exit(1)
}

const c = createClient({ url, authToken: tok })

async function run(label: string, sql: string) {
    try {
        await c.execute(sql)
        console.log("ok", label)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (/already exists|duplicate column/i.test(msg)) {
            console.log("skip", label)
            return
        }
        console.error("fail", label, msg.slice(0, 200))
        throw e
    }
}

async function main() {
    const cols: [string, string][] = [
        ["logisticsStatus", "TEXT NOT NULL DEFAULT 'AWAITING_GIFT'"],
        ["receivedByNgoAt", "DATETIME"],
        ["receivedByNgoById", "TEXT"],
        ["outboundCourier", "TEXT"],
        ["outboundAwbNumber", "TEXT"],
        ["outboundShippedAt", "DATETIME"],
        ["outboundDeliveredAt", "DATETIME"],
        ["outboundInternalNote", "TEXT"],
        ["logisticsUpdatedAt", "DATETIME"],
        ["logisticsUpdatedById", "TEXT"],
    ]
    for (const [name, def] of cols) {
        await run(`FulfillmentClaim.${name}`, `ALTER TABLE FulfillmentClaim ADD COLUMN ${name} ${def}`)
    }
    await run(
        "idx logisticsStatus",
        `CREATE INDEX IF NOT EXISTS FulfillmentClaim_logisticsStatus_idx ON FulfillmentClaim(logisticsStatus)`
    )
    // Backfill: confirmed inbound shipments await NGO receipt
    try {
        await c.execute(
            `UPDATE FulfillmentClaim
             SET logisticsStatus = 'AWAITING_GIFT'
             WHERE status IN ('SHIPPED','COMPLETED')
               AND (logisticsStatus IS NULL OR logisticsStatus = '')`
        )
        console.log("ok backfill logisticsStatus")
    } catch (e) {
        console.log("skip backfill", e instanceof Error ? e.message.slice(0, 80) : e)
    }
    console.log("Turso direct-fulfill logistics schema ready.")
}

main().catch(() => process.exit(1))
