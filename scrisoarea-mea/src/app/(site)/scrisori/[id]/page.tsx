import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { getSession } from "@/lib/auth"
import { Progress } from "@/components/ui/progress"
import DonationModule from "@/components/donation-module"
import FulfillmentModule from "@/components/fulfillment-module"
import { Badge } from "@/components/ui/badge"
import { InDeliveryTag, ReservedHoursTag } from "@/components/letters/reserved-tag"
import { Metadata } from 'next'
import { permanentRedirect } from "next/navigation"
import { generateBreadcrumbSchema, generateLetterSchema } from "@/lib/seo/jsonld"
import { JsonLd } from "@/components/seo/json-ld"
import { pageMetadata } from "@/lib/seo/metadata"
import { categoryLabel, resolveCategory } from "@/lib/seo/categories"
import { ogImageUrl } from "@/lib/seo/site"
import { Sparkles, PlayCircle, Heart, ArrowLeft } from "lucide-react"
import { canManageLetter } from "@/lib/permissions"
import {
    LetterModeration,
    isApprovedPublic,
    isExternallyFulfilled,
    normalizeModerationStatus,
    publicTargetAmount,
} from "@/lib/letter-moderation"
import { getFundAllocatedToLetter } from "@/lib/fund"
import { parseWishlistItems, publicItemPrice } from "@/lib/letter-items"

import PartnerActionsPanel from "@/components/partner-actions-panel"
import { Button } from "@/components/ui/button"

export const revalidate = 3600

export async function generateStaticParams() {
    try {
        const letters = await prisma.scrisoare.findMany({
            where: {
                moderationStatus: {
                    in: [
                        LetterModeration.APPROVED,
                        LetterModeration.FULFILLED,
                        LetterModeration.EXTERNALLY_FULFILLED,
                        "APPROVED",
                    ],
                },
            },
            select: { slug: true, id: true },
            take: 2000,
        })
        return letters.map((letter) => ({ id: letter.slug || letter.id }))
    } catch {
        return []
    }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const letter = await prisma.scrisoare.findFirst({
        where: {
            OR: [{ slug: id }, { id }],
            moderationStatus: {
                in: [LetterModeration.APPROVED, LetterModeration.FULFILLED, "APPROVED"],
            },
        },
        include: { institution: true },
    })

    if (!letter) return { title: "Dorință inexistentă", robots: { index: false, follow: false } }

    const target = publicTargetAmount(letter)
    const remaining = Math.max(0, target - Number(letter.collectedAmount))
    const location = [letter.institution?.city, letter.institution?.county].filter(Boolean).join(", ")
    const category = categoryLabel(letter.category)
    const title = `Donează pentru ${letter.childFirstName}, ${letter.childAge} ani${location ? ` — ${location}` : ""}`
    const description = letter.childStory?.slice(0, 150)
        || `Scrisoare verificată pe visuripehartie.ro: ajută-l pe ${letter.childFirstName} (${letter.childAge} ani) cu ${category.toLowerCase()}.${location ? ` Caz din ${location}.` : ""} Mai sunt ${remaining} RON până la țintă.`
    const path = `/scrisori/${letter.slug || letter.id}`
    const ogUrl = ogImageUrl(`Dorința lui ${letter.childFirstName}`, letter.childStory?.slice(0, 50) || category, "Ajutor")

    return {
        ...pageMetadata({
            title,
            description,
            path,
            keywords: [letter.childFirstName, category, location, "donație copii", "scrisoare verificată"],
            image: ogUrl,
            type: "article",
        }),
        other: {
            "geo.region": "RO",
            "geo.placename": location || "România",
        },
    }
}

export default async function ScrisoarePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await getSession()
    let letter = await prisma.scrisoare.findFirst({
        where: { slug: id },
        include: {
            institution: true,
            reservations: { where: { status: 'PENDING', expiresAt: { gt: new Date() } } },
            fulfillmentClaims: {
                where: {
                    status: { in: ['PENDING', 'SHIPPED', 'COMPLETED'] },
                    expiresAt: { gt: new Date() }
                }
            },
            campaign: { include: { matchingRules: { include: { sponsor: true } } } },
            proofs: true
        }
    })

    if (!letter) {
        letter = await prisma.scrisoare.findFirst({
            where: { id },
            include: {
                institution: true,
                reservations: { where: { status: 'PENDING', expiresAt: { gt: new Date() } } },
                fulfillmentClaims: {
                    where: {
                        status: { in: ['PENDING', 'SHIPPED', 'COMPLETED'] },
                        expiresAt: { gt: new Date() }
                    }
                },
                campaign: { include: { matchingRules: { include: { sponsor: true } } } },
                proofs: true
            }
        })
    }

    if (!letter) notFound()

    if (letter.slug && id !== letter.slug) {
        permanentRedirect(`/scrisori/${letter.slug}`)
    }

    const moderation = normalizeModerationStatus(letter.moderationStatus)
    const isStaffOrOwner =
        session?.role === 'ADMIN' ||
        (session?.role === 'PARTNER' && session.institutionId === letter.institutionId)

    // Non-approved letters are not publicly accessible (404), except owner/admin preview
    const publiclyVisible =
        moderation === LetterModeration.APPROVED ||
        moderation === LetterModeration.FULFILLED ||
        moderation === LetterModeration.EXTERNALLY_FULFILLED

    if (!publiclyVisible && !isStaffOrOwner) {
        notFound()
    }

    const externallyFulfilled = isExternallyFulfilled(letter)
    const fundAllocated = await getFundAllocatedToLetter(letter.id)

    const jsonLd = generateLetterSchema({
        ...letter,
        targetAmount: publicTargetAmount(letter),
    })
    const breadcrumbs = generateBreadcrumbSchema([
        { name: "Acasă", url: "/" },
        { name: "Scrisori", url: "/scrisori" },
        { name: categoryLabel(letter.category), url: `/scrisori/categorie/${resolveCategory(letter.category)?.slug || "altele"}` },
        { name: `Dorința lui ${letter.childFirstName}`, url: `/scrisori/${letter.slug || letter.id}` },
    ])

    // Matching Logic (View Only)
    const now = new Date()
    const activeRule = letter.campaign?.matchingRules.find((r: any) =>
        r.active &&
        r.startsAt <= now &&
        (!r.endsAt || r.endsAt >= now) &&
        Number(r.currentMatchTotal) < Number(r.maxMatchTotal)
    )

    // Calc Logic — public target is admin-approved amount only
    const paid = Number(letter.collectedAmount)
    const reserved = letter.reservations.reduce((acc: number, r: any) => acc + Number(r.amount), 0)
    const target = publicTargetAmount(letter)
    const wishlistItems = parseWishlistItems(letter.items)

    const activeClaim = letter.fulfillmentClaims[0] || null
    const ownsReservation = Boolean(
        session?.email &&
        activeClaim?.status === "PENDING" &&
        activeClaim.expiresAt > new Date() &&
        activeClaim.donorEmail?.toLowerCase() === session.email.trim().toLowerCase()
    )
    const inDelivery = Boolean(
        activeClaim &&
        (activeClaim.status === "SHIPPED" || activeClaim.status === "COMPLETED") &&
        activeClaim.awbNumber?.trim() &&
        activeClaim.awbProvider?.trim()
    )
    const ownsShipment = Boolean(
        inDelivery &&
        session?.email &&
        activeClaim?.donorEmail?.toLowerCase() === session.email.trim().toLowerCase()
    )

    const totalOccupied = paid + reserved
    const remaining = Math.max(0, target - totalOccupied)
    const percentage = target > 0 ? Math.min(100, Math.round((totalOccupied / target) * 100)) : 0
    const isFullyFunded =
        !externallyFulfilled &&
        (totalOccupied >= target || letter.status === "FINANTAT" || letter.status === "INCHIS")
    const isDonationDisabled =
        externallyFulfilled ||
        !isApprovedPublic(letter.moderationStatus) ||
        isFullyFunded ||
        ["IN_ACHIZITIE", "LIVRAT", "FINALIZAT", "ANULAT", "RESPINS", "INCHIS", "EXTERN_FULFILLED"].includes(
            letter.status
        )
    const directDonations = Math.max(0, paid - fundAllocated)
    const isVideo = letter.mediaType === 'VIDEO'

    const isManaging = canManageLetter(session, letter)
    const isPartnerLoggedIn = session?.role === 'PARTNER'

    return (
        <main className="min-h-screen bg-[var(--pastel-sage)]/30 pb-20 font-sans">
            <JsonLd data={[jsonLd, breadcrumbs]} />
            {/* Header Status Bar */}
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Back Button */}
                <div className="mb-6">
                    <Link href="/scrisori" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors gap-1 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Înapoi la scrisori
                    </Link>
                </div>

                <div className="mb-10 pb-8 border-b border-slate-200">
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">{letter.category}</Badge>
                        {externallyFulfilled && (
                            <Badge className="bg-amber-100 text-amber-900 border-none">
                                Dorință îndeplinită extern
                            </Badge>
                        )}
                        {!externallyFulfilled && letter.status === 'FINANTAT' && <Badge className="bg-emerald-100 text-emerald-800 border-none flex gap-1 items-center"><Sparkles className="w-3 h-3" /> Finanțat</Badge>}
                        {!externallyFulfilled && letter.status === 'INCHIS' && <Badge className="bg-emerald-100 text-emerald-800 border-none">Livrat cu succes</Badge>}
                        {activeClaim?.status === "PENDING" && activeClaim.expiresAt > new Date() ? (
                            <ReservedHoursTag expiresAt={activeClaim.expiresAt.toISOString()} />
                        ) : inDelivery ? (
                            <InDeliveryTag />
                        ) : null}
                        {activeRule && <Badge className="bg-purple-100 text-purple-800 border-none">⚡ Matching 1:1 Activ</Badge>}
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                        Dorința lui {letter.childFirstName}, <span className="text-slate-400 font-light">{letter.childAge} ani</span>
                    </h1>
                    {ownsShipment && activeClaim?.awbProvider && activeClaim.awbNumber ? (
                        <p className="mb-4 text-sm text-slate-600">
                            Curier: <span className="font-semibold text-slate-900">{activeClaim.awbProvider}</span>
                            {" · "}
                            AWB: <span className="font-semibold text-slate-900">{activeClaim.awbNumber}</span>
                        </p>
                    ) : null}
                    <p data-seo-summary className="text-slate-600 max-w-2xl">
                        Scrisoare verificată pe visuripehartie.ro. {letter.childFirstName} are {letter.childAge} ani
                        {letter.institution.county ? ` și este ajutat printr-un partener din ${letter.institution.city}, ${letter.institution.county}` : ""}.
                        Categoria: {categoryLabel(letter.category)}. Donațiile merg 100% către cadou, iar predarea se face la instituție, nu la adresa copilului.
                    </p>

                    <div className="flex items-center gap-2 text-slate-500 text-lg">
                        <span>adusă de</span>
                        <Link href={`/partener/${letter.institution.slug}`} className="font-medium text-blue-600 hover:underline decoration-blue-200 underline-offset-4">
                            {letter.institution.publicName || letter.institution.name}
                        </Link>
                        {letter.institution.verified && (
                            <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-[10px]" title="Verificat">✓</span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* Left Column (Media & Story) */}
                    <div className="lg:col-span-7 space-y-10">
                        <section className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden relative group border border-slate-800">
                            {isVideo ? (
                                <div className="aspect-video relative w-full bg-black">
                                    <video
                                        src={letter.originalImgUrl}
                                        className="w-full h-full object-contain"
                                        controls
                                        poster={letter.originalImgUrl.replace('.mp4', '_thumb.jpg')}
                                    />
                                </div>
                            ) : (
                                <div className="aspect-[4/3] relative w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                                    {/* Blurred Background for professional fill */}
                                    <div
                                        className="absolute inset-0 bg-cover bg-center blur-2xl opacity-60 scale-110"
                                        style={{ backgroundImage: `url(${letter.originalImgUrl})` }}
                                    ></div>
                                    {/* Main Image */}
                                    <img
                                        src={letter.originalImgUrl}
                                        alt={`Scrisorica lui ${letter.childFirstName}`}
                                        className="relative w-full h-full object-contain z-10 drop-shadow-xl"
                                    />
                                </div>
                            )}
                        </section>

                        <section className="prose prose-lg prose-slate max-w-none">
                            <h3 className="font-bold text-2xl text-slate-900 mb-4 flex items-center gap-2">
                                <span className="text-3xl">📖</span> Povestea lui {letter.childFirstName}
                            </h3>
                            <div className="bg-[var(--pastel-blue)]/30 p-8 rounded-2xl border border-slate-100 shadow-sm relative">
                                <span className="absolute top-4 left-4 text-6xl text-[var(--pastel-blue)] font-serif leading-none select-none">“</span>
                                <p className="text-slate-700 italic relative z-10 leading-loose">
                                    {letter.childStory || "Povestea nu a fost încă transcrisă, dar nevoia este reală și verificată."}
                                </p>
                                <span className="absolute bottom-4 right-4 text-6xl text-[var(--pastel-blue)] font-serif leading-none select-none rotate-180">“</span>
                            </div>
                        </section>

                        <section>
                            <h3 className="font-bold text-xl text-slate-900 mb-6 flex items-center gap-2">
                                <span className="text-2xl">🎁</span> Ce își dorește
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <ul className="divide-y">
                                    {wishlistItems.length > 0 ? (
                                        wishlistItems.map((item, idx) => {
                                            const publicPrice = publicItemPrice(item)
                                            return (
                                                <li
                                                    key={idx}
                                                    className="p-4 flex justify-between gap-4 text-sm"
                                                >
                                                    <span className="font-medium text-slate-900">
                                                        {item.name}
                                                        {item.size ? ` (${item.size})` : ""}
                                                    </span>
                                                    {publicPrice != null ? (
                                                        <span className="font-mono text-slate-600">
                                                            {formatCurrency(publicPrice)}
                                                        </span>
                                                    ) : null}
                                                </li>
                                            )
                                        })
                                    ) : (
                                        <li className="p-4 text-slate-700">{letter.wishList}</li>
                                    )}
                                </ul>
                                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center justify-between border-t bg-slate-50">
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-500">
                                            Suma necesară este stabilită de administrator după verificare.
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 bg-white px-6 py-4 rounded-xl border border-slate-100">
                                        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                                            Necesar
                                        </div>
                                        <div className="text-2xl font-black text-slate-900">
                                            {formatCurrency(target)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="bg-[var(--pastel-mint)]/50 text-slate-800 p-6 rounded-2xl text-sm flex gap-4 items-start border border-slate-200">
                            <div className="p-2 bg-white rounded-full shadow-sm">🛡</div>
                            <div>
                                <strong className="block text-base mb-1">Impact Garantat</strong>
                                Noi nu facilităm contactul direct pentru a proteja copiii. Dar îți promitem transparență totală: vei vedea dovada foto/video a bucuriei create, încărcată de partenerul nostru acreditat.
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Action) */}
                    <div className="lg:col-span-5 relative">
                        <div className="sticky top-24 space-y-6">
                            <div className="bg-[var(--pastel-cream)] p-6 md:p-8 border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <span className="text-4xl font-black text-slate-900">{formatCurrency(totalOccupied)}</span>
                                        <span className="text-sm font-medium text-slate-500 block mt-1">strânși din {formatCurrency(target)}</span>
                                    </div>
                                    {percentage >= 100 ? (
                                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                                            <Sparkles className="w-6 h-6" />
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <span className="text-2xl font-bold text-blue-600">{percentage}%</span>
                                        </div>
                                    )}
                                </div>
                                <Progress value={percentage} className="h-3 mb-6 bg-slate-100" indicatorClassName={percentage >= 100 ? "bg-emerald-500" : "bg-blue-600"} />

                                {externallyFulfilled ? (
                                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-6 text-sm text-amber-950 space-y-2">
                                        <p className="font-bold">Dorință îndeplinită extern</p>
                                        <p className="leading-relaxed">
                                            Această dorință a fost îndeplinită direct de un donator.
                                        </p>
                                        {paid > 0 ? (
                                            <p className="leading-relaxed">
                                                Înainte ca dorința să fie îndeplinită, comunitatea contribuise cu{" "}
                                                {formatCurrency(paid)}. Această sumă a fost transferată în Fondul
                                                pentru alte dorințe, unde va fi folosită pentru alte nevoi
                                                verificate.
                                            </p>
                                        ) : null}
                                        <Link
                                            href="/fond"
                                            className="inline-flex font-semibold text-teal-800 hover:underline"
                                        >
                                            Vezi Fondul pentru alte dorințe →
                                        </Link>
                                    </div>
                                ) : null}

                                {fundAllocated > 0 ? (
                                    <div className="bg-teal-50 border border-teal-100 p-4 rounded-xl mb-6 text-sm text-teal-950 space-y-2">
                                        <p className="leading-relaxed">
                                            Din suma strânsă, {formatCurrency(fundAllocated)} provin din Fondul
                                            pentru alte dorințe.
                                        </p>
                                        <details className="text-teal-900">
                                            <summary className="cursor-pointer font-medium">
                                                Detaliu surse
                                            </summary>
                                            <ul className="mt-2 space-y-1 pl-1">
                                                <li>Donații directe: {formatCurrency(directDonations)}</li>
                                                <li>
                                                    Fondul pentru alte dorințe: {formatCurrency(fundAllocated)}
                                                </li>
                                                <li className="font-semibold">
                                                    Total: {formatCurrency(paid)}
                                                </li>
                                            </ul>
                                        </details>
                                        <Link href="/fond" className="inline-flex font-semibold hover:underline">
                                            Vezi fondul →
                                        </Link>
                                    </div>
                                ) : null}

                                {activeRule && (
                                    <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl mb-6 text-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-2 opacity-10">
                                            <Sparkles className="w-12 h-12 text-purple-900" />
                                        </div>
                                        <div className="font-bold text-purple-900 mb-1 flex items-center gap-2 relative z-10">
                                            <span>⚡ Matching Activ</span>
                                        </div>
                                        <p className="text-purple-800 relative z-10 leading-relaxed">
                                            Super-puterea ta e dublată! Pentru fiecare leu donat, <strong>{activeRule.sponsor.name}</strong> mai pune încă unul.
                                        </p>
                                    </div>
                                )}

                                {((!isDonationDisabled && !isFullyFunded) || ownsReservation || ownsShipment) && (
                                    <div className="mb-6 pb-6 border-b border-slate-100">
                                        <FulfillmentModule
                                            scrisoareId={letter.id}
                                            activeClaim={
                                                activeClaim
                                                    ? {
                                                          status: activeClaim.status,
                                                          ...(ownsReservation
                                                              ? {
                                                                    id: activeClaim.id,
                                                                    expiresAt: activeClaim.expiresAt.toISOString(),
                                                                }
                                                              : {}),
                                                      }
                                                    : null
                                            }
                                            shipment={
                                                ownsShipment && activeClaim?.awbProvider && activeClaim.awbNumber
                                                    ? { provider: activeClaim.awbProvider, awb: activeClaim.awbNumber }
                                                    : null
                                            }
                                            isLoggedIn={Boolean(session)}
                                            userEmail={session?.role === "DONOR" || session?.role === "SPONSOR" ? session.email : null}
                                            loginHref={`/login?returnTo=${encodeURIComponent(`/scrisori/${letter.slug || letter.id}`)}`}
                                            registerHref="/register"
                                        />
                                    </div>
                                )}

                                {isManaging ? (
                                    <PartnerActionsPanel
                                        scrisoareId={letter.id}
                                        institutionSlug={letter.institution.slug}
                                        status={letter.status}
                                        moderationStatus={letter.moderationStatus}
                                        proofApproved={letter.proofApproved}
                                    />
                                ) : isPartnerLoggedIn ? (
                                    <div className="bg-amber-50 p-8 rounded-xl text-center text-amber-800 border border-amber-200 shadow-sm">
                                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🚧</div>
                                        <h3 className="text-lg font-bold mb-2">Cont Partener Detectat</h3>
                                        <p className="text-sm mb-4">
                                            Pentru a dona, te rugăm să folosești un cont de <strong>Donator</strong> sau <strong>Sponsor</strong>.
                                            Rolul de partener este strict pentru administrarea cazurilor.
                                        </p>
                                        <form action={async () => {
                                            "use server"
                                            const { logout } = await import("@/app/actions/auth-actions")
                                            await logout()
                                        }}>
                                            <Button type="submit" variant="outline" className="w-full border-amber-300 hover:bg-amber-100 text-amber-900">
                                                Deconectează-te
                                            </Button>
                                        </form>
                                    </div>
                                ) : (
                                    <>
                                        {activeClaim ? (
                                            ownsReservation ? null : (
                                            <div className="text-center text-sm text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-100">
                                                <p className="font-medium">O familie minunată pregătește acest pachet.</p>
                                                <p className="opacity-80 mt-1">Donațiile sunt oprite temporar.</p>
                                            </div>
                                            )
                                        ) : (
                                            <>
                                                {isDonationDisabled ? (
                                                    <div className="bg-slate-50 p-8 rounded-xl text-center text-slate-500 border border-slate-200 space-y-2">
                                                        <Heart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                        <p>
                                                            {externallyFulfilled
                                                                ? "Donațiile sunt închise — dorința a fost îndeplinită extern."
                                                                : "Această dorință a fost îndeplinită sau închisă."}
                                                        </p>
                                                        {externallyFulfilled ? (
                                                            <Link
                                                                href="/fond"
                                                                className="inline-flex text-sm font-semibold text-teal-700 hover:underline"
                                                            >
                                                                Vezi Fondul pentru alte dorințe →
                                                            </Link>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <DonationModule
                                                        scrisoareId={letter.id}
                                                        remainingAmount={remaining}
                                                        isFullyFunded={isFullyFunded}
                                                        userEmail={session?.email}
                                                        userRole={session?.role}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                <p className="text-center text-xs text-slate-400 max-w-xs mx-auto mt-6">
                                    Donațiile sunt procesate securizat prin Stripe. Poți dona și anonim.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
