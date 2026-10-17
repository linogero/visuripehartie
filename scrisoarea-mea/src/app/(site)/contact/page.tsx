"use client"

import { ContactForm } from "@/components/forms/contact-form"

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-slate-50 py-20 px-4">
            <div className="container mx-auto max-w-xl min-w-0 bg-white p-5 sm:p-8 rounded-xl shadow-sm border">
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-3xl font-bold">Contact</h1>
                    <p className="text-slate-500">Suntem aici pentru întrebări, parteneriate sau feedback.</p>
                </div>

                <ContactForm />

                <div className="mt-8 pt-8 border-t text-center text-sm text-slate-500 space-y-2">
                    <p>
                        <strong>Email Direct:</strong> contact@visuripehartie.ro
                    </p>
                    <p>
                        <strong>Program:</strong> Luni - Vineri, 09:00 - 17:00
                    </p>
                </div>
            </div>
        </main>
    )
}
