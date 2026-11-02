'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import LayoutWrapper from '@/components/layout/LayoutWrapper'
import { DEMO_SESSION_KEY, type DemoSession } from '@/lib/demoAuth'
import { getAllowedPages, isPathAllowed, PAGE_OPTIONS } from '@/lib/roles'
import { checkSignIn, refreshTeam } from '@/lib/teamApi'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<DemoSession | null>(null)
  const [checkedSession, setCheckedSession] = useState(false)
  const [teamTick, setTeamTick] = useState(0)

  // Load members/roles from the backend once (also uploads old local data the first time).
  useEffect(() => {
    let alive = true
    refreshTeam().then(() => alive && setTeamTick((t) => t + 1))
    return () => {
      alive = false
    }
  }, [])

  // Permission changes made by an admin reach open sessions when the window regains focus (and every 2 minutes).
  useEffect(() => {
    let alive = true
    const sync = () => {
      refreshTeam().then(() => alive && setTeamTick((t) => t + 1))
    }
    window.addEventListener('focus', sync)
    const timer = window.setInterval(sync, 120000)
    return () => {
      alive = false
      window.removeEventListener('focus', sync)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    // One-time cleanup of old sample records saved in this browser (runs before pages mount).
    try {
      if (localStorage.getItem('magnify-data-version') !== '2') {
        ['magnify-finance-transactions', 'magnify-crm-leads', 'magnify-crm-targets'].forEach((k) =>
          localStorage.removeItem(k)
        );
        localStorage.setItem('magnify-data-version', '2');
      }
    } catch {}
    const savedSession = localStorage.getItem(DEMO_SESSION_KEY)
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as DemoSession
        if (parsed.role === 'admin' || parsed.role === 'member') {
          if (parsed.role === 'member') {
            const pages = getAllowedPages(parsed)
            if (!isPathAllowed(pages, pathname)) {
              const first = PAGE_OPTIONS.find((p) => pages.includes(p.href))
              router.replace(first?.href ?? '/dashboard/account')
              setCheckedSession(true)
              return
            }
          }
          setSession(parsed)
          setCheckedSession(true)
          return
        }
      } catch (error) {
        console.error('Could not read the signed-in demo account.', error)
      }
    }

    setCheckedSession(true)
    router.replace('/login')
  }, [pathname, router, teamTick])

  // After a password change/reset the server revokes older sign-ins: sign out here when that happens.
  const role = session?.role
  useEffect(() => {
    if (!role) return
    let alive = true
    const verify = async () => {
      if ((await checkSignIn(role)) !== 'expired' || !alive) return
      ;['adminToken', 'memberToken', 'token', 'user', DEMO_SESSION_KEY].forEach((k) => localStorage.removeItem(k))
      document.cookie = 'demoAuth=; path=/; max-age=0; samesite=lax'
      router.replace('/login')
    }
    void verify()
    window.addEventListener('focus', verify)
    return () => {
      alive = false
      window.removeEventListener('focus', verify)
    }
  }, [role, router])

  if (!checkedSession || !session) return null
  return <LayoutWrapper>{children}</LayoutWrapper>
}
