/**
 * Idempotent Turso DDL for Fondul pentru alte dorințe.
 * Run: npx tsx --env-file=.env.local scripts/alter-turso-fund.ts
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
            console.log("skip", label, "(already present)")
            return
        }
        console.error("fail", label, msg.slice(0, 200))
        throw e
    }
}

async function main() {
    const letterCols = [
        "externallyFulfilledAt DATETIME",
        "externallyFulfilledById TEXT",
        "externalFulfillmentNote TEXT",
    ]
    for (const col of letterCols) {
        const name = col.split(" ")[0]
        await run(`Scrisoare.${name}`, `ALTER TABLE Scrisoare ADD COLUMN ${col}`)
    }

    await run(
        "Fund",
        `CREATE TABLE IF NOT EXISTS Fund (
            id TEXT PRIMARY KEY NOT NULL,
            slug TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME NOT NULL
        )`
    )
    await run("Fund.slug unique", `CREATE UNIQUE INDEX IF NOT EXISTS Fund_slug_key ON Fund(slug)`)

    await run(
        "FundTransaction",
        `CREATE TABLE IF NOT EXISTS FundTransaction (
            id TEXT PRIMARY KEY NOT NULL,
            fundId TEXT NOT NULL,
            type TEXT NOT NULL,
            direction TEXT NOT NULL,
            amount DECIMAL NOT NULL,
            sourceLetterId TEXT,
            destinationLetterId TEXT,
            note TEXT,
            publicNote TEXT,
            createdById TEXT,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            idempotencyKey TEXT,
            FOREIGN KEY (fundId) REFERENCES Fund(id) ON DELETE RESTRICT ON UPDATE CASCADE,
            FOREIGN KEY (sourceLetterId) REFERENCES Scrisoare(id) ON DELETE SET NULL ON UPDATE CASCADE,
            FOREIGN KEY (destinationLetterId) REFERENCES Scrisoare(id) ON DELETE SET NULL ON UPDATE CASCADE
        )`
    )
    await run(
        "FundTransaction.idempotency unique",
        `CREATE UNIQUE INDEX IF NOT EXISTS FundTransaction_idempotencyKey_key ON FundTransaction(idempotencyKey)`
    )
    await run(
        "FundTransaction.fundId idx",
        `CREATE INDEX IF NOT EXISTS FundTransaction_fundId_idx ON FundTransaction(fundId)`
    )
    await run(
        "FundTransaction.type idx",
        `CREATE INDEX IF NOT EXISTS FundTransaction_type_idx ON FundTransaction(type)`
    )
    await run(
        "FundTransaction.direction idx",
        `CREATE INDEX IF NOT EXISTS FundTransaction_direction_idx ON FundTransaction(direction)`
    )
    await run(
        "FundTransaction.sourceLetterId idx",
        `CREATE INDEX IF NOT EXISTS FundTransaction_sourceLetterId_idx ON FundTransaction(sourceLetterId)`
    )
    await run(
        "FundTransaction.destinationLetterId idx",
        `CREATE INDEX IF NOT EXISTS FundTransaction_destinationLetterId_idx ON FundTransaction(destinationLetterId)`
    )
    await run(
        "FundTransaction.createdAt idx",
        `CREATE INDEX IF NOT EXISTS FundTransaction_createdAt_idx ON FundTransaction(createdAt)`
    )

    console.log("Turso fund schema ready.")
}

main().catch(() => process.exit(1))
