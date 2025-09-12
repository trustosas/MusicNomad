import Link from 'next/link'
import { Music } from 'lucide-react'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur-sm dark:bg-slate-900/30">
      <div className="container mx-auto px-4 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Music className="h-5 w-5" />
          <span>MusicNomad</span>
        </Link>
      </div>
    </header>
  )
}
