import Link from "next/link"
import Image from "next/image"
import { getSession } from "@/lib/auth"
import { HeaderNavClient } from "@/components/layout/header-nav-client"
import { Button } from "@/components/ui/button"
import { LegalLink } from "@/components/legal/legal-dialog"

const LOGO_SRC = "/brand/visuri-pe-hartie-logo.webp"
const LOGO_WIDTH = 2050
const LOGO_HEIGHT = 695

export async function SiteHeader() {
    const session = await getSession()

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/50 backdrop-blur-md">
            <div className="container mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
                <Link
                    href="/"
                    aria-label="Visuri pe hartie – Acasă"
                    className="flex items-center shrink min-w-0 min-h-[44px] -ml-1 sm:ml-0"
                >
                    <Image
                        src={LOGO_SRC}
                        alt="Visuri pe hartie"
                        width={LOGO_WIDTH}
                        height={LOGO_HEIGHT}
                        priority
                        className="h-auto w-auto max-h-10 sm:max-h-12 md:max-h-[3.25rem] max-w-[min(34vw,118px)] sm:max-w-[180px] md:max-w-[200px] object-contain"
                    />
                </Link>

                <div className="flex items-center gap-1 sm:gap-2 md:gap-6 flex-none justify-end">
                    <HeaderNavClient session={session ? { email: session.email, role: session.role } : null} />
                </div>
            </div>
        </header>
    )
}

export async function SiteFooter() {
    const session = await getSession()
    const showPartnerAccess = session?.role !== "DONOR"

    return (
        <footer className="bg-[var(--pastel-sage)]/50 border-t pt-16 pb-12 text-slate-600 text-sm">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-12 mb-12">
                <div className="space-y-4">
                    <Link href="/" aria-label="Visuri pe hartie – Acasă" className="inline-block">
                        <Image
                            src={LOGO_SRC}
                            alt="Visuri pe hartie"
                            width={LOGO_WIDTH}
                            height={LOGO_HEIGHT}
                            className="h-12 md:h-14 w-auto object-contain"
                        />
                    </Link>
                    <p className="leading-relaxed text-slate-500">
                        Platforma tehnologică 100% transparentă care conectează direct donatorii cu nevoile verificate ale copiilor din medii vulnerabile. Fără comisioane. Fără intermediari.
                    </p>
                    <div className="text-xs text-slate-400 space-y-1 mt-4">
                        <p><strong>Asociația pentru visuri și oportunități</strong></p>
                        <p>CUI: {process.env.NEXT_PUBLIC_ASSOCIATION_CUI || "55406686"}</p>
                        <p>București, România</p>
                        <p>
                            <a href="mailto:contact@visuripehartie.ro" className="hover:text-teal-700">
                                contact@visuripehartie.ro
                            </a>
                        </p>
                    </div>
                </div>

                <div>
                    <h4 className="font-bold text-slate-900 mb-4">Navigare</h4>
                    <ul className="space-y-3">
                        <li><Link href="/cum-functioneaza" className="hover:text-teal-600 transition-colors inline-block py-2">Cum funcționează</Link></li>
                        <li><Link href="/scrisori" className="hover:text-teal-600 transition-colors inline-block py-2">Toate Scrisorile</Link></li>
                        <li><Link href="/directioneaza-35" className="text-[var(--brand)] font-semibold hover:underline inline-block py-2">Redirecționează 3.5%</Link></li>
                        <li><Link href="/directioneaza-20" className="text-[var(--brand)] font-semibold hover:underline inline-block py-2">Sponsorizare companii</Link></li>
                        <li><Link href="/impact" className="hover:text-teal-600 transition-colors inline-block py-2">Dovezi de Impact</Link></li>
                        <li><Link href="/transparenta" className="hover:text-teal-600 transition-colors inline-block py-2">Rapoarte Financiare</Link></li>
                        <li><Link href="/contact" className="hover:text-teal-600 transition-colors inline-block py-2">Contact</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-slate-900 mb-4">Resurse & Siguranță</h4>
                    <ul className="space-y-3">
                        <li><Link href="/fapte" className="hover:text-teal-600 transition-colors inline-block py-2">Fapte și Cifre</Link></li>
                        <li><Link href="/siguranta" className="hover:text-teal-600 transition-colors inline-block py-2">Siguranță și GDPR</Link></li>
                        <li><Link href="/procese" className="hover:text-teal-600 transition-colors inline-block py-2">Procese Operaționale</Link></li>
                        <li><Link href="/intrebari" className="hover:text-teal-600 transition-colors inline-block py-2">Întrebări Frecvente</Link></li>
                        <li><Link href="/scrisori/categorie/educatie" className="hover:text-teal-600 transition-colors inline-block py-2">Educație</Link></li>
                        <li><Link href="/scrisori/categorie/jucarii" className="hover:text-teal-600 transition-colors inline-block py-2">Jucării</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-slate-900 mb-4">Legal</h4>
                    <ul className="space-y-3">
                        <li><LegalLink doc="termeni" className="hover:text-teal-600 transition-colors inline-block py-2 text-left">Termeni și Condiții</LegalLink></li>
                        <li><LegalLink doc="confidentialitate" className="hover:text-teal-600 transition-colors inline-block py-2 text-left">Politica de Confidențialitate</LegalLink></li>
                        <li><LegalLink doc="cookies" className="hover:text-teal-600 transition-colors inline-block py-2 text-left">Politica Cookies</LegalLink></li>
                    </ul>
                </div>
            </div>

            <div className="container mx-auto px-4 border-t pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-6">
                <div className="flex flex-col gap-2">
                    <p>&copy; {new Date().getFullYear()} Asociația pentru visuri și oportunități. Cod Open Source.</p>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="opacity-70">Plăți securizate prin</span>
                        <span className="font-bold text-slate-500">Stripe</span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-4 items-center justify-center">
                    <Button asChild variant="outline" size="sm" className="h-10 px-4">
                        <Link href="/admin">Acces Admin</Link>
                    </Button>
                    {showPartnerAccess ? (
                        <Button asChild size="sm" className="h-10 px-4 bg-slate-800 hover:bg-slate-900">
                            <Link href="/partner">Acces Parteneri</Link>
                        </Button>
                    ) : null}
                </div>
            </div>
        </footer>
    )
}
