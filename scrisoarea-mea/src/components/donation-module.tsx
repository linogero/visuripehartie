"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import { startStripeDonation } from "@/app/actions/donate"
import { amountExceedsMaxMessage, MAX_APPROVED_TARGET_RON } from "@/lib/letter-moderation"

export default function DonationModule({
    scrisoareId,
    remainingAmount,
    isFullyFunded,
    userEmail,
    userRole
}: {
    scrisoareId: string,
    remainingAmount: number,
    isFullyFunded: boolean,
    userEmail?: string | null,
    userRole?: string | null
}) {
    const [customAmount, setCustomAmount] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [isAnonymous, setIsAnonymous] = useState(false)
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState(userEmail || "")

    const payableMax = Math.min(remainingAmount, MAX_APPROVED_TARGET_RON)
    const presets = [50, 100, 200].filter((preset) => preset <= payableMax)

    const handleDonate = async () => {
        setLoading(true)
        setError("")
        try {
            const amount = Number(customAmount)
            if (!amount || amount < 5) throw new Error("Minim 5 RON")
            if (amount > MAX_APPROVED_TARGET_RON) {
                toast.warning(amountExceedsMaxMessage(), { id: "amount-limit" })
                setLoading(false)
                return
            }
            if (amount > remainingAmount) throw new Error("Suma depășește necesarul.")
            if (!isAnonymous && (!firstName.trim() || !lastName.trim() || !email.trim())) {
                throw new Error("Completează prenumele, numele și emailul, sau bifează donația anonimă.")
            }

            const formData = new FormData()
            formData.append("amount", amount.toString())
            formData.append("scrisoareId", scrisoareId)
            formData.append("isAnonymous", isAnonymous ? "1" : "0")
            formData.append("firstName", firstName)
            formData.append("lastName", lastName)
            formData.append("email", email)

            const result = await startStripeDonation(formData)
            if (!result.success) {
                throw new Error(result.error)
            }
            window.location.assign(result.url)
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Plata nu a putut fi inițiată."
            const raw = message.startsWith("0:") || message.includes('{"digest"') || message.includes('{"a":')
                ? "A apărut o eroare. Verifică suma și încearcă din nou."
                : message
            if (raw.includes("depășește maximum")) {
                toast.warning(raw, { id: "amount-limit" })
            }
            setError(raw)
            setLoading(false)
        }
    }

    const handlePreset = (val: number) => {
        setCustomAmount(val.toString())
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value === "") {
            setCustomAmount("")
            return
        }
        let val = Number(e.target.value)
        if (!Number.isFinite(val)) return
        if (val > MAX_APPROVED_TARGET_RON) {
            toast.warning(amountExceedsMaxMessage(), { id: "amount-limit" })
            val = MAX_APPROVED_TARGET_RON
        }
        if (val > remainingAmount) val = remainingAmount
        setCustomAmount(val.toString())
    }

    if (userRole === "PARTNER") {
        return null
    }

    if (isFullyFunded) {
        return (
            <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-2xl text-center space-y-3">
                <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-emerald-600 text-white font-bold text-sm tracking-wide">
                    Finanțat
                </div>
                <h3 className="text-xl font-bold text-emerald-800">Ținta a fost atinsă</h3>
                <p className="text-emerald-700 text-sm">
                    Donațiile pentru această scrisoare sunt închise. Cadoul va fi achiziționat și
                    livrat; statusul „îndeplinit” apare după confirmarea livrării.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-[var(--pastel-cream)] border text-slate-800 border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl p-8 space-y-6">
            <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Trimite un cadou</p>
                <div className="text-4xl font-black text-slate-900 mb-2">
                    {formatCurrency(remainingAmount)}
                </div>
                <p className="text-sm text-slate-500">
                    mai sunt necesari pentru a îndeplini complet această dorință.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => (
                    <Button
                        key={preset}
                        variant={Number(customAmount) === preset ? "default" : "outline"}
                        className={`min-h-[44px] ${Number(customAmount) === preset ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-blue-50 hover:text-blue-600 border-slate-200"}`}
                        onClick={() => handlePreset(preset)}
                    >
                        {preset} LEI
                    </Button>
                ))}
                {payableMax > 0 && !presets.includes(payableMax) && (
                    <Button
                        variant={Number(customAmount) === payableMax ? "default" : "outline"}
                        className={`min-h-[44px] ${Number(customAmount) === payableMax ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-blue-50 hover:text-blue-600 border-slate-200"}`}
                        onClick={() => handlePreset(payableMax)}
                    >
                        Integral
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Sau introdu o altă sumă</label>
                <div className="relative">
                    <Input
                        type="number"
                        placeholder="Ex: 50"
                        value={customAmount}
                        onChange={handleInputChange}
                        min={5}
                        max={payableMax}
                        className="pr-12 text-lg"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">RON</span>
                </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-white p-4">
                <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"
                />
                <span>
                    <span className="block text-sm font-semibold text-slate-800">Donează anonim</span>
                    <span className="block text-sm text-slate-500 mt-1">
                        Numele tău nu apare pe site. Emailul rămâne opțional, doar pentru chitanță.
                    </span>
                </span>
            </label>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {isAnonymous ? (
                    <>
                        <p className="text-sm font-medium text-slate-700">Chitanță (opțional)</p>
                        <Input
                            placeholder="Email, dacă vrei chitanța"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                        <p className="text-xs text-slate-500">
                            Fără email, Stripe îți poate cere unul pe pagina de plată pentru chitanța lor. Nu îl publicăm.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-sm font-medium text-slate-700">Detalii pentru chitanță</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                placeholder="Prenume"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                autoComplete="given-name"
                            />
                            <Input
                                placeholder="Nume"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                autoComplete="family-name"
                            />
                        </div>
                        <Input
                            placeholder="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                    </>
                )}
            </div>

            {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex gap-2 items-center">
                    <span>⚠</span> {error}
                </div>
            )}

            <Button
                className="w-full text-lg h-14 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-200 rounded-xl transition-all hover:scale-[1.02]"
                onClick={handleDonate}
                disabled={loading || !customAmount || Number(customAmount) < 5 || remainingAmount <= 0}
            >
                {loading ? "Se procesează..." : "Donează"}
            </Button>

            <p className="text-xs text-slate-500 leading-relaxed text-left bg-slate-50 border border-slate-100 rounded-xl p-3">
                Donația ta este destinată acestei dorințe. Dacă dorința este între timp îndeplinită
                direct sau nu mai poate fi realizată, suma poate fi transferată în{" "}
                <a href="/fond" className="text-teal-700 font-medium underline underline-offset-2">
                    Fondul pentru alte dorințe
                </a>{" "}
                și folosită pentru o altă nevoie verificată.
            </p>

            <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                <span className="text-green-500">🔒</span> Plată securizată prin Stripe.
            </p>
        </div>
    )
}
