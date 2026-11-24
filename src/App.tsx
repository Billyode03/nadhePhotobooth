import { useEffect } from 'react'
import { findFrame } from './config/frames'
import { BoothPage } from './booth/BoothPage'
import { parseRoute, usePathname } from './lib/router'
import { InvalidQrPage } from './pages/InvalidQrPage'
import { PanitiaPage } from './pages/PanitiaPage'
import { WelcomePage } from './pages/WelcomePage'

export default function App() {
  const route = parseRoute(usePathname().split('?')[0])
  const lookup = route.name === 'booth' ? findFrame(route.slug) : null

  useEffect(() => {
    document.title = lookup?.status === 'ok' ? `${lookup.frame.name} — MyPhotobooth` : 'MyPhotobooth'
  }, [lookup])

  switch (route.name) {
    case 'welcome':
      return <WelcomePage />
    case 'panitia':
      return <PanitiaPage />
    case 'booth':
      if (lookup?.status === 'ok') return <BoothPage key={lookup.frame.id} frame={lookup.frame} />
      if (lookup?.status === 'disabled') return <InvalidQrPage kind="disabled" detail={lookup.frame.name} />
      return <InvalidQrPage kind="unknown" detail={route.slug} />
    default:
      return <InvalidQrPage kind="notfound" />
  }
}
