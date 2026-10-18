import Link from "next/link"
import prisma from "@/lib/prisma"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
// import { TrendingUp } from "lucide-react"

export default async function TransparentaPage() {
    const totalDonations = await prisma.donation.aggregate({ _sum: { amount: true, matchedAmount: true }, where: { status: 'SUCCEEDED' } })
    const countDonations = await prisma.donation.count({ where: { status: 'SUCCEEDED' } })
    const activeCampaigns = await prisma.campaign.findMany({ where: { status: 'ACTIVE' } })
    const sponsors = await prisma.sponsor.findMany()
    const updates = await prisma.update.findMany({
        where: { isPublic: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
    })

    const totalRaised = Number(totalDonations._sum.amount || 0) + Number(totalDonations._sum.matchedAmount || 0)

    return (
        <main className="min-h-screen bg-slate-50 py-12">
            <div className="container mx-auto px-4 max-w-5xl">
                <div className="mb-12">
                    <h1 className="text-3xl font-bold mb-2 text-slate-900">Transparență Radicală</h1>
                    <p className="text-slate-500">Rapoarte financiare, activitate și parteneri în timp real.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Total Direcționat</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold">{formatCurrency(totalRaised)}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Număr Donații</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold">{countDonations}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Parteneri Corporate</CardTitle></CardHeader>
                        <CardContent><div className="text-3xl font-bold">{sponsors.length}</div></CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-white p-1 border">
                        <TabsTrigger value="overview">Prezentare Generală</TabsTrigger>
                        <TabsTrigger value="campaigns">Campanii</TabsTrigger>
                        <TabsTrigger value="sponsors">Sponsori</TabsTrigger>
                        <TabsTrigger value="updates">Activitate Recentă</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <Card>
                            <CardHeader><CardTitle>Structură Costuri</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 mb-4">
                                    Platforma Visuri pe hartie operează pe un model de <strong>100% Direct to Beneficiary</strong> pentru donațiile individuale.
                                    Costurile operaționale (hosting, dezvoltare, verificare) sunt acoperite separat prin granturi și sponsorizări dedicate sau contribuții recurente specifice ("Tips").
                                </p>
                                <p className="text-sm text-slate-600 mb-4">
                                    Dacă o dorință este îndeplinită direct în afara platformei după ce au existat deja
                                    donații, sumele strânse nu dispar: sunt transferate în{" "}
                                    <Link href="/fond" className="text-teal-700 font-medium underline underline-offset-2">
                                        Fondul pentru alte dorințe
                                    </Link>{" "}
                                    și folosite exclusiv pentru alte nevoi verificate. Donațiile originale rămân în
                                    istoric; transferul este o mișcare separată, vizibilă public.
                                </p>
                                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-emerald-500 w-[95%]"></div>
                                    <div className="h-full bg-slate-400 w-[5%]"></div>
                                </div>
                                <div className="flex justify-between text-xs mt-2 text-slate-500">
                                    <span>95% Fonduri Cadouri</span>
                                    <span>Procesare plăți (Stripe)</span>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="campaigns">
                        <Card>
                            <CardHeader><CardTitle>Campanii Active</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nume</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Interval</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeCampaigns.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-medium">{c.title}</TableCell>
                                                <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Activ</Badge></TableCell>
                                                <TableCell className="text-right text-sm text-slate-500">
                                                    {new Date(c.startsAt).toLocaleDateString()} - {c.endsAt ? new Date(c.endsAt).toLocaleDateString() : 'Nedeterminat'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {activeCampaigns.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-slate-500">Nicio campanie activă momentan.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="sponsors">
                        <Card>
                            <CardHeader><CardTitle>Parteneri și Sponsori</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {sponsors.map(s => (
                                    <div key={s.id} className="border p-4 rounded text-center">
                                        <div className="font-bold">{s.name}</div>
                                        {s.website && <div className="text-xs text-slate-500">{s.website}</div>}
                                    </div>
                                ))}
                                {sponsors.length === 0 && <p className="text-slate-500 text-sm">Nu există sponsori înregistrați public momentan.</p>}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="updates">
                        <Card>
                            <CardHeader><CardTitle>Jurnal de Operațiuni</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {updates.map(u => (
                                        <div key={u.id} className="border-b pb-2 last:border-0">
                                            <div className="flex justify-between">
                                                <span className="font-medium text-sm">{u.title}</span>
                                                <span className="text-xs text-slate-400">{u.createdAt.toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">{u.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    )
}
