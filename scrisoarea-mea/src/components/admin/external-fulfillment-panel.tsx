"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import { markLetterExternallyFulfilled } from "@/app/actions/fund-actions"

type Preview = {
    id: string
    childFirstName: string
    institutionName: string
    target: number
    collected: number
    alreadyExternallyFulfilled: boolean
    isFullyFunded: boolean
}

export function ExternalFulfillmentPanel({ preview }: { preview: Preview }) {
    const [open, setOpen] = useState(false)
    const [note, setNote] = useState("")
    const [confirmFullyFunded, setConfirmFullyFunded] = useState(false)
    const [pending, startTransition] = useTransition()

    if (preview.alreadyExternallyFulfilled) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Această dorință este deja marcată ca <strong>îndeplinită extern</strong>.
                {preview.collected > 0 ? (
                    <span> Suma de {formatCurrency(preview.collected)} a fost transferată în Fondul pentru alte dorințe.</span>
                ) : null}
            </div>
        )
    }

    function submit() {
        startTransition(async () => {
            const fd = new FormData()
            fd.set("letterId", preview.id)
            fd.set("note", note)
            if (confirmFullyFunded) fd.set("confirmFullyFunded", "1")
            const result = await markLetterExternallyFulfilled(fd)
            if (!result.ok) {
                if ("needsFullyFundedConfirm" in result && result.needsFullyFundedConfirm) {
                    setConfirmFullyFunded(true)
                    toast.warning(result.error)
                    return
                }
                toast.error(result.error)
                return
            }
            toast.success(
                result.alreadyDone
                    ? "Dorința era deja îndeplinită extern."
                    : result.transferred > 0
                      ? `Îndeplinită extern. ${formatCurrency(result.transferred)} transferați în fond.`
                      : "Dorință marcată ca îndeplinită extern."
            )
            setOpen(false)
            window.location.reload()
        })
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
                <h3 className="font-bold text-slate-900">Îndeplinire externă</h3>
                <p className="text-sm text-slate-500 mt-1">
                    Folosește când cadoul a fost asigurat în afara fluxului de donații al platformei.
                </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={pending}>
                Marchează ca îndeplinită extern
            </Button>

            {open ? (
                <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Închide"
                        className="absolute inset-0 bg-slate-900/40"
                        onClick={() => !pending && setOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <h4 className="text-lg font-bold text-slate-900">Confirmă îndeplinirea externă</h4>
                        <div className="text-sm text-slate-600 space-y-2 rounded-xl bg-slate-50 p-4 border">
                            <p>
                                <strong>Dorință:</strong> {preview.childFirstName}
                            </p>
                            <p>
                                <strong>Instituție:</strong> {preview.institutionName}
                            </p>
                            <p>
                                <strong>Țintă:</strong> {formatCurrency(preview.target)}
                            </p>
                            <p>
                                <strong>Deja donați:</strong> {formatCurrency(preview.collected)}
                            </p>
                            <p>
                                <strong>Transfer în fond:</strong> {formatCurrency(preview.collected)}
                            </p>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">
                            {preview.collected > 0 ? (
                                <>
                                    Această dorință are deja {formatCurrency(preview.collected)} donați.
                                    Dacă o marchezi ca îndeplinită extern,{" "}
                                    {formatCurrency(preview.collected)} vor fi transferați în Fondul
                                    pentru alte dorințe. Această acțiune trebuie să rămână în istoricul
                                    financiar.
                                </>
                            ) : (
                                <>
                                    Nu există donații strânse pentru această dorință. Marchezi dorința ca
                                    îndeplinită extern, fără transfer în fond. Acțiunea rămâne în istoric.
                                </>
                            )}
                        </p>
                        {preview.isFullyFunded ? (
                            <label className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={confirmFullyFunded}
                                    onChange={(e) => setConfirmFullyFunded(e.target.checked)}
                                />
                                <span>
                                    Confirm că înțeleg: dorința este deja complet finanțată și totuși o
                                    marchez ca îndeplinită extern.
                                </span>
                            </label>
                        ) : null}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notă internă / motiv (opțional)</label>
                            <Textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Ex: Cadoul a fost cumpărat direct de compania X."
                                className="min-h-[90px]"
                            />
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                                Anulează
                            </Button>
                            <Button
                                type="button"
                                disabled={pending || (preview.isFullyFunded && !confirmFullyFunded)}
                                onClick={submit}
                                className="bg-amber-700 hover:bg-amber-800 text-white"
                            >
                                {pending ? "Se procesează..." : "Confirmă îndeplinirea externă"}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
