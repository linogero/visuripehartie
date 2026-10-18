import Link from "next/link"
import prisma from "@/lib/prisma"
import { ensureGeneralFund, FUND_TX_LABELS, getFundBalances } from "@/lib/fund"
import { formatCurrency } from "@/lib/utils"
import { AllocateFundForm } from "@/components/admin/allocate-fund-form"
import { getEligibleLettersForFundAllocation } from "@/app/actions/fund-actions"

export default async function AdminFondPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string }>
}) {
    const sp = await searchParams
    await ensureGeneralFund()
    const balances = await getFundBalances()
    const eligibility = await getEligibleLettersForFundAllocation()

    const typeFilter = sp.type && sp.type !== "all" ? sp.type : undefined
    const transactions = await prisma.fundTransaction.findMany({
        where: {
            fundId: balances.fund.id,
            ...(typeFilter ? { type: typeFilter } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
            sourceLetter: { select: { id: true, slug: true, childFirstName: true, publicCode: true } },
            destinationLetter: {
                select: { id: true, slug: true, childFirstName: true, publicCode: true },
            },
        },
    })

    return (
        <div className="space-y-8 max-w-5xl">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Fondul pentru alte dorințe</h1>
                <p className="text-slate-500 mt-1">
                    Ledger transparent pentru banii redirecționați din dorințe îndeplinite extern.
                </p>
                <Link href="/fond" className="text-sm text-teal-700 hover:underline mt-2 inline-block">
                    Vezi pagina publică →
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Sold disponibil" value={formatCurrency(balances.available)} />
                <Stat label="Total transferat în fond" value={formatCurrency(balances.totalIn)} />
                <Stat label="Total alocat" value={formatCurrency(balances.totalOut)} />
                <Stat label="Dorințe ajutate" value={String(balances.lettersHelped)} />
            </div>

            <AllocateFundForm available={eligibility.available} letters={eligibility.letters} />

            <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">Tranzacții recente</h2>
                    <div className="flex flex-wrap gap-2 text-sm">
                        {[
                            { href: "/admin/fond", label: "Toate" },
                            { href: "/admin/fond?type=external_fulfillment_transfer", label: "Transferuri" },
                            { href: "/admin/fond?type=fund_allocation_to_letter", label: "Alocări" },
                            { href: "/admin/fond?type=late_donation_transfer", label: "Donații târzii" },
                        ].map((f) => (
                            <Link
                                key={f.href}
                                href={f.href}
                                className="px-3 py-1.5 rounded-full border bg-white hover:bg-slate-50"
                            >
                                {f.label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {transactions.length === 0 ? (
                        <p className="text-sm text-slate-500">Nicio tranzacție încă.</p>
                    ) : (
                        transactions.map((tx) => (
                            <article
                                key={tx.id}
                                className="rounded-xl border bg-white p-4 text-sm space-y-1"
                            >
                                <div className="flex flex-wrap justify-between gap-2">
                                    <span className="font-semibold text-slate-900">
                                        {tx.direction === "IN" ? "+" : "−"}
                                        {formatCurrency(Number(tx.amount))}
                                    </span>
                                    <time className="text-slate-500">
                                        {tx.createdAt.toLocaleString("ro-RO")}
                                    </time>
                                </div>
                                <p className="text-slate-600">
                                    {FUND_TX_LABELS[tx.type] || tx.type}
                                </p>
                                {tx.sourceLetter ? (
                                    <p>
                                        Sursă:{" "}
                                        <Link
                                            href={`/admin/scrisori/${tx.sourceLetter.id}`}
                                            className="text-teal-700 hover:underline"
                                        >
                                            {tx.sourceLetter.childFirstName} ({tx.sourceLetter.publicCode})
                                        </Link>
                                    </p>
                                ) : null}
                                {tx.destinationLetter ? (
                                    <p>
                                        Destinație:{" "}
                                        <Link
                                            href={`/admin/scrisori/${tx.destinationLetter.id}`}
                                            className="text-teal-700 hover:underline"
                                        >
                                            {tx.destinationLetter.childFirstName} (
                                            {tx.destinationLetter.publicCode})
                                        </Link>
                                    </p>
                                ) : null}
                                {tx.note ? (
                                    <p className="text-slate-500">Notă internă: {tx.note}</p>
                                ) : null}
                            </article>
                        ))
                    )}
                </div>
            </section>
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
    )
}
