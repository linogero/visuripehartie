import Link from "next/link"
import { pageMetadata } from "@/lib/seo/metadata"
import prisma from "@/lib/prisma"
import {
    ensureGeneralFund,
    FUND_TX_LABELS,
    GENERAL_FUND_NAME,
    getFundBalances,
} from "@/lib/fund"
import { formatCurrency } from "@/lib/utils"

export const metadata = pageMetadata({
    title: "Fondul pentru alte dorințe",
    description:
        "Banii redirecționați din dorințe îndeplinite extern rămân vizibili și sunt folosiți pentru alte nevoi verificate ale copiilor.",
    path: "/fond",
    keywords: ["fond", "transparență", "donații redirecționate"],
})

export default async function FondPage() {
    await ensureGeneralFund()
    const balances = await getFundBalances()
    const transactions = await prisma.fundTransaction.findMany({
        where: { fundId: balances.fund.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
            sourceLetter: {
                select: { id: true, slug: true, childFirstName: true },
            },
            destinationLetter: {
                select: { id: true, slug: true, childFirstName: true },
            },
        },
    })

    return (
        <main className="min-h-screen bg-[var(--pastel-sage)]/20">
            <section className="bg-[var(--pastel-cream)] border-b px-4 py-16 sm:py-20">
                <div className="container mx-auto max-w-3xl space-y-5">
                    <p className="text-sm font-semibold uppercase tracking-wider text-teal-800">
                        Transparență
                    </p>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                        {GENERAL_FUND_NAME}
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                        Uneori, o dorință este îndeplinită direct de un donator, după ce alți oameni
                        au contribuit deja financiar la ea. În astfel de situații, banii strânși nu
                        se pierd. Ei sunt transferați în Fondul pentru alte dorințe și folosiți
                        exclusiv pentru alte nevoi verificate ale copiilor din platformă.
                    </p>
                </div>
            </section>

            <section className="container mx-auto max-w-3xl px-4 py-10 sm:py-14">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard label="Fond disponibil" value={formatCurrency(balances.available)} emphasize />
                    <StatCard label="Transferat în fond" value={formatCurrency(balances.totalIn)} />
                    <StatCard
                        label="Folosit pentru alte dorințe"
                        value={formatCurrency(balances.totalOut)}
                    />
                    <StatCard label="Dorințe ajutate" value={String(balances.lettersHelped)} />
                </div>
            </section>

            <section className="container mx-auto max-w-3xl px-4 pb-20">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Istoric transparent</h2>
                <p className="text-slate-500 mb-8 text-sm sm:text-base">
                    Fiecare mișcare de bani este înregistrată. Nu apar date personale ale donatorilor
                    sau ale copiilor.
                </p>

                <div className="space-y-4">
                    {transactions.length === 0 ? (
                        <p className="text-slate-500 text-sm">
                            Încă nu există transferuri în fond. Când o dorință este îndeplinită
                            extern și există donații anterioare, ele vor apărea aici.
                        </p>
                    ) : (
                        transactions.map((tx) => {
                            const amount = formatCurrency(Number(tx.amount))
                            const sourceHref = tx.sourceLetter
                                ? `/scrisori/${tx.sourceLetter.slug || tx.sourceLetter.id}`
                                : null
                            const destHref = tx.destinationLetter
                                ? `/scrisori/${tx.destinationLetter.slug || tx.destinationLetter.id}`
                                : null

                            return (
                                <article
                                    key={tx.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
                                >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                        <p className="text-xl font-bold text-slate-900">
                                            {tx.direction === "IN" ? "+" : "−"}
                                            {amount}
                                        </p>
                                        <time className="text-xs sm:text-sm text-slate-500">
                                            {tx.createdAt.toLocaleDateString("ro-RO", {
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </time>
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-teal-800">
                                        {FUND_TX_LABELS[tx.type] || tx.type}
                                    </p>
                                    <p className="mt-2 text-sm sm:text-base text-slate-700 leading-relaxed">
                                        {tx.publicNote ||
                                            (tx.direction === "IN"
                                                ? `${amount} transferați în fond`
                                                : `${amount} alocați unei alte dorințe`)}
                                    </p>
                                    <div className="mt-3 flex flex-col gap-1 text-sm text-slate-500">
                                        {tx.sourceLetter && sourceHref ? (
                                            <p>
                                                Sursă:{" "}
                                                <Link
                                                    href={sourceHref}
                                                    className="text-teal-700 font-medium hover:underline"
                                                >
                                                    Dorința lui {tx.sourceLetter.childFirstName}
                                                </Link>
                                            </p>
                                        ) : null}
                                        {tx.destinationLetter && destHref ? (
                                            <p>
                                                Destinație:{" "}
                                                <Link
                                                    href={destHref}
                                                    className="text-teal-700 font-medium hover:underline"
                                                >
                                                    Dorința lui {tx.destinationLetter.childFirstName}
                                                </Link>
                                            </p>
                                        ) : null}
                                    </div>
                                </article>
                            )
                        })
                    )}
                </div>
            </section>
        </main>
    )
}

function StatCard({
    label,
    value,
    emphasize,
}: {
    label: string
    value: string
    emphasize?: boolean
}) {
    return (
        <div
            className={`rounded-2xl border p-5 sm:p-6 ${
                emphasize
                    ? "bg-teal-700 text-white border-teal-800"
                    : "bg-white border-slate-200 text-slate-900"
            }`}
        >
            <p
                className={`text-xs sm:text-sm font-semibold uppercase tracking-wide ${
                    emphasize ? "text-teal-100" : "text-slate-500"
                }`}
            >
                {label}
            </p>
            <p className="text-2xl sm:text-3xl font-black mt-2 tabular-nums">{value}</p>
        </div>
    )
}
