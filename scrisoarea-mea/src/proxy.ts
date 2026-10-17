import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

function withPathname(request: NextRequest, options?: { noStore?: boolean }) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-pathname", request.nextUrl.pathname)
    const response = NextResponse.next({
        request: { headers: requestHeaders },
    })
    if (options?.noStore) {
        response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate")
        response.headers.set("Pragma", "no-cache")
    }
    return response
}

const SEO_PATHS = new Set([
    "/robots.txt",
    "/sitemap.xml",
    "/sitemaps.xml",
    "/llms.txt",
    "/llms-full.txt",
    "/ai.txt",
    "/manifest.webmanifest",
])

function isApexHost(host: string) {
    return host.split(":")[0].toLowerCase() === "visuripehartie.ro"
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const host = request.headers.get("host") || ""

    if (isApexHost(host) && !SEO_PATHS.has(pathname)) {
        const url = request.nextUrl.clone()
        url.hostname = "www.visuripehartie.ro"
        url.protocol = "https:"
        url.port = ""
        return NextResponse.redirect(url, 308)
    }

    const needsAuth =
        pathname.startsWith("/admin") ||
        pathname.startsWith("/partner") ||
        pathname.startsWith("/profil")

    if (!needsAuth) {
        return withPathname(request)
    }

    const publicPartner = [
        "/partner/login",
        "/partner/register",
    ]
    const publicAdmin = ["/admin/login"]
    const publicAuth = [
        "/login",
        "/register",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
    ]

    if (
        publicPartner.includes(pathname) ||
        publicAdmin.includes(pathname) ||
        publicAuth.includes(pathname)
    ) {
        return withPathname(request)
    }

    const session = await auth.api.getSession({ headers: request.headers })
    const role = (session?.user as { role?: string } | undefined)?.role
    const emailVerified = Boolean(session?.user?.emailVerified)

    if (pathname.startsWith("/admin")) {
        if (!session) {
            return NextResponse.redirect(new URL("/admin/login", request.url))
        }
        if (role !== "ADMIN") {
            return NextResponse.redirect(new URL("/admin/login?error=AccessDenied", request.url))
        }
        return withPathname(request)
    }

    if (pathname.startsWith("/partner")) {
        if (!session) {
            return NextResponse.redirect(new URL("/partner/login", request.url))
        }
        if (role !== "PARTNER") {
            return NextResponse.redirect(new URL("/partner/login", request.url))
        }
        if (!emailVerified && pathname !== "/partner/pending-approval") {
            return NextResponse.redirect(new URL("/verify-email?portal=partner", request.url))
        }
        return withPathname(request, { noStore: true })
    }

    if (pathname.startsWith("/profil")) {
        if (!session) {
            const login = new URL("/login", request.url)
            login.searchParams.set("returnTo", pathname)
            return NextResponse.redirect(login)
        }
        if (role !== "DONOR" && role !== "SPONSOR") {
            return NextResponse.redirect(new URL("/", request.url))
        }
        if (!emailVerified) {
            return NextResponse.redirect(new URL("/verify-email", request.url))
        }
        return withPathname(request)
    }

    return withPathname(request)
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|sitemaps\\.xml|llms\\.txt|llms-full\\.txt|ai\\.txt|manifest\\.webmanifest).*)",
    ],
}
