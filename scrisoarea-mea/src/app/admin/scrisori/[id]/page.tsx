import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { parseWishlistItems, sumSubmittedEstimates } from "@/lib/letter-items"
import { publicTargetAmount } from "@/lib/letter-moderation"
import AdminLetterModerationForm from "./moderation-form"
import { ExternalFulfillmentPanel } from "@/components/admin/external-fulfillment-panel"

export default async function AdminScrisoareDetail({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const letter = await prisma.scrisoare.findUnique({
        where: { id },
        include: { institution: true },
    })

    if (!letter) notFound()

    const items = parseWishlistItems(letter.items)
    const submittedTarget =
        Number(letter.submittedTargetAmount) || sumSubmittedEstimates(items)
    const target = publicTargetAmount(letter)
    const collected = Number(letter.collectedAmount)

    return (
        <div className="space-y-6">
            <ExternalFulfillmentPanel
                preview={{
                    id: letter.id,
                    childFirstName: letter.childFirstName,
                    institutionName:
                        letter.institution.publicName || letter.institution.name,
                    target,
                    collected,
                    alreadyExternallyFulfilled:
                        letter.moderationStatus === "externally_fulfilled" ||
                        letter.status === "EXTERN_FULFILLED" ||
                        Boolean(letter.externallyFulfilledAt),
                    isFullyFunded: collected >= target && collected > 0,
                }}
            />
            <AdminLetterModerationForm
                letter={{
                    id: letter.id,
                    childFirstName: letter.childFirstName,
                    childAge: letter.childAge,
                    childStory: letter.childStory,
                    category: letter.category,
                    partnerNotes: letter.partnerNotes,
                    adminNotes: letter.adminNotes,
                    originalImgUrl: letter.originalImgUrl,
                    mediaType: letter.mediaType,
                    publicCode: letter.publicCode,
                    moderationStatus: letter.moderationStatus,
                    submittedTargetAmount: submittedTarget,
                    approvedTargetAmount:
                        letter.approvedTargetAmount != null
                            ? Number(letter.approvedTargetAmount)
                            : null,
                    createdAt: letter.createdAt.toISOString(),
                    items,
                    institution: {
                        name: letter.institution.name,
                        cui: letter.institution.cui || "",
                        contactName: letter.institution.contactName,
                        contactEmail: letter.institution.contactEmail,
                    },
                }}
            />
        </div>
    )
}
