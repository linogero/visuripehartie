import { headers } from "next/headers"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PartnerLogoutButton } from "@/components/partner/partner-logout-button"

export default async function PartnerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const headersList = await headers()
    const pathname = headersList.get("x-pathname") || ""

    if (
        pathname === "/partner/login" ||
        pathname === "/partner/register" ||
        pathname === "/partner/pending-approval"
    ) {
        return <>{children}</>
    }

    const session = await getSession()
    if (!session) redirect("/partner/login")
    if (session.role !== "PARTNER") redirect("/")
    if (!session.emailVerified) redirect("/verify-email?portal=partner")

    if (session.institutionId) {
        const institution = await prisma.institution.findUnique({
            where: { id: session.institutionId },
            select: { verified: true },
        })
        if (!institution?.verified) redirect("/partner/pending-approval")
    } else {
        redirect("/partner/pending-approval")
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
                <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span>Portal Instituții</span>
                    <span className="text-sm font-normal text-slate-500">| {session.email}</span>
                </div>
                <nav className="flex gap-4">
                    <Link href="/partner" className="text-sm hover:underline">
                        Scrisorile Tale
                    </Link>
                    <Link href="/partner/scrisori/new" className="text-sm hover:underline">
                        Adaugă Scrisoare
                    </Link>
                </nav>
                <PartnerLogoutButton variant="ghost" size="sm" />
            </header>
            <main className="p-6 max-w-7xl mx-auto">{children}</main>
        </div>
    )
}
