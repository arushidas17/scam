import { Navbar } from '../components/landing/Navbar'
import { Hero } from '../components/landing/Hero'
import { ThreatStrip } from '../components/landing/ThreatStrip'
import { HowItWorks } from '../components/landing/HowItWorks'
import { Features } from '../components/landing/Features'
import { Security } from '../components/landing/Security'
import { DashboardPreview } from '../components/landing/DashboardPreview'
import { ClosingCta } from '../components/landing/ClosingCta'
import { Footer } from '../components/landing/Footer'

export default function Landing() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]
                   focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm
                   focus:font-medium focus:text-base-950"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main">
        <Hero />
        <ThreatStrip />
        <HowItWorks />
        <Features />
        <Security />
        <DashboardPreview />
        <ClosingCta />
      </main>

      <Footer />
    </>
  )
}
