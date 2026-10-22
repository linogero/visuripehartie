import prisma from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { LetterModeration, MODERATION_LABELS, normalizeModerationStatus } from "@/lib/letter-moderation"
import { parseWishlistItems, sumSubmittedEstimates } from "@/lib/letter-items"
import { cn } from "@/lib/utils"
import { DirectFulfillmentPanel } from "./direct-fulfillment-panel"
import { CONFIRMED_CLAIM_STATUSES } from "@/lib/direct-fulfillment"

const DIRECT_TAB = "direct" as const

const TABS = [
    { id: LetterModeration.PENDING_REVIEW, label: "Pending Review", legacy: ["SUBMITTED"] },
    { id: LetterModeration.APPROVED, label: "Approved", legacy: ["APPROVED"] },
    { id: LetterModeration.REJECTED, label: "Rejected", legacy: ["REJECTED"] },
    { id: LetterModeration.FULFILLED, label: "Fulfilled", legacy: [] as string[] },
    { id: DIRECT_TAB, label: "Îndeplinite direct", legacy: [] as string[] },
    { id: LetterModeration.ARCHIVED, label: "Archived", legacy: [] as string[] },
] as const

export default async function AdminScrisoriPage({
    searchParams,
}: {
    searchParams: Promise<{
        tab?: string
        q?: string
        logistics?: string
        institution?: string
        courier?: string
        missingAwb?: string
        missingVideo?: string
    }>
}) {
    const params = await searchParams
    const activeTab =
        params.tab && TABS.some((t) => t.id === params.tab)
            ? params.tab
            : LetterModeration.PENDING_REVIEW

    const directCount = await prisma.fulfillmentClaim.count({
        where: { status: { in: [...CONFIRMED_CLAIM_STATUSES] } },
    })

    const counts = await Promise.all(
        TABS.filter((t) => t.id !== DIRECT_TAB).map(async (t) => ({
            id: t.id,
            count: await prisma.scrisoare.count({
                where: { moderationStatus: { in: [t.id, ...t.legacy] } },
            }),
        }))
    )
    const countMap: Record<string, number> = Object.fromEntries(
        counts.map((c) => [c.id, c.count])
    )
    countMap[DIRECT_TAB] = directCount

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Scrisori — Moderare</h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Nicio scrisoare nu este publică până la aprobarea administratorului.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b pb-3">
                {TABS.map((t) => (
                    <Link
                        key={t.id}
                        href={`/admin/scrisori?tab=${t.id}`}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                            activeTab === t.id
                                ? "bg-neutral-900 text-white"
                                : "bg-white text-neutral-700 border hover:bg-neutral-50"
                        )}
                    >
                        {t.label}
                        <span className="ml-2 opacity-70">{countMap[t.id] ?? 0}</span>
                    </Link>
                ))}
            </div>

            {activeTab === DIRECT_TAB ? (
                <DirectFulfillmentPanel
                    search={{
                        q: params.q,
                        logistics: params.logistics,
                        institution: params.institution,
                        courier: params.courier,
                        missingAwb: params.missingAwb,
                        missingVideo: params.missingVideo,
                    }}
                />
            ) : (
                <ModerationTable activeTab={activeTab} />
            )}
        </div>
    )
}

async function ModerationTable({ activeTab }: { activeTab: string }) {
    const tab = TABS.find((t) => t.id === activeTab)
    if (!tab || tab.id === DIRECT_TAB) return null
    const statusFilter = [tab.id, ...tab.legacy]

    const letters = await prisma.scrisoare.findMany({
        where: { moderationStatus: { in: statusFilter } },
        include: { institution: true },
        orderBy: { createdAt: "asc" },
    })

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[640px]">
                    <thead className="bg-neutral-50 border-b">
                        <tr>
                            <th className="p-4">Child</th>
                            <th className="p-4">Institution</th>
                            <th className="p-4">Items</th>
                            <th className="p-4">Submitted estimate</th>
                            <th className="p-4">Admin target</th>
                            <th className="p-4">Submitted date</th>
                            <th className="p-4">Acțiuni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {letters.map((l) => {
                            const items = parseWishlistItems(l.items)
                            const submitted =
                                Number(l.submittedTargetAmount) || sumSubmittedEstimates(items)
                            const adminTarget =
                                l.approvedTargetAmount != null
                                    ? Number(l.approvedTargetAmount)
                                    : null
                            const status = normalizeModerationStatus(l.moderationStatus)

                            return (
                                <tr
                                    key={l.id}
                                    className="border-b last:border-0 hover:bg-neutral-50 group"
                                >
                                    <td className="p-4">
                                        <div className="font-medium">
                                            {l.childFirstName}, {l.childAge} ani
                                        </div>
                                        <Badge variant="secondary" className="mt-1 text-[10px]">
                                            {MODERATION_LABELS[status] || status}
                                        </Badge>
                                    </td>
                                    <td className="p-4 font-medium">{l.institution.name}</td>
                                    <td className="p-4 text-neutral-600 max-w-[200px] truncate">
                                        {items.map((i) => i.name).join(", ") || l.wishList}
                                    </td>
                                    <td className="p-4 font-mono">{formatCurrency(submitted)}</td>
                                    <td className="p-4 font-mono">
                                        {adminTarget != null ? (
                                            formatCurrency(adminTarget)
                                        ) : (
                                            <span className="text-amber-600 text-xs font-sans">
                                                Necompletat
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-neutral-500">
                                        {l.createdAt.toLocaleDateString("ro-RO")}
                                    </td>
                                    <td className="p-4">
                                        <Button asChild size="sm">
                                            <Link href={`/admin/scrisori/${l.id}`}>Verifică</Link>
                                        </Button>
                                    </td>
                                </tr>
                            )
                        })}
                        {letters.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-10 text-center text-neutral-500">
                                    Nu există scrisori în această categorie.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
