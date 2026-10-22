import Link from "next/link"
import prisma from "@/lib/prisma"
import {
    CONFIRMED_CLAIM_STATUSES,
    LOGISTICS_STATUS_LABELS,
    LogisticsStatus,
    effectiveLogisticsStatus,
} from "@/lib/direct-fulfillment"
import {
    DirectFulfillmentCard,
    type DirectClaimCardData,
} from "@/components/admin/direct-fulfillment-logistics"
import { cn } from "@/lib/utils"

type Search = {
    q?: string
    logistics?: string
    institution?: string
    courier?: string
    missingAwb?: string
    missingVideo?: string
}

export async function DirectFulfillmentPanel({ search }: { search: Search }) {
    const now = new Date()

    const confirmedClaims = await prisma.fulfillmentClaim.findMany({
        where: {
            status: { in: [...CONFIRMED_CLAIM_STATUSES] },
        },
        include: {
            scrisoare: {
                include: {
                    institution: { select: { id: true, name: true, publicName: true } },
                    proofs: {
                        select: {
                            id: true,
                            url: true,
                            type: true,
                            moderationStatus: true,
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
            },
        },
        orderBy: { updatedAt: "desc" },
    })

    const pendingClaims = await prisma.fulfillmentClaim.findMany({
        where: {
            status: "PENDING",
            expiresAt: { gt: now },
        },
        include: {
            scrisoare: {
                include: {
                    institution: { select: { id: true, name: true, publicName: true } },
                },
            },
        },
        orderBy: { expiresAt: "asc" },
        take: 50,
    })

    const institutions = await prisma.institution.findMany({
        where: {
            scrisori: {
                some: {
                    fulfillmentClaims: {
                        some: { status: { in: [...CONFIRMED_CLAIM_STATUSES] } },
                    },
                },
            },
        },
        select: { id: true, name: true, publicName: true },
        orderBy: { name: "asc" },
    })

    let rows: DirectClaimCardData[] = confirmedClaims.map((claim) => {
        const logistics = effectiveLogisticsStatus(claim)
        const inst = claim.scrisoare.institution
        return {
            claimId: claim.id,
            letterId: claim.scrisoareId,
            publicCode: claim.scrisoare.publicCode,
            slug: claim.scrisoare.slug,
            childFirstName: claim.scrisoare.childFirstName,
            institutionName: inst.publicName || inst.name,
            institutionId: inst.id,
            logisticsStatus: logistics,
            inboundCourier: claim.awbProvider,
            inboundAwb: claim.awbNumber,
            outboundCourier: claim.outboundCourier,
            outboundAwb: claim.outboundAwbNumber,
            outboundShippedAt: claim.outboundShippedAt?.toISOString() || null,
            outboundInternalNote: claim.outboundInternalNote,
            receivedByNgoAt: claim.receivedByNgoAt?.toISOString() || null,
            proofs: claim.scrisoare.proofs,
            proofApproved: claim.scrisoare.proofApproved,
            letterStatus: claim.scrisoare.status,
        }
    })

    const q = (search.q || "").trim().toLowerCase()
    if (q) {
        rows = rows.filter(
            (r) =>
                r.publicCode.toLowerCase().includes(q) ||
                r.childFirstName.toLowerCase().includes(q) ||
                (r.inboundAwb || "").toLowerCase().includes(q) ||
                (r.outboundAwb || "").toLowerCase().includes(q) ||
                (r.inboundCourier || "").toLowerCase().includes(q) ||
                (r.outboundCourier || "").toLowerCase().includes(q)
        )
    }
    if (search.logistics && search.logistics !== "all") {
        rows = rows.filter((r) => r.logisticsStatus === search.logistics)
    }
    if (search.institution && search.institution !== "all") {
        rows = rows.filter((r) => r.institutionId === search.institution)
    }
    if (search.courier && search.courier !== "all") {
        const c = search.courier.toLowerCase()
        rows = rows.filter(
            (r) =>
                (r.inboundCourier || "").toLowerCase().includes(c) ||
                (r.outboundCourier || "").toLowerCase().includes(c)
        )
    }
    if (search.missingAwb === "1") {
        rows = rows.filter((r) => !r.outboundAwb?.trim())
    }
    if (search.missingVideo === "1") {
        rows = rows.filter((r) => {
            const hasVideo = r.proofs.some((p) => {
                const t = (p.type || "").toUpperCase()
                return (
                    (t === "VIDEO" || t.startsWith("VIDEO/") || /\.(mp4|webm|mov)/i.test(p.url)) &&
                    (p.moderationStatus === "PENDING" || p.moderationStatus === "APPROVED")
                )
            })
            return !hasVideo
        })
    }

    const courierOptions = Array.from(
        new Set(
            confirmedClaims
                .flatMap((c) => [c.awbProvider, c.outboundCourier])
                .filter((v): v is string => Boolean(v && v.trim()))
                .map((v) => v.trim())
        )
    ).sort((a, b) => a.localeCompare(b, "ro"))

    const filterHref = (patch: Record<string, string | undefined>) => {
        const params = new URLSearchParams()
        params.set("tab", "direct")
        const merged: Record<string, string | undefined> = {
            q: search.q,
            logistics: search.logistics,
            institution: search.institution,
            courier: search.courier,
            missingAwb: search.missingAwb,
            missingVideo: search.missingVideo,
            ...patch,
        }
        for (const [k, v] of Object.entries(merged)) {
            if (v && v !== "all") params.set(k, v)
        }
        return `/admin/scrisori?${params.toString()}`
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border bg-white p-4 sm:p-5 space-y-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Îndeplinite direct</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Dorințe confirmate de donatori (cu AWB Donator → ONG). Gestionează primirea,
                        expedierea către instituție și dovada video. Statusul financiar și{" "}
                        <em>îndeplinită extern</em> sunt separate.
                    </p>
                </div>

                <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" method="get">
                    <input type="hidden" name="tab" value="direct" />
                    <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                        <label className="text-xs font-medium">Caută (cod / AWB / prenume)</label>
                        <input
                            name="q"
                            defaultValue={search.q || ""}
                            placeholder="ex: S-DA-804 sau AWB"
                            className="w-full min-h-10 rounded-md border px-3 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Status logistică</label>
                        <select
                            name="logistics"
                            defaultValue={search.logistics || "all"}
                            className="w-full min-h-10 rounded-md border px-3 text-sm"
                        >
                            <option value="all">Toate</option>
                            {Object.entries(LOGISTICS_STATUS_LABELS).map(([id, label]) => (
                                <option key={id} value={id}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Instituție</label>
                        <select
                            name="institution"
                            defaultValue={search.institution || "all"}
                            className="w-full min-h-10 rounded-md border px-3 text-sm"
                        >
                            <option value="all">Toate</option>
                            {institutions.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.publicName || i.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Curier</label>
                        <select
                            name="courier"
                            defaultValue={search.courier || "all"}
                            className="w-full min-h-10 rounded-md border px-3 text-sm"
                        >
                            <option value="all">Toți</option>
                            {courierOptions.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm mt-6">
                        <input
                            type="checkbox"
                            name="missingAwb"
                            value="1"
                            defaultChecked={search.missingAwb === "1"}
                        />
                        Fără AWB ieșire
                    </label>
                    <label className="flex items-center gap-2 text-sm mt-6">
                        <input
                            type="checkbox"
                            name="missingVideo"
                            value="1"
                            defaultChecked={search.missingVideo === "1"}
                        />
                        Fără dovadă video
                    </label>
                    <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                        <button
                            type="submit"
                            className="min-h-10 px-4 rounded-md bg-neutral-900 text-white text-sm font-medium"
                        >
                            Filtrează
                        </button>
                        <Link
                            href="/admin/scrisori?tab=direct"
                            className="min-h-10 px-4 rounded-md border text-sm font-medium inline-flex items-center"
                        >
                            Reset
                        </Link>
                    </div>
                </form>

                <div className="flex flex-wrap gap-2 text-xs">
                    {Object.entries(LOGISTICS_STATUS_LABELS).map(([id, label]) => (
                        <Link
                            key={id}
                            href={filterHref({ logistics: id })}
                            className={cn(
                                "px-2.5 py-1 rounded-full border",
                                search.logistics === id
                                    ? "bg-teal-700 text-white border-teal-800"
                                    : "bg-white hover:bg-slate-50"
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                    <Link
                        href={filterHref({ logistics: undefined })}
                        className="px-2.5 py-1 rounded-full border bg-white hover:bg-slate-50"
                    >
                        Toate statusurile
                    </Link>
                </div>
            </div>

            {pendingClaims.length > 0 ? (
                <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                    <div>
                        <h3 className="font-bold text-amber-950">
                            Rezervări în așteptare (neconfirmate)
                        </h3>
                        <p className="text-sm text-amber-900/80">
                            Donatorul a rezervat dorința, dar nu a confirmat încă AWB-ul. Nu sunt
                            îndepliniri confirmate.
                        </p>
                    </div>
                    <ul className="space-y-2">
                        {pendingClaims.map((c) => (
                            <li
                                key={c.id}
                                className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                            >
                                <span>
                                    <strong>{c.scrisoare.childFirstName}</strong>{" "}
                                    <span className="font-mono text-xs text-slate-500">
                                        ({c.scrisoare.publicCode})
                                    </span>
                                    {" · "}
                                    {c.scrisoare.institution.publicName ||
                                        c.scrisoare.institution.name}
                                </span>
                                <span className="text-xs text-amber-800">
                                    Expiră {c.expiresAt.toLocaleString("ro-RO")} ·{" "}
                                    <Link
                                        href={`/admin/scrisori/${c.scrisoareId}`}
                                        className="underline"
                                    >
                                        Deschide
                                    </Link>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <section className="space-y-4">
                <h3 className="font-bold text-slate-900">
                    Confirmate — logistica ONG ({rows.length})
                </h3>
                {rows.length === 0 ? (
                    <p className="text-sm text-slate-500 rounded-xl border bg-white p-6 text-center">
                        Nicio îndeplinire directă confirmată pentru filtrele selectate.
                    </p>
                ) : (
                    rows.map((row) => <DirectFulfillmentCard key={row.claimId} data={row} />)
                )}
            </section>

            {/* Quick ref for empty logistics ladder */}
            <p className="text-xs text-slate-400">
                Pași: {LOGISTICS_STATUS_LABELS[LogisticsStatus.AWAITING_GIFT]} →{" "}
                {LOGISTICS_STATUS_LABELS[LogisticsStatus.RECEIVED_BY_NGO]} →{" "}
                {LOGISTICS_STATUS_LABELS[LogisticsStatus.SHIPPED_TO_INSTITUTION]} →{" "}
                {LOGISTICS_STATUS_LABELS[LogisticsStatus.DELIVERED_TO_INSTITUTION]} →{" "}
                {LOGISTICS_STATUS_LABELS[LogisticsStatus.VIDEO_PROOF_UPLOADED]}. Finalizarea publică
                a scrisorii rămâne după aprobarea dovezii.
            </p>
        </div>
    )
}
