"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

type PartnerLogoutButtonProps = {
    variant?: "ghost" | "outline" | "default"
    size?: "sm" | "default" | "lg"
    className?: string
}

/**
 * Partner portal logout: clears Better Auth session on the client,
 * then hard-navigates home so RSC/bfcache cannot keep an authenticated view.
 */
export function PartnerLogoutButton({
    variant = "ghost",
    size = "sm",
    className,
}: PartnerLogoutButtonProps) {
    const [pending, setPending] = useState(false)

    async function handleLogout() {
        if (pending) return
        setPending(true)
        try {
            await authClient.signOut()
        } catch (error) {
            console.error("Partner signOut failed", error)
        } finally {
            window.location.assign("/")
        }
    }

    return (
        <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            disabled={pending}
            onClick={handleLogout}
        >
            {pending ? "Se deconectează..." : "Deconectare"}
        </Button>
    )
}
