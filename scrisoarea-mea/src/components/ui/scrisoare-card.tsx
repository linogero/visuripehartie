import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { InDeliveryTag, ReservedHoursTag } from "@/components/letters/reserved-tag"
import { formatCurrency } from "@/lib/utils"
import { PlayCircle } from "lucide-react"

// Minimal simplified card for reuse
interface ScrisoareCardProps {
    letter: any // using any for MVP velocity, ideally Prisma type
}

export function ScrisoareCard({ letter }: ScrisoareCardProps) {
    const target = Number(letter.approvedTargetAmount ?? letter.targetAmount)
    const percent = target > 0
        ? Math.min(100, Math.round((Number(letter.collectedAmount) / target) * 100))
        : 0
    const isExternallyFulfilled =
        letter.moderationStatus === "externally_fulfilled" ||
        letter.status === "EXTERN_FULFILLED" ||
        Boolean(letter.externallyFulfilledAt)
    const isFunded =
        !isExternallyFulfilled &&
        (letter.status === "FINANTAT" ||
            letter.status === "IN_ACHIZITIE" ||
            letter.status === "LIVRAT" ||
            letter.status === "INCHIS" ||
            percent >= 100)
    const institution = letter.institution
    const isVideo = letter.mediaType === 'VIDEO'
    const claims = Array.isArray(letter.fulfillmentClaims) ? letter.fulfillmentClaims : []
    const inDelivery = claims.some((claim: { status?: string }) => claim.status === "SHIPPED" || claim.status === "COMPLETED")
    const pendingClaim = claims.find((claim: { status?: string; expiresAt?: string | Date }) => {
        if (claim.status && claim.status !== "PENDING") return false
        if (!claim.expiresAt) return false
        return new Date(claim.expiresAt).getTime() > Date.now()
    })
    const reservedUntil = !inDelivery && pendingClaim?.expiresAt ? new Date(pendingClaim.expiresAt).toISOString() : null

    return (
        <article className="bg-[var(--pastel-cream)] rounded-xl shadow-sm border border-[var(--pastel-lavender)]/30 overflow-hidden hover:shadow-md transition-all h-full flex flex-col relative group">
            <Link href={`/scrisori/${letter.slug || letter.id}`} className="absolute inset-0 z-0">
                <span className="sr-only">Citește povestea ✨</span>
            </Link>

            <div className="aspect-[16/10] bg-neutral-100 relative overflow-hidden">
                {isVideo ? (
                    <video
                        src={letter.originalImgUrl}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        muted
                        loop
                        playsInline
                        poster={letter.originalImgUrl.replace('.mp4', '_thumb.jpg')} // Optimistic attempt, fallback to first frame
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                        onMouseLeave={(e) => {
                            const v = e.target as HTMLVideoElement;
                            v.pause();
                            v.currentTime = 0;
                        }}
                    />
                ) : (
                    <img src={letter.originalImgUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={`Dorința lui ${letter.childFirstName}`} />
                )}

                {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none group-hover:opacity-0 transition-opacity duration-300">
                        <PlayCircle className="w-12 h-12 text-white/90 drop-shadow-md" />
                    </div>
                )}

                {(inDelivery || reservedUntil) && (
                    <div className="absolute top-2 left-2 z-20">
                        {inDelivery ? <InDeliveryTag /> : <ReservedHoursTag expiresAt={reservedUntil!} />}
                    </div>
                )}
                {letter.campaign && (
                    <div className="absolute top-2 right-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded z-10 shadow-sm">
                        ⚡ Dublăm bucuria
                    </div>
                )}
                {isExternallyFulfilled && (
                    <div className="absolute inset-0 bg-amber-500/25 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <span className="bg-amber-700 text-white px-3 py-1 rounded-full font-bold text-sm shadow-sm">
                            Îndeplinită extern
                        </span>
                    </div>
                )}
                {isFunded && (
                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <span className="bg-emerald-600 text-white px-3 py-1 rounded-full font-bold text-sm shadow-sm flex items-center gap-1">
                            ✨ Dorință împlinită
                        </span>
                    </div>
                )}
            </div>
            <div className="p-5 flex-1 flex flex-col z-10 relative pointer-events-none">
                <div className="mb-4">
                    <div className="flex justify-between items-start mb-2 pointer-events-auto">
                        <Link href={`/scrisori/${letter.slug || letter.id}`} className="font-bold text-lg hover:underline decoration-slate-300 underline-offset-4 text-slate-900">
                            {letter.childFirstName}, {letter.childAge} ani
                        </Link>
                        <Badge variant="secondary" className="text-xs border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200">{letter.category}</Badge>
                    </div>

                    {/* Partner Line */}
                    {institution && (
                        <div className="text-xs text-slate-500 mb-3 flex items-center gap-1 pointer-events-auto">
                            <span>Poveste adusă de</span>
                            {institution.slug ? (
                                <Link href={`/partener/${institution.slug}`} className="font-medium text-slate-700 hover:text-blue-600 hover:underline">
                                    {institution.publicName || institution.name}
                                </Link>
                            ) : (
                                <span className="font-medium text-slate-700">{institution.publicName || institution.name}</span>
                            )}
                            {institution.verified && (
                                <span className="inline-block w-3 h-3 text-blue-500" title="Organizație Verificată">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                </span>
                            )}
                        </div>
                    )}

                    <p className="text-slate-600 text-sm line-clamp-2 mb-4 leading-relaxed font-normal">"{letter.childStory || "O poveste specială..."}"</p>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                        <div className="bg-emerald-500 h-full transition-all duration-1000 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span className="text-slate-900">{formatCurrency(Number(letter.collectedAmount))}</span>
                        <span>necesar {formatCurrency(target)}</span>
                    </div>
                    {isExternallyFulfilled && Number(letter.collectedAmount) > 0 ? (
                        <p className="text-[11px] text-amber-800 mt-2 leading-snug">
                            {formatCurrency(Number(letter.collectedAmount))} strânși înainte de
                            îndeplinirea externă. Suma a fost transferată în Fondul pentru alte dorințe.
                        </p>
                    ) : null}
                </div>

                <div className="mt-auto pt-2 pointer-events-auto">
                    <Link href={`/scrisori/${letter.slug || letter.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group/link">
                        Citește povestea <span className="group-hover/link:translate-x-0.5 transition-transform">→</span>
                    </Link>
                </div>
            </div>
        </article>
    )
}
