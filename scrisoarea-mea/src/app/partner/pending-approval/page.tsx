import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { PartnerLogoutButton } from "@/components/partner/partner-logout-button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

export default async function PartnerPendingApprovalPage() {
    const session = await getSession()

    if (!session || session.role !== "PARTNER") {
        redirect("/partner/login")
    }

    if (!session.institutionId) {
        redirect("/partner/register")
    }

    const institution = await prisma.institution.findUnique({
        where: { id: session.institutionId },
        select: {
            name: true,
            county: true,
            city: true,
            verified: true,
        },
    })

    if (!institution) {
        redirect("/partner/register")
    }

    if (institution.verified) {
        redirect("/partner")
    }

    const location = [institution.county, institution.city].filter(Boolean).join(", ")

    return (
        <main className="min-h-screen flex items-center justify-center bg-[var(--pastel-sage)]/30 px-4 py-16">
            <Card className="max-w-lg w-full bg-white">
                <CardHeader>
                    <CardTitle className="text-2xl text-slate-900">
                        Contul instituției este în curs de verificare.
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-sm leading-relaxed">
                        Emailul tău este confirmat. Un administrator trebuie să aprobe instituția
                        înainte de a publica scrisori pe platformă. Vei putea accesa portalul după
                        aprobare.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-slate-50 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                    Instituție
                                </p>
                                <p className="font-semibold text-slate-900">{institution.name}</p>
                                {location && (
                                    <p className="text-sm text-slate-600 mt-1">{location}</p>
                                )}
                            </div>
                            <Badge
                                variant="outline"
                                className="border-amber-200 bg-amber-50 text-amber-800"
                            >
                                Neverificat
                            </Badge>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600">
                        Cont conectat: <span className="font-medium text-slate-800">{session.email}</span>
                    </p>
                </CardContent>
                <CardFooter>
                    <PartnerLogoutButton variant="outline" size="default" />
                </CardFooter>
            </Card>
        </main>
    )
}
