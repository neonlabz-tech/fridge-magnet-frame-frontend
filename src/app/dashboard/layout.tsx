'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import LayoutWrapper from '@/components/layout/LayoutWrapper'
import { DEMO_SESSION_KEY, type DemoSession } from '@/lib/demoAuth'
import { getAllowedPages, isPathAllowed, PAGE_OPTIONS } from '@/lib/roles'
import { refreshTeam } from '@/lib/teamApi'

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

  if (!checkedSession || !session) return null
  return <LayoutWrapper>{children}</LayoutWrapper>
}
