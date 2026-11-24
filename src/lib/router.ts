// Tiny pathname router (no dependency): the app only has three routes.
import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'welcome' }
  | { name: 'booth'; slug: string }
  | { name: 'panitia' }
  | { name: 'notfound'; path: string }

export function parseRoute(pathname: string): Route {
  const path = decodeURIComponent(pathname).replace(/\/+$/, '') || '/'
  if (path === '/') return { name: 'welcome' }
  if (path === '/panitia' || path === '/qr') return { name: 'panitia' }
  const booth = /^\/booth\/([^/]+)$/i.exec(path)
  if (booth) return { name: 'booth', slug: booth[1] }
  if (/^\/booth$/i.test(path)) {
    // Also accept /booth?frame=romantic for QR generators that prefer query strings.
    const q = new URLSearchParams(window.location.search).get('frame')
    if (q) return { name: 'booth', slug: q }
  }
  return { name: 'notfound', path }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb)
  return () => window.removeEventListener('popstate', cb)
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search)
}

export function navigate(to: string, replace = false) {
  if (replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
