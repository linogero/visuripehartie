"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { allocateFromGeneralFund } from "@/app/actions/fund-actions"
import { formatCurrency } from "@/lib/utils"

type LetterOption = {
    id: string
    label: string
    remaining: number
    collected: number
    target: number
}

export function AllocateFundForm({
    available,
    letters,
}: {
    available: number
    letters: LetterOption[]
}) {
    const [letterId, setLetterId] = useState(letters[0]?.id || "")
    const [amount, setAmount] = useState("")
    const [note, setNote] = useState("")
    const [pending, startTransition] = useTransition()

    const selected = useMemo(
        () => letters.find((l) => l.id === letterId) || null,
        [letters, letterId]
    )
    const maxAlloc = selected ? Math.min(available, selected.remaining) : 0

    function submit(e: React.FormEvent) {
        e.preventDefault()
        startTransition(async () => {
            const fd = new FormData()
            fd.set("letterId", letterId)
            fd.set("amount", amount)
            fd.set("note", note)
            const result = await allocateFromGeneralFund(fd)
            if (!result.ok) {
                toast.error(result.error)
                return
            }
            toast.success(`Alocat ${formatCurrency(result.amount)} din fond.`)
            window.location.reload()
        })
    }

    return (
        <section className="rounded-xl border bg-white p-5 space-y-4">
            <div>
                <h2 className="text-lg font-bold">Alocă fonduri</h2>
                <p className="text-sm text-slate-500">
                    Sold disponibil: <strong>{formatCurrency(available)}</strong>
                </p>
            </div>
            {letters.length === 0 ? (
                <p className="text-sm text-slate-500">
                    Nu există dorințe eligibile (aprobate, cu necesar rămas).
                </p>
            ) : (
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Dorință eligibilă</label>
                        <select
                            className="w-full min-h-11 rounded-md border px-3 text-sm"
                            value={letterId}
                            onChange={(e) => setLetterId(e.target.value)}
                        >
                            {letters.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.label} — mai trebuie {formatCurrency(l.remaining)}
                                </option>
                            ))}
                        </select>
                    </div>
                    {selected ? (
                        <p className="text-sm text-slate-600">
                            Strâns: {formatCurrency(selected.collected)} / {formatCurrency(selected.target)}.
                            Maxim alocabil acum: {formatCurrency(maxAlloc)}.
                        </p>
                    ) : null}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Sumă (RON)</label>
                        <Input
                            type="number"
                            min={1}
                            max={maxAlloc}
                            step="1"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Ex: 100"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Notă (opțional)</label>
                        <Textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Motiv alocare..."
                            className="min-h-[80px]"
                        />
                    </div>
                    <Button type="submit" disabled={pending || maxAlloc <= 0}>
                        {pending ? "Se alocă..." : "Confirmă alocarea"}
                    </Button>
                </form>
            )}
        </section>
    )
}
