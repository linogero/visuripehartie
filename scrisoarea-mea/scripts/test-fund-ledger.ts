/**
 * Scenario tests for Fondul pentru alte dorințe ledger logic.
 * Run: npx tsx --env-file=.env scripts/test-fund-ledger.ts
 */
import { PrismaClient } from "@prisma/client"
import { PrismaLibSQL } from "@prisma/adapter-libsql"
import {
    allocateFundToLetterInTx,
    ensureGeneralFund,
    getFundBalances,
    markExternallyFulfilledInTx,
} from "../src/lib/fund"

const url = process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db"
const prisma = new PrismaClient({
    adapter: new PrismaLibSQL({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
    }),
})

function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function cleanup(ids: string[]) {
    await prisma.fundTransaction.deleteMany({
        where: {
            OR: [
                { sourceLetterId: { in: ids } },
                { destinationLetterId: { in: ids } },
            ],
        },
    })
    await prisma.donation.deleteMany({ where: { scrisoareId: { in: ids } } })
    await prisma.scrisoare.deleteMany({ where: { id: { in: ids } } })
}

async function ensureInstitution() {
    const existing = await prisma.institution.findFirst()
    if (existing) return existing
    return prisma.institution.create({
        data: {
            name: "Test Institution Fund",
            publicName: "Test Inst",
            slug: `test-fund-inst-${Date.now()}`,
            contactEmail: "fund-test@example.com",
            verified: true,
            county: "Test",
            city: "Test",
        },
    })
}

async function createLetter(opts: {
    id: string
    collected: number
    target: number
    firstName: string
    institutionId: string
}) {
    return prisma.scrisoare.create({
        data: {
            id: opts.id,
            publicCode: `FND-${opts.id.slice(0, 6)}`,
            slug: `fund-test-${opts.id}`,
            childFirstName: opts.firstName,
            childLastName: "Test",
            childAge: 8,
            childStory: "Test story for fund ledger",
            category: "EDUCATIE",
            wishList: "Cadou test",
            originalImgUrl: "https://example.com/test.jpg",
            targetAmount: opts.target,
            approvedTargetAmount: opts.target,
            submittedTargetAmount: opts.target,
            collectedAmount: opts.collected,
            status: "ACTIV",
            moderationStatus: "approved",
            institutionId: opts.institutionId,
        },
    })
}

async function main() {
    const admin =
        (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ||
        (await prisma.user.findFirst())
    if (!admin) throw new Error("No user in DB to act as admin for tests.")

    await ensureGeneralFund()
    const before = await getFundBalances()
    const inst = await ensureInstitution()

    const letterA = `fund-a-${Date.now()}`
    const letterB = `fund-b-${Date.now()}`
    const letterC = `fund-c-${Date.now()}`
    const ids = [letterA, letterB, letterC]

    try {
        await createLetter({
            id: letterA,
            collected: 0,
            target: 500,
            firstName: "Zero",
            institutionId: inst.id,
        })
        await createLetter({
            id: letterB,
            collected: 180,
            target: 500,
            firstName: "Partial",
            institutionId: inst.id,
        })
        await createLetter({
            id: letterC,
            collected: 50,
            target: 400,
            firstName: "Dest",
            institutionId: inst.id,
        })

        // Scenario 1: 0 donated → externally fulfilled, fund unchanged
        const s1 = await prisma.$transaction((tx) =>
            markExternallyFulfilledInTx(tx, {
                letterId: letterA,
                adminId: admin.id,
                note: "Scenario 1",
            })
        )
        assert(s1.transferred === 0, "S1 transferred should be 0")
        assert(!s1.alreadyDone, "S1 should not be alreadyDone")
        const after1 = await getFundBalances()
        assert(
            after1.available === before.available,
            `S1 fund available unchanged (${after1.available} vs ${before.available})`
        )
        console.log("✓ Scenario 1: 0 RON external fulfillment")

        // Scenario 2: 180 donated → transfer 180
        const s2 = await prisma.$transaction((tx) =>
            markExternallyFulfilledInTx(tx, {
                letterId: letterB,
                adminId: admin.id,
                note: "Scenario 2",
            })
        )
        assert(s2.transferred === 180, `S2 transferred=${s2.transferred}`)
        const after2 = await getFundBalances()
        assert(
            Math.abs(after2.available - (before.available + 180)) < 0.01,
            `S2 available=${after2.available}`
        )
        const donationStill = await prisma.scrisoare.findUnique({ where: { id: letterB } })
        assert(
            Number(donationStill?.collectedAmount) === 180,
            "S2 original collectedAmount preserved"
        )
        console.log("✓ Scenario 2: 180 RON transferred to fund")

        // Scenario 5: mark twice → no duplicate
        const s5 = await prisma.$transaction((tx) =>
            markExternallyFulfilledInTx(tx, {
                letterId: letterB,
                adminId: admin.id,
            })
        )
        assert(s5.alreadyDone, "S5 alreadyDone")
        assert(s5.transferred === 0, "S5 no double transfer")
        const after5 = await getFundBalances()
        assert(
            Math.abs(after5.available - after2.available) < 0.01,
            "S5 balance unchanged"
        )
        const txCount = await prisma.fundTransaction.count({
            where: {
                sourceLetterId: letterB,
                type: "external_fulfillment_transfer",
            },
        })
        assert(txCount === 1, `S5 tx count=${txCount}`)
        console.log("✓ Scenario 5: idempotent external fulfillment")

        // Scenario 3: allocate 100 from fund to letter C
        const s3 = await prisma.$transaction((tx) =>
            allocateFundToLetterInTx(tx, {
                letterId: letterC,
                amount: 100,
                adminId: admin.id,
                note: "Scenario 3",
            })
        )
        assert(s3.amount === 100, "S3 amount")
        const after3 = await getFundBalances()
        assert(
            Math.abs(after3.available - (after2.available - 100)) < 0.01,
            `S3 available=${after3.available}`
        )
        const dest = await prisma.scrisoare.findUnique({ where: { id: letterC } })
        assert(Number(dest?.collectedAmount) === 150, "S3 letter collected=150")
        console.log("✓ Scenario 3: allocate 100 RON to another letter")

        // Scenario 4: allocate more than available → reject
        let rejected = false
        try {
            await prisma.$transaction((tx) =>
                allocateFundToLetterInTx(tx, {
                    letterId: letterC,
                    amount: after3.available + 500,
                    adminId: admin.id,
                })
            )
        } catch {
            rejected = true
        }
        assert(rejected, "S4 should reject over-allocation")
        const after4 = await getFundBalances()
        assert(
            Math.abs(after4.available - after3.available) < 0.01,
            "S4 balance unchanged after reject"
        )
        console.log("✓ Scenario 4: over-allocation rejected")

        // Scenario 6: reload balances still correct
        const reload = await getFundBalances()
        assert(
            Math.abs(reload.available - after3.available) < 0.01,
            "S6 reload matches"
        )
        console.log("✓ Scenario 6: balances stable on reload")

        console.log("\nAll fund ledger scenarios passed.")
        console.log(
            `Fund delta for this run: available ${before.available} → ${reload.available} (net +${reload.available - before.available} from leftover after allocation)`
        )
    } finally {
        await cleanup(ids)
        // Restore fund txs from this run were deleted with cleanup of letter ids
        const end = await getFundBalances()
        console.log(`Cleanup done. Fund available now: ${end.available}`)
        await prisma.$disconnect()
    }
}

main().catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
})
