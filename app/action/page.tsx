'use client'

import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { Music } from 'lucide-react'
import { useState } from 'react'

export const dynamic = 'force-static'


export default function ActionPage() {
  const [mode, setMode] = useState<'transfer' | 'sync'>('transfer')
  const [source, setSource] = useState<'spotify' | null>(null)

  const ICONS: Record<'spotify' | 'apple' | 'youtube' | 'tidal' | 'deezer' | 'amazon', string> = {
    spotify: 'https://www.tunemymusic.com/images/platformsLogo/color/Spotify.svg',
    apple: 'https://www.tunemymusic.com/images/platformsLogo/color/Apple.svg',
    youtube: 'https://www.tunemymusic.com/images/platformsLogo/color/YouTubeMediaConnect.svg',
    tidal: 'https://www.tunemymusic.com/images/platformsLogo/color/Tidal.svg',
    deezer: 'https://www.tunemymusic.com/images/platformsLogo/color/Deezer.svg',
    amazon: 'https://www.tunemymusic.com/images/platformsLogo/color/Amazon.svg',
  }

  const services: { id: 'spotify' | 'apple' | 'youtube' | 'tidal' | 'deezer' | 'amazon'; name: string; enabled: boolean }[] = [
    { id: 'spotify', name: 'Spotify', enabled: true },
    { id: 'apple', name: 'Apple Music', enabled: false },
    { id: 'youtube', name: 'YouTube Music', enabled: false },
    { id: 'tidal', name: 'TIDAL', enabled: false },
    { id: 'deezer', name: 'Deezer', enabled: false },
    { id: 'amazon', name: 'Amazon Music', enabled: false },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-center">
          <ToggleGroup.Root
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as 'transfer' | 'sync')}
            aria-label="Action mode"
            className="inline-flex rounded-full border bg-white/70 p-1 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/40"
          >
            <ToggleGroup.Item
              value="transfer"
              className="rounded-full px-5 py-2 text-sm font-medium text-slate-700 transition-colors data-[state=on]:bg-[#7c3aed] data-[state=on]:text-white dark:text-slate-200"
            >
              Transfer
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="sync"
              className="rounded-full px-5 py-2 text-sm font-medium text-slate-700 transition-colors data-[state=on]:bg-[#7c3aed] data-[state=on]:text-white dark:text-slate-200"
            >
              Sync
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>

        <div className="mx-auto mt-12 max-w-xl text-center">
          <h2 className="text-2xl font-semibold">Step 1: Select the source streaming service</h2>
          <p className="mt-2 text-sm text-muted-foreground">Only Spotify is available in this MVP. Others are coming soon.</p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {services.map((svc) => {
              const isSpotify = svc.id === 'spotify'
              const isSelected = source === svc.id
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => {
                    if (svc.enabled) setSource('spotify')
                  }}
                  disabled={!svc.enabled}
                  className={[
                    'group flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                    'bg-white/70 backdrop-blur-sm dark:bg-slate-900/40 dark:border-slate-800',
                    svc.enabled ? 'hover:border-[#7c3aed] focus-visible:border-[#7c3aed] focus-visible:ring-[#7c3aed]/40 focus-visible:ring-[3px] outline-none' : 'opacity-50 grayscale cursor-not-allowed',
                    isSelected ? 'ring-2 ring-[#7c3aed]/60 border-[#7c3aed]' : '',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md">
                    {ICONS[svc.id] ? (
                      // Using TuneMyMusic icon URLs as requested
                      <img src={ICONS[svc.id]} alt={svc.name} className="h-6 w-6 object-contain" />
                    ) : (
                      <Music className="h-6 w-6" />
                    )}
                  </span>
                  <span className="text-sm font-medium">{svc.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
