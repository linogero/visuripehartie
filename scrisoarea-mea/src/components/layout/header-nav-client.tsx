"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { User, Menu, X, LogOut, LayoutDashboard } from "lucide-react"
import { logout, logoutAdmin } from "@/app/actions/auth-actions"
import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const NAV_LINKS = [
  { href: "/scrisori", label: "Scrisori" },
  { href: "/cum-functioneaza", label: "Cum funcționează" },
  { href: "/impact", label: "Impact" },
  { href: "/transparenta", label: "Transparență" },
  { href: "/despre", label: "Despre" },
]

type Session = {
  email: string
  role: "ADMIN" | "PARTNER" | "DONOR" | "SPONSOR"
} | null

export function HeaderNavClient({ session }: { session: Session }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = drawerRef.current
    if (!el) return
    const focusables = el.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    first?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else if (document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    el.addEventListener("keydown", onKey)
    return () => el.removeEventListener("keydown", onKey)
  }, [open])

  async function handleLogout() {
    if (session?.role === "PARTNER") {
      try {
        await authClient.signOut()
      } catch (error) {
        console.error("Partner signOut failed", error)
      }
      window.location.assign("/")
      return
    }
    if (session?.role === "ADMIN") await logoutAdmin()
    else await logout()
  }

  return (
    <>
      <nav className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium text-slate-600">
        {NAV_LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className="hover:text-teal-600 transition-colors py-2">
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="hidden md:inline-flex items-center gap-2 text-slate-700 hover:text-teal-600 bg-slate-100/80 hover:bg-teal-50 px-4 py-2 rounded-full border border-slate-200/80 min-h-[44px] transition-colors"
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="max-w-[120px] truncate">{session.email.split("@")[0]}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Contul meu</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {session.role === "ADMIN" && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}

              {session.role === "PARTNER" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/partner" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Portal Instituție
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/partner" className="cursor-pointer">
                      Scrisorile mele
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              {(session.role === "DONOR" || session.role === "SPONSOR") && (
                <DropdownMenuItem asChild>
                  <Link href="/profil" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profilul meu
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Ieșire din cont
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button
              asChild
              className="md:hidden shrink-0 bg-[var(--brand)] hover:bg-teal-600 text-[var(--brand-foreground)] shadow-md shadow-teal-900/15 rounded-full px-3.5 min-h-10 h-10 font-semibold text-sm"
            >
              <Link href="/login">Cont</Link>
            </Button>
            <div className="hidden md:flex items-center gap-2">
              <Button asChild variant="ghost" className="text-slate-600 hover:text-teal-700 min-h-[44px]">
                <Link href="/partner/login">Portal Instituții</Link>
              </Button>
              <Button
                asChild
                className="bg-[var(--brand)] hover:bg-teal-600 text-[var(--brand-foreground)] shadow-md shadow-teal-900/15 rounded-full px-5 sm:px-6 min-h-[44px] font-semibold text-sm"
              >
                <Link href="/login">Intră în cont</Link>
              </Button>
            </div>
          </>
        )}

        <button
          type="button"
          aria-label="Deschide meniul"
          aria-expanded={open}
          className="md:hidden flex items-center justify-center w-11 h-11 shrink-0 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          onClick={() => setOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] md:hidden"
            aria-modal="true"
            role="dialog"
            aria-label="Meniu navigare"
          >
            <button
              type="button"
              aria-label="Închide meniul"
              className="absolute inset-0 z-0 bg-slate-900/40"
              onClick={() => setOpen(false)}
            />
            <div
              ref={drawerRef}
              className="absolute right-0 top-0 bottom-0 z-10 flex h-dvh w-full max-w-sm flex-col border-l border-slate-200 bg-white p-6 pt-8 shadow-2xl"
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="text-lg font-bold text-slate-800">Meniu</span>
                <button
                  type="button"
                  aria-label="Închide"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex min-h-[44px] items-center rounded-lg px-3 py-3 font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => setOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-6">
                {session ? (
                  <>
                    {session.role === "ADMIN" && (
                      <Link
                        href="/admin"
                        className="rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-100"
                        onClick={() => setOpen(false)}
                      >
                        Admin Panel
                      </Link>
                    )}
                    {session.role === "PARTNER" && (
                      <Link
                        href="/partner"
                        className="rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-100"
                        onClick={() => setOpen(false)}
                      >
                        Portal Instituție
                      </Link>
                    )}
                    {(session.role === "DONOR" || session.role === "SPONSOR") && (
                      <Link
                        href="/profil"
                        className="rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-100"
                        onClick={() => setOpen(false)}
                      >
                        Profilul meu
                      </Link>
                    )}
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        await handleLogout()
                        setOpen(false)
                      }}
                    >
                      <LogOut className="h-4 w-4" /> Ieșire din cont
                    </button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline" className="min-h-[44px] w-full">
                      <Link href="/partner/login" onClick={() => setOpen(false)}>
                        Portal Instituții
                      </Link>
                    </Button>
                    <Button
                      asChild
                      className="min-h-[44px] w-full rounded-full bg-[var(--brand)] font-semibold text-[var(--brand-foreground)] hover:bg-teal-600"
                    >
                      <Link href="/login" onClick={() => setOpen(false)}>
                        Intră în cont
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
