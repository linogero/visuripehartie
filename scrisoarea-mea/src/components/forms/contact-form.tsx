"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { submitContactForm } from "@/app/actions/contact"

export function ContactForm() {
    const [pending, setPending] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (pending) return

        setPending(true)
        setSuccess(false)
        setError(null)

        const form = e.currentTarget
        const formData = new FormData(form)
        const result = await submitContactForm(formData)

        setPending(false)

        if (result.ok) {
            setSuccess(true)
            form.reset()
        } else {
            setError(result.error ?? "Eroare la trimitere. Încearcă din nou.")
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 w-full min-w-0" noValidate>
            <div className="space-y-2 min-w-0">
                <label htmlFor="contact-name" className="text-sm font-medium text-slate-700">
                    Nume
                </label>
                <Input
                    id="contact-name"
                    name="name"
                    required
                    autoComplete="name"
                    placeholder="Numele tău"
                    disabled={pending}
                    className="w-full min-h-11"
                />
            </div>

            <div className="space-y-2 min-w-0">
                <label htmlFor="contact-email" className="text-sm font-medium text-slate-700">
                    Email
                </label>
                <Input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="email@exemplu.ro"
                    disabled={pending}
                    className="w-full min-h-11"
                />
            </div>

            <div className="space-y-2 min-w-0">
                <label htmlFor="contact-subject" className="text-sm font-medium text-slate-700">
                    Subiect
                </label>
                <Input
                    id="contact-subject"
                    name="subject"
                    required
                    placeholder="Despre ce este vorba?"
                    disabled={pending}
                    className="w-full min-h-11"
                />
            </div>

            <div className="space-y-2 min-w-0">
                <label htmlFor="contact-message" className="text-sm font-medium text-slate-700">
                    Mesaj
                </label>
                <Textarea
                    id="contact-message"
                    name="message"
                    required
                    placeholder="Scrie mesajul tău aici..."
                    disabled={pending}
                    className="w-full min-h-[150px]"
                />
            </div>

            {success ? (
                <p
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                    Mesajul tău a fost trimis. Îți vom răspunde cât mai curând.
                </p>
            ) : null}

            {error ? (
                <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {error}
                </p>
            ) : null}

            <Button
                type="submit"
                disabled={pending}
                className="w-full min-h-12 bg-[var(--brand)] hover:bg-teal-600 text-[var(--brand-foreground)] font-semibold rounded-full"
            >
                {pending ? "Se trimite..." : "Trimite mesajul"}
            </Button>
        </form>
    )
}
