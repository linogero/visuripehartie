import { Resend } from "resend"
import { absoluteUrl, LEGAL_NAME, SITE_CUI, SITE_EMAIL, SITE_NAME_DIACRITICS, SITE_URL } from "@/lib/seo/site"

type AuthEmailKind = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "PARTNER_VERIFICATION"

function requireEmailConfig() {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const from = process.env.EMAIL_FROM?.trim()
    const appUrl =
        process.env.BETTER_AUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()

    if (!apiKey) {
        const msg = "RESEND_API_KEY is missing. Authentication emails cannot be sent."
        console.error(`[AUTH EMAIL] ${msg}`)
        throw new Error(msg)
    }

    // Resend keys are typically `re_...` and much longer than a placeholder.
    if (apiKey.length < 20 || !apiKey.startsWith("re_")) {
        const msg =
            "RESEND_API_KEY looks invalid (expected a Resend key starting with re_). Authentication emails cannot be sent."
        console.error(`[AUTH EMAIL] ${msg}`)
        throw new Error(msg)
    }

    if (!from) {
        const msg =
            "EMAIL_FROM is missing. Set it to: Visuri pe hartie <contact@your-verified-domain.ro>"
        console.error(`[AUTH EMAIL] ${msg}`)
        throw new Error(msg)
    }

    // Resend requires: email@domain.com  OR  Name <email@domain.com>
    const emailOnly = /^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/
    const nameAndEmail = /^.+\s<[^\s<>]+@[^\s<>]+\.[^\s<>]+>$/
    if (!emailOnly.test(from) && !nameAndEmail.test(from)) {
        const msg =
            `EMAIL_FROM is invalid ("${from}"). Use: email@domain.com or Name <email@domain.com>`
        console.error(`[AUTH EMAIL] ${msg}`)
        throw new Error(msg)
    }

    if (/@(gmail|yahoo|hotmail|outlook)\./i.test(from)) {
        const msg =
            "EMAIL_FROM must use a Resend-verified domain, not a consumer mailbox (Gmail/Yahoo/etc)."
        console.error(`[AUTH EMAIL] ${msg}`)
        throw new Error(msg)
    }

    if (!appUrl) {
        console.warn(
            "[AUTH EMAIL] NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL is missing; verification links may be wrong."
        )
    }

    if (!process.env.BETTER_AUTH_SECRET?.trim()) {
        console.warn("[AUTH EMAIL] BETTER_AUTH_SECRET is missing.")
    }

    return { apiKey, from }
}

function getResendClient() {
    const { apiKey } = requireEmailConfig()
    return new Resend(apiKey)
}

function buttonHtml(url: string, label: string) {
    return `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`
}

function fallbackLinkHtml(url: string) {
    return `<p style="color:#64748b;font-size:13px;word-break:break-all">Dacă butonul nu funcționează, copiază acest link în browser:<br/><a href="${url}">${url}</a></p>`
}

async function sendViaResend({
    to,
    subject,
    html,
    kind,
    replyTo,
}: {
    to: string
    subject: string
    html: string
    kind: AuthEmailKind | string
    replyTo?: string
}) {
    const { from } = requireEmailConfig()
    const resend = getResendClient()

    if (process.env.NODE_ENV !== "production") {
        console.log(`[AUTH EMAIL] Sending ${kind} to ${to}`)
    }

    const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
    })

    if (error) {
        console.error(`[AUTH EMAIL] Resend rejected ${kind} for ${to}:`, error)
        throw new Error(
            typeof error === "object" && error && "message" in error
                ? String((error as { message: string }).message)
                : `Resend failed to send ${kind}`
        )
    }

    if (process.env.NODE_ENV !== "production") {
        console.log(`[AUTH EMAIL] Accepted by Resend`, {
            id: data?.id,
            to,
            kind,
        })
    }

    return data
}

/**
 * Donor / generic email verification — uses Better Auth verification URL as-is.
 */
export async function sendVerificationEmail({
    to,
    url,
    name,
}: {
    to: string
    url: string
    name?: string
}) {
    if (process.env.NODE_ENV !== "production") {
        console.log("[AUTH EMAIL] Verification requested")
    }

    const greeting = name ? `Salut, ${name},` : "Salut,"
    const subject = "Confirmă adresa de email – Visuri pe hartie"
    const html = `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:560px">
        <p>${greeting}</p>
        <p>Pentru a activa contul tău Visuri pe hartie, confirmă adresa de email folosind butonul de mai jos.</p>
        ${buttonHtml(url, "Confirmă adresa de email")}
        ${fallbackLinkHtml(url)}
        <p style="color:#64748b;font-size:14px">Linkul expiră în curând. Dacă nu ai creat acest cont, ignoră acest mesaj.</p>
      </div>`

    return sendViaResend({ to, subject, html, kind: "EMAIL_VERIFICATION" })
}

/**
 * Partner institution email verification.
 */
export async function sendPartnerVerificationEmail({
    to,
    url,
    name,
}: {
    to: string
    url: string
    name?: string
}) {
    if (process.env.NODE_ENV !== "production") {
        console.log("[AUTH EMAIL] Partner verification requested")
    }

    const greeting = name ? `Salut, ${name},` : "Salut,"
    const subject = "Confirmă contul instituției – Visuri pe hartie"
    const html = `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:560px">
        <p>${greeting}</p>
        <p>Confirmă adresa de email a contului instituției pentru Portal Instituții.</p>
        <p><strong>Important:</strong> confirmarea emailului nu înseamnă aprobarea instituției.
        După verificare, echipa Visuri pe hartie va analiza datele organizației înainte ca aceasta să poată publica scrisori.</p>
        ${buttonHtml(url, "Confirmă adresa de email")}
        ${fallbackLinkHtml(url)}
        <p style="color:#64748b;font-size:14px">Linkul expiră în curând.</p>
      </div>`

    return sendViaResend({ to, subject, html, kind: "PARTNER_VERIFICATION" })
}

/**
 * Password reset — uses Better Auth reset URL as-is.
 */
export async function sendPasswordResetEmail({
    to,
    url,
    name,
}: {
    to: string
    url: string
    name?: string
}) {
    if (process.env.NODE_ENV !== "production") {
        console.log("[AUTH EMAIL] Password reset requested")
    }

    const greeting = name ? `Salut, ${name},` : "Salut,"
    const subject = "Resetează parola – Visuri pe hartie"
    const html = `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:560px">
        <p>${greeting}</p>
        <p>Ai solicitat resetarea parolei. Apasă butonul de mai jos pentru a alege o parolă nouă.</p>
        ${buttonHtml(url, "Resetează parola")}
        ${fallbackLinkHtml(url)}
        <p style="color:#64748b;font-size:14px">Dacă nu ai cerut resetarea, ignoră acest email. Linkul este valabil o perioadă limitată.</p>
      </div>`

    return sendViaResend({ to, subject, html, kind: "PASSWORD_RESET" })
}

/** @deprecated Use sendVerificationEmail / sendPasswordResetEmail */
export async function sendAuthEmail({
    to,
    kind,
    url,
    name,
}: {
    to: string
    kind: "DONOR_VERIFY" | "PARTNER_VERIFY" | "PASSWORD_RESET"
    url: string
    name?: string
}) {
    if (kind === "PASSWORD_RESET") {
        return sendPasswordResetEmail({ to, url, name })
    }
    if (kind === "PARTNER_VERIFY") {
        return sendPartnerVerificationEmail({ to, url, name })
    }
    return sendVerificationEmail({ to, url, name })
}

export type EmailTemplate =
    | "DONATION_SUCCESS"
    | "MATCHING_APPLIED"
    | "SCRISOARE_APPROVED"
    | "SCRISOARE_REJECTED"
    | "PROOF_REJECTED"
    | "ADMIN_NEW_PARTNER"
    | "ADMIN_NEW_SCRISOARE"
    | "CONTACT_FORM"
    | "DONATION_CONFIRMATION"

function escapeHtml(value: unknown) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

function formatRon(value: unknown) {
    const amount = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(amount)) return "—"
    return new Intl.NumberFormat("ro-RO", {
        style: "currency",
        currency: "RON",
    }).format(amount)
}

function safeHttpUrl(value: unknown, fallback: string) {
    const url = String(value ?? "").trim()
    if (/^https?:\/\//i.test(url)) return url
    return fallback
}

function donationConfirmationHtml(data: Record<string, unknown>) {
    const donorName = String(data.donorName ?? "").trim()
    const childName = String(data.childName ?? "").trim()
    const amount = formatRon(data.amount)
    const date = String(data.date ?? "").trim() || "—"
    const reference = String(data.transactionId ?? "").trim() || "—"
    const homeUrl = absoluteUrl("/")
    const letterUrl = safeHttpUrl(data.letterUrl, "")
    const actionUrl = letterUrl || homeUrl
    const actionLabel = letterUrl ? "Vezi scrisoarea" : "Înapoi pe site"
    const greeting = donorName ? `Salut, ${escapeHtml(donorName)},` : "Salut,"
    const about = childName
        ? `Donația ta pentru ${escapeHtml(childName)} a fost înregistrată.`
        : "Donația ta a fost înregistrată."
    const row = (label: string, value: string, small = false) => `
        <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;vertical-align:top;">${label}</td>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-family:${small ? "Consolas,Menlo,monospace" : "Arial,Helvetica,sans-serif"};font-size:${small ? "12px" : "14px"};font-weight:600;color:#0f172a;text-align:right;vertical-align:top;word-break:break-all;">${escapeHtml(value)}</td>
        </tr>`

    return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Confirmare donație</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${about} ${escapeHtml(amount)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr>
<td style="background:#0f766e;padding:28px 32px;">
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.3;font-weight:700;color:#ffffff;">${escapeHtml(SITE_NAME_DIACRITICS)}</p>
</td>
</tr>
<tr>
<td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#334155;">${greeting}</p>
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:#0f172a;">Mulțumim pentru donație</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;">${about} Îți mulțumim că ești alături de noi.</p>
<p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:1.1;font-weight:700;color:#0f766e;">${escapeHtml(amount)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("Sumă", amount)}
${row("Data", date)}
${row("Referință plată", reference, true)}
</table>
<p style="margin:28px 0 8px;">
<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;">${actionLabel}</a>
</p>
</td>
</tr>
<tr>
<td style="padding:20px 32px 28px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
<p style="margin:0 0 4px;">${escapeHtml(LEGAL_NAME)} · CUI ${escapeHtml(SITE_CUI)}</p>
<p style="margin:0 0 4px;"><a href="mailto:${escapeHtml(SITE_EMAIL)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(SITE_EMAIL)}</a></p>
<p style="margin:0;">Ai primit acest email pentru că ai făcut o donație pe ${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
}

interface EmailData {
    to: string
    template: EmailTemplate
    data: Record<string, unknown>
    replyTo?: string
}

export async function sendEmail({ to, template, data, replyTo }: EmailData) {
    let subject = ""
    let html = ""

    switch (template) {
        case "DONATION_CONFIRMATION":
            subject = "Confirmare donație - Visuri pe hartie"
            html = donationConfirmationHtml(data)
            break
        case "DONATION_SUCCESS":
            subject = "Mulțumim pentru donație - Visuri pe hartie"
            html = `<p>Salut,</p><p>Îți mulțumim pentru donația de ${data.amount} RON pentru ${data.childName}.</p>`
            break
        case "MATCHING_APPLIED":
            subject = "Veste bună! Donația ta a fost dublată"
            html = `<p>Salut,</p><p>Donația ta pentru ${data.childName} a fost dublată de ${data.sponsorName}.</p>`
            break
        case "SCRISOARE_APPROVED":
            subject = "Scrisoare Aprobată"
            html = `<p>Scrisoarea pentru ${data.childName} a fost aprobată și este acum publică.</p>`
            break
        case "SCRISOARE_REJECTED":
            subject = "Scrisoare Respinsă - Necesită modificări"
            html = `<p>Scrisoarea pentru ${data.childName} a fost respinsă. Motiv: ${data.reason}</p>`
            break
        case "CONTACT_FORM": {
            const name = escapeHtml(data.name)
            const email = escapeHtml(data.email)
            const contactSubject = escapeHtml(data.subject)
            const message = escapeHtml(data.message).replace(/\n/g, "<br>")
            subject = `[Contact] ${String(data.subject ?? "")}`
            html = `<p><strong>De la:</strong> ${name} &lt;${email}&gt;</p><p><strong>Email:</strong> ${email}</p><p><strong>Subiect:</strong> ${contactSubject}</p><p><strong>Mesaj:</strong></p><p>${message}</p>`
            break
        }
        case "ADMIN_NEW_PARTNER":
            subject = "Instituție nouă de verificat"
            html = `<p>O instituție nouă așteaptă aprobare: <strong>${data.name}</strong> (${data.email}).</p>`
            break
        default:
            return
    }

    if (!subject || !html) return

    await sendViaResend({ to, subject, html, kind: template, replyTo })
}
