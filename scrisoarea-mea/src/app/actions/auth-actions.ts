"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkRateLimit } from "@/lib/rate-limit"
import { sendEmail } from "@/lib/email"
import { InstitutionType } from "@prisma/client"

function slugify(text: string) {
    return text
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
}

async function signOutAndGoHome() {
    try {
        await auth.api.signOut({
            headers: await headers(),
        })
    } catch (error) {
        console.error("signOut failed", error)
    }
    redirect("/")
}

export async function logout() {
    await signOutAndGoHome()
}

export async function logoutDonor() {
    await signOutAndGoHome()
}

export async function logoutPartner() {
    await signOutAndGoHome()
}

export async function logoutAdmin() {
    await signOutAndGoHome()
}

const partnerSchema = z.object({
    email: z.string().email().transform((e) => e.trim().toLowerCase()),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    representativeRole: z.string().min(1),
    phone: z.string().min(6),
    institutionName: z.string().min(2),
    institutionType: z.nativeEnum(InstitutionType),
    cui: z.string().optional(),
    county: z.string().min(1),
    city: z.string().min(1),
    address: z.string().min(1),
    website: z.string().url().optional().or(z.literal("")),
    confirmRepresentation: z.literal("on"),
    acceptTerms: z.literal("on"),
})

export async function registerPartnerInstitution(_prev: unknown, formData: FormData) {
    const raw = Object.fromEntries(formData.entries())
    const parsed = partnerSchema.safeParse(raw)
    if (!parsed.success) {
        return { error: "Completează corect toate câmpurile obligatorii." }
    }

    const data = parsed.data
    if (data.password !== data.confirmPassword) {
        return { error: "Parolele nu coincid." }
    }

    const ip = (await headers()).get("x-forwarded-for") || "unknown"
    if (!checkRateLimit(`partner_register_${ip}`)) {
        return { error: "Prea multe încercări. Încearcă din nou peste un minut." }
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } })
    if (existingUser) {
        return {
            error:
                "Există deja un cont cu acest email. Dacă ai nevoie de acces instituțional, contactează suportul — rolurile nu se schimbă automat.",
        }
    }

    const cui = data.cui?.trim() || null
    if (cui) {
        const existingCui = await prisma.institution.findUnique({ where: { cui } })
        if (existingCui) {
            return { error: "Există deja o instituție înregistrată cu acest CUI/CIF." }
        }
    }

    let institutionId: string | null = null
    let userId: string | null = null

    try {
        const baseSlug = slugify(data.institutionName) || "institutie"
        let slug = baseSlug
        let i = 1
        while (await prisma.institution.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${i++}`
        }

        const institution = await prisma.institution.create({
            data: {
                name: data.institutionName.trim(),
                publicName: data.institutionName.trim(),
                slug,
                cui,
                institutionType: data.institutionType,
                county: data.county.trim(),
                city: data.city.trim(),
                addressPrivate: data.address.trim(),
                website: data.website || null,
                contactName: `${data.firstName} ${data.lastName}`.trim(),
                contactEmail: data.email,
                contactPhone: data.phone.trim(),
                representativeRole: data.representativeRole.trim(),
                verified: false,
            },
        })
        institutionId = institution.id

        const result = await auth.api.signUpEmail({
            body: {
                email: data.email,
                password: data.password,
                name: `${data.firstName} ${data.lastName}`.trim(),
                firstName: data.firstName.trim(),
                lastName: data.lastName.trim(),
                callbackURL: "/partner/pending-approval",
            },
        })

        const created = result as { user?: { id: string } }
        if (!created?.user?.id) {
            throw new Error("Înregistrarea contului a eșuat.")
        }
        userId = created.user.id

        await prisma.user.update({
            where: { id: userId },
            data: {
                role: "PARTNER",
                institutionId,
                firstName: data.firstName.trim(),
                lastName: data.lastName.trim(),
            },
        })

        const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL
        if (adminEmail) {
            void sendEmail({
                to: adminEmail,
                template: "ADMIN_NEW_PARTNER",
                data: { name: data.institutionName, email: data.email },
            })
        }
    } catch (e: unknown) {
        if (userId) {
            await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
        }
        if (institutionId) {
            await prisma.institution.delete({ where: { id: institutionId } }).catch(() => undefined)
        }
        const message = e instanceof Error ? e.message : "A apărut o eroare la înregistrare."
        if (message.toLowerCase().includes("exist") || message.toLowerCase().includes("already")) {
            return {
                error:
                    "Există deja un cont cu acest email. Contactează suportul dacă ai nevoie de acces instituțional.",
            }
        }
        return { error: message }
    }

    redirect(`/verify-email?email=${encodeURIComponent(data.email)}&portal=partner`)
}

export async function approveInstitution(institutionId: string) {
    const session = await auth.api.getSession({ headers: await headers() })
    const role = (session?.user as { role?: string } | undefined)?.role
    if (role !== "ADMIN") throw new Error("Unauthorized")

    await prisma.institution.update({
        where: { id: institutionId },
        data: { verified: true },
    })
}
