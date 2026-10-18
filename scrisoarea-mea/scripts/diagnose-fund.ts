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
    console.error("Missing TURSO credentials")
    process.exit(1)
}

const c = createClient({ url, authToken: tok })
const id = "ec67c5a0-d964-4d81-b36a-27afdf1affc2"

async function main() {
    const letter = await c.execute({
        sql: `SELECT id, publicCode, childFirstName, status, moderationStatus, collectedAmount,
                     externallyFulfilledAt, externallyFulfilledById, externalFulfillmentNote, updatedAt
              FROM Scrisoare WHERE id=?`,
        args: [id],
    })
    console.log("LETTER David S-DA-804:")
    console.log(JSON.stringify(letter.rows[0], null, 2))

    const dons = await c.execute({
        sql: `SELECT id, amount, status, totalCreditedAmount, createdAt FROM Donation WHERE scrisoareId=?`,
        args: [id],
    })
    console.log("\nDONATIONS:")
    console.log(JSON.stringify(dons.rows, null, 2))

    const logs = await c.execute({
        sql: `SELECT id, actionType, actorId, metadata, createdAt FROM ActionLog WHERE targetId=? ORDER BY createdAt DESC LIMIT 20`,
        args: [id],
    })
    console.log("\nLOGS for letter:")
    console.log(JSON.stringify(logs.rows, null, 2))

    const recent = await c.execute(
        `SELECT id, actionType, targetId, metadata, createdAt FROM ActionLog ORDER BY createdAt DESC LIMIT 40`
    )
    console.log("\nRECENT ACTION LOGS:")
    console.log(JSON.stringify(recent.rows, null, 2))

    const ext = await c.execute(
        `SELECT id, publicCode, childFirstName, status, moderationStatus, collectedAmount, externallyFulfilledAt
         FROM Scrisoare
         WHERE moderationStatus IN ('externally_fulfilled','fulfilled')
            OR status IN ('EXTERN_FULFILLED','INCHIS','LIVRAT','FINALIZAT')
         ORDER BY updatedAt DESC LIMIT 20`
    )
    console.log("\nFULFILLED-ISH LETTERS:")
    console.log(JSON.stringify(ext.rows, null, 2))

    const tables = await c.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%Fund%'`
    )
    console.log("\nFUND TABLES:", JSON.stringify(tables.rows))

    // Check if interactive transaction might be the issue - inspect prisma schema for Decimal
    const fundTxCols = await c.execute(`PRAGMA table_info(FundTransaction)`)
    console.log("\nFundTransaction cols:", JSON.stringify(fundTxCols.rows, null, 2))
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
