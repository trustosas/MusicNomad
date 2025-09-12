import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <main className="relative min-h-[70vh] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <section className="container mx-auto px-4 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
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
              <Link href="/transfer">Learn more</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
