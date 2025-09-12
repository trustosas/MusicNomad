import Link from 'next/link'
import { Music, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/site/ThemeToggle'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur-sm dark:bg-slate-900/30">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Music className="h-5 w-5" />
          <span>MusicNomad</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Settings">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
