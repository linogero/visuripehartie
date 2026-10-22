"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ProofPreview } from "@/components/admin/proof-preview"
import {
    markDeliveredToInstitution,
    markGiftReceivedByNgo,
    saveOutboundShipment,
    uploadAdminDirectProof,
} from "@/app/actions/direct-fulfillment-actions"
import {
    LogisticsStatus,
    courierTrackingUrl,
    logisticsLabel,
    proofStatusLabel,
} from "@/lib/direct-fulfillment"
import { isVideoProof } from "@/lib/proof-media"

export type DirectClaimCardData = {
    claimId: string
    letterId: string
    publicCode: string
    slug: string | null
    childFirstName: string
    institutionName: string
    institutionId: string
    logisticsStatus: string
    /** Donator → ONG */
    inboundCourier: string | null
    inboundAwb: string | null
    /** ONG → Instituție */
    outboundCourier: string | null
    outboundAwb: string | null
    outboundShippedAt: string | null
    outboundInternalNote: string | null
    receivedByNgoAt: string | null
    proofs: { id: string; url: string; type: string; moderationStatus: string }[]
    proofApproved: boolean
    letterStatus: string
}

export function DirectFulfillmentCard({ data }: { data: DirectClaimCardData }) {
    const [pending, startTransition] = useTransition()
    const [courier, setCourier] = useState(data.outboundCourier || "")
    const [awb, setAwb] = useState(data.outboundAwb || "")
    const [shippedAt, setShippedAt] = useState(
        data.outboundShippedAt
            ? data.outboundShippedAt.slice(0, 10)
            : new Date().toISOString().slice(0, 10)
    )
    const [note, setNote] = useState(data.outboundInternalNote || "")
    const [uploadError, setUploadError] = useState("")
    const [uploading, setUploading] = useState(false)

    const proofInfo = proofStatusLabel(data.proofs)
    const inboundTrack = courierTrackingUrl(data.inboundCourier, data.inboundAwb)
    const outboundTrack = courierTrackingUrl(courier || data.outboundCourier, awb || data.outboundAwb)
    const videos = data.proofs.filter((p) => isVideoProof(p.type, p.url))

    function run(action: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
        startTransition(async () => {
            const result = await action()
            if (!result.ok) {
                toast.error(result.error || "Acțiunea a eșuat.")
                return
            }
            toast.success(successMsg)
            window.location.reload()
        })
    }

    async function onUploadVideo(file: File) {
        setUploadError("")
        setUploading(true)
        try {
            const payload = new FormData()
            payload.set("mediaType", "VIDEO")
            try {
                const { upload } = await import("@vercel/blob/client")
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
                const blob = await upload(`proofs/${crypto.randomUUID()}-${safeName}`, file, {
                    access: "public",
                    handleUploadUrl: "/api/upload",
                })
                payload.set("mediaUrl", blob.url)
            } catch {
                const body = new FormData()
                body.set("file", file)
                const response = await fetch("/api/proofs/upload", { method: "POST", body })
                const json = (await response.json().catch(() => null)) as
                    | { url?: string; error?: string }
                    | null
                if (!response.ok || !json?.url) {
                    throw new Error(json?.error || "Încărcarea a eșuat.")
                }
                payload.set("mediaUrl", json.url)
            }
            const result = await uploadAdminDirectProof(data.letterId, payload)
            if (!result.ok) throw new Error(result.error)
            toast.success("Dovadă video încărcată. Așteaptă moderarea / publicarea.")
            window.location.reload()
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : "Eroare la încărcare.")
        } finally {
            setUploading(false)
        }
    }

    return (
        <article className="rounded-xl border bg-white p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <p className="font-bold text-slate-900 text-base sm:text-lg">
                        {data.childFirstName}{" "}
                        <span className="font-mono text-sm font-normal text-slate-500">
                            ({data.publicCode})
                        </span>
                    </p>
                    <p className="text-sm text-slate-600">{data.institutionName}</p>
                    <p className="inline-flex text-xs font-semibold uppercase tracking-wide text-teal-800 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-1">
                        {logisticsLabel(data.logisticsStatus)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/scrisori/${data.letterId}`}>Detalii scrisoare</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                        <Link href={`/scrisori/${data.slug || data.letterId}`} target="_blank">
                            Pagina publică
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Shipping legs — clearly labelled, never mixed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Donator → ONG
                    </p>
                    <p className="text-sm">
                        Curier:{" "}
                        <span className="font-semibold">{data.inboundCourier || "—"}</span>
                    </p>
                    <p className="text-sm break-all">
                        AWB: <span className="font-mono font-semibold">{data.inboundAwb || "—"}</span>
                    </p>
                    {inboundTrack ? (
                        <a
                            href={inboundTrack}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-teal-700 font-medium hover:underline"
                        >
                            Urmărește coletul →
                        </a>
                    ) : null}
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                        ONG → Instituție
                    </p>
                    <p className="text-sm">
                        Curier:{" "}
                        <span className="font-semibold">
                            {data.outboundCourier || courier || "—"}
                        </span>
                    </p>
                    <p className="text-sm break-all">
                        AWB:{" "}
                        <span className="font-mono font-semibold">
                            {data.outboundAwb || awb || "—"}
                        </span>
                    </p>
                    {outboundTrack ? (
                        <a
                            href={outboundTrack}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-teal-700 font-medium hover:underline"
                        >
                            Urmărește coletul →
                        </a>
                    ) : null}
                </div>
            </div>

            <p className="text-sm text-slate-600">
                Dovadă video:{" "}
                <span className="font-semibold text-slate-900">{proofInfo.label}</span>
                {data.proofApproved ? " · Scrisoare închisă cu dovadă aprobată" : null}
            </p>

            {/* Progress actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {data.logisticsStatus === LogisticsStatus.AWAITING_GIFT ? (
                    <Button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                            const fd = new FormData()
                            fd.set("claimId", data.claimId)
                            run(() => markGiftReceivedByNgo(fd), "Cadou marcat ca primit de ONG.")
                        }}
                    >
                        Marchează: Primit de ONG
                    </Button>
                ) : null}
                {data.logisticsStatus === LogisticsStatus.SHIPPED_TO_INSTITUTION ? (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                            const fd = new FormData()
                            fd.set("claimId", data.claimId)
                            run(() => markDeliveredToInstitution(fd), "Marcat: Livrat instituției.")
                        }}
                    >
                        Marchează: Livrat instituției
                    </Button>
                ) : null}
            </div>

            {/* Outbound form — does not touch inbound AWB */}
            {data.logisticsStatus !== LogisticsStatus.AWAITING_GIFT ? (
                <div className="rounded-lg border p-3 sm:p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-slate-900">
                        Expediere ONG → Instituție
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Curier</label>
                            <Input
                                value={courier}
                                onChange={(e) => setCourier(e.target.value)}
                                placeholder="ex: Fan Courier"
                                disabled={pending}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Număr AWB</label>
                            <Input
                                value={awb}
                                onChange={(e) => setAwb(e.target.value)}
                                placeholder="ex: 0123456789"
                                inputMode="text"
                                disabled={pending}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Data expedierii</label>
                            <Input
                                type="date"
                                value={shippedAt}
                                onChange={(e) => setShippedAt(e.target.value)}
                                disabled={pending}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Notă internă (opțional)</label>
                        <Textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="min-h-[70px]"
                            disabled={pending}
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={pending}
                            onClick={() => {
                                const fd = new FormData()
                                fd.set("claimId", data.claimId)
                                fd.set("outboundCourier", courier)
                                fd.set("outboundAwbNumber", awb)
                                fd.set("outboundShippedAt", shippedAt)
                                fd.set("outboundInternalNote", note)
                                run(() => saveOutboundShipment(fd), "Detalii salvate.")
                            }}
                        >
                            Salvează detalii
                        </Button>
                        {data.logisticsStatus === LogisticsStatus.RECEIVED_BY_NGO ? (
                            <Button
                                type="button"
                                disabled={pending}
                                className="bg-amber-700 hover:bg-amber-800 text-white"
                                onClick={() => {
                                    const fd = new FormData()
                                    fd.set("claimId", data.claimId)
                                    fd.set("outboundCourier", courier)
                                    fd.set("outboundAwbNumber", awb)
                                    fd.set("outboundShippedAt", shippedAt)
                                    fd.set("outboundInternalNote", note)
                                    fd.set("markDispatched", "1")
                                    run(
                                        () => saveOutboundShipment(fd),
                                        "Expediat către instituție."
                                    )
                                }}
                            >
                                Marchează: Expediat către instituție
                            </Button>
                        ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                        Expedierea nu marchează dorința ca livrată sau finalizată. Finalizarea
                        rămâne legată de dovadă.
                    </p>
                </div>
            ) : null}

            {/* Video proof */}
            <div className="rounded-lg border p-3 sm:p-4 space-y-3">
                <h3 className="font-semibold text-sm">Dovadă video</h3>
                {videos.length > 0 ? (
                    <div className="space-y-3">
                        {videos.map((v) => (
                            <ProofPreview key={v.id} url={v.url} type={v.type} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">Niciun video încărcat încă.</p>
                )}
                {!data.proofApproved ? (
                    <div className="space-y-2">
                        <label className="inline-flex">
                            <span className="sr-only">Încarcă dovada video</span>
                            <Input
                                type="file"
                                accept="video/*,.mp4,.webm,.mov,.m4v"
                                disabled={uploading || pending}
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    e.target.value = ""
                                    if (file) void onUploadVideo(file)
                                }}
                            />
                        </label>
                        <p className="text-xs text-slate-500">
                            Acțiune: <strong>Încarcă dovada video</strong>. Video-ul intră în
                            moderare; nu se publică automat.
                        </p>
                        {uploading ? (
                            <p className="text-sm text-slate-500">Se încarcă...</p>
                        ) : null}
                        {uploadError ? (
                            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded p-2">
                                {uploadError}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </article>
    )
}
