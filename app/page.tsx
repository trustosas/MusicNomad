import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeftRight, RefreshCw, BadgeCheck } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="relative min-h-[70vh] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <section className="container mx-auto px-4 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl bg-gradient-to-r from-[#c084fc] to-[#7c3aed] bg-clip-text text-transparent">
            Transfer and sync your music across services
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Move playlists between platforms and keep your library in sync. Import from local files and export to popular formats in a few clicks.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/transfer">Start transfer</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#features">Learn more</Link>
            </Button>
          </div>
        </div>
      </section>
      <section id="features" className="bg-[#f3e8ff] dark:bg-[#1f1029]">
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <h2 className="text-3xl font-semibold text-center mb-12">Features</h2>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-6 w-6 text-[#7c3aed]" />
                <h3 className="text-xl font-medium">Transfer</h3>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Move playlists between streaming services instantly</li>
                <li>Automatically matches songs across platforms</li>
                <li>No manual rebuilding required</li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-6 w-6 text-[#7c3aed]" />
                <h3 className="text-xl font-medium">Sync</h3>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Keep libraries updated across multiple services</li>
                <li>New additions appear everywhere automatically</li>
                <li>Works in the background continuously</li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-6 w-6 text-[#7c3aed]" />
                <h3 className="text-xl font-medium">Benefits</h3>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Never lose your music collection</li>
                <li>Switch services without starting over</li>
                <li>True music portability and freedom</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
