import { logoutAdmin } from "@/app/actions/auth-actions"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const headersList = await headers()
    const pathname = headersList.get("x-pathname") || ""

    if (pathname === "/admin/login") {
        return <>{children}</>
    }

    const session = await getSession()
    if (!session) redirect("/admin/login")
    if (session.role !== "ADMIN") redirect("/admin/login?error=AccessDenied")

    return (
        <div className="min-h-screen bg-neutral-100 grid grid-cols-[240px_1fr]">
            <aside className="bg-neutral-900 text-white p-6 flex flex-col gap-6">
                <div className="font-bold text-xl tracking-tight">AdminPanel</div>
                <nav className="flex flex-col gap-2">
                    <Link href="/admin/scrisori" className="p-2 hover:bg-neutral-800 rounded">
                        Scrisori
                    </Link>
                    <Link href="/admin/partners" className="p-2 hover:bg-neutral-800 rounded">
                        Parteneri
                    </Link>
                    <Link href="/admin/redirectionari" className="p-2 hover:bg-neutral-800 rounded">
                        Redirecționări
                    </Link>
                    <Link href="/admin/proofs" className="p-2 hover:bg-neutral-800 rounded">
                        Dovezi
                    </Link>
                    <Link href="/admin/echipa" className="p-2 hover:bg-neutral-800 rounded">
                        Echipă
                    </Link>
                    <Link href="/admin/fond" className="p-2 hover:bg-neutral-800 rounded">
                        Fondul pentru alte dorințe
                    </Link>
                    <Link
                        href="/admin/stats"
                        className="p-2 hover:bg-neutral-800 rounded opacity-50 cursor-not-allowed"
                    >
                        Statistici
                    </Link>
                </nav>
                <div className="mt-auto">
                    <div className="text-xs text-neutral-500 mb-2">{session.email}</div>
                    <form action={logoutAdmin}>
                        <button className="text-sm underline hover:text-neutral-300">Ieșire</button>
                    </form>
                </div>
            </aside>
            <main className="p-8 h-screen overflow-y-auto">{children}</main>
        </div>
    )
}
