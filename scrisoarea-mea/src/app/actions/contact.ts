"use server"

import prisma from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contact@visuripehartie.ro"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitContactForm(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim()
    const email = String(formData.get("email") ?? "").trim()
    const subject = String(formData.get("subject") ?? "").trim()
    const message = String(formData.get("message") ?? "").trim()

    if (!name || !email || !subject || !message) {
        return { ok: false as const, error: "Toate câmpurile sunt obligatorii." }
    }

    if (!EMAIL_RE.test(email)) {
        return { ok: false as const, error: "Te rugăm să introduci o adresă de email validă." }
    }

    try {
        await prisma.contactSubmission.create({
            data: { name, email, subject, message },
        })
    } catch (e) {
        console.error("Contact submission save failed", e)
        return { ok: false as const, error: "Eroare la salvare. Încercați din nou." }
    }

    try {
        await sendEmail({
            to: CONTACT_EMAIL,
            template: "CONTACT_FORM",
            replyTo: email,
            data: { name, email, subject, message },
        })
    } catch (e) {
        console.error("Contact email send failed", e)
        return {
            ok: false as const,
            error: "Nu am putut trimite mesajul acum. Încearcă din nou sau scrie-ne la contact@visuripehartie.ro.",
        }
    }

    return { ok: true as const }
}
