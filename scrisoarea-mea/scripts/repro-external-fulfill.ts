/**
 * Reproduce markExternallyFulfilled against Turso for letter S-DA-804.
 * Usage: npx tsx scripts/repro-external-fulfill.ts [--apply]
 */
import { existsSync, readFileSync } from "fs"
import { PrismaClient } from "@prisma/client"
import { PrismaLibSQL } from "@prisma/adapter-libsql"
import { markExternallyFulfilledInTx } from "../src/lib/fund"

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

const apply = process.argv.includes("--apply")
const letterId = "ec67c5a0-d964-4d81-b36a-27afdf1affc2"

const prisma = new PrismaClient({
    adapter: new PrismaLibSQL({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    }),
})

async function main() {
    const letter = await prisma.scrisoare.findUnique({ where: { id: letterId } })
    console.log("before", {
        status: letter?.status,
        moderation: letter?.moderationStatus,
        collected: letter?.collectedAmount,
        externallyFulfilledAt: letter?.externallyFulfilledAt,
    })

    const admin =
        (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ||
        (await prisma.user.findFirst())
    if (!admin) throw new Error("No admin user")
    console.log("admin", admin.id, admin.email)

    if (!apply) {
        console.log("Dry run — pass --apply to execute markExternallyFulfilledInTx")
        // Still try a nested transaction in a throwaway way? No — just exit
        await prisma.$disconnect()
        return
    }

    try {
        const result = await prisma.$transaction(async (tx) =>
            markExternallyFulfilledInTx(tx, {
                letterId,
                adminId: admin.id,
                note: "Backfill: fulfill extern după eșec UI — transfer 50 RON în fond",
            })
        )
        console.log("RESULT", result)
    } catch (e) {
        console.error("TRANSACTION FAILED:")
        console.error(e)
        // Try without interactive transaction
        console.log("\nRetrying sequential ops without interactive $transaction...")
        try {
            // Use a dummy approach: call with prisma as tx-like - won't work typing-wise
            // Instead manually step through
            const { ensureGeneralFund, FundTxType, FundDirection } = await import("../src/lib/fund")
            const fund = await ensureGeneralFund()
            const collected = Number(letter!.collectedAmount)
            await prisma.scrisoare.update({
                where: { id: letterId },
                data: {
                    moderationStatus: "externally_fulfilled",
                    status: "EXTERN_FULFILLED",
                    externallyFulfilledAt: new Date(),
                    externallyFulfilledById: admin.id,
                    externalFulfillmentNote:
                        "Backfill: fulfill extern după eșec UI — transfer 50 RON în fond",
                },
            })
            if (collected > 0) {
                await prisma.fundTransaction.create({
                    data: {
                        fundId: fund.id,
                        type: FundTxType.EXTERNAL_FULFILLMENT_TRANSFER,
                        direction: FundDirection.IN,
                        amount: collected,
                        sourceLetterId: letterId,
                        note: "Backfill sequential",
                        publicNote: `${collected} RON transferați din dorința «Dorința lui ${letter!.childFirstName}». Dorința a fost îndeplinită direct de un donator.`,
                        createdById: admin.id,
                        idempotencyKey: `external_fulfillment:${letterId}`,
                    },
                })
            }
            console.log("Sequential backfill OK, collected=", collected)
        } catch (e2) {
            console.error("Sequential also failed:", e2)
        }
    }

    const after = await prisma.scrisoare.findUnique({ where: { id: letterId } })
    const txs = await prisma.fundTransaction.findMany({
        where: { sourceLetterId: letterId },
    })
    console.log("after letter", {
        status: after?.status,
        moderation: after?.moderationStatus,
        collected: after?.collectedAmount,
        externallyFulfilledAt: after?.externallyFulfilledAt,
    })
    console.log("fund txs", txs)

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
})
