'use client'

import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { Music } from 'lucide-react'
import { useState } from 'react'

export const dynamic = 'force-static'

function SpotifyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5 22.5 17.799 22.5 12 17.799 1.5 12 1.5zm5.137 14.639a.937.937 0 0 1-1.289.31c-3.53-2.157-7.978-2.645-13.215-1.451a.937.937 0 1 1-.404-1.829c5.646-1.248 10.534-.694 14.39 1.658a.937.937 0 0 1 .518 1.312zm1.725-3.357a1.171 1.171 0 0 1-1.611.388c-4.043-2.47-10.22-3.192-14.998-1.75a1.171 1.171 0 1 1-.694-2.244c5.391-1.667 12.267-.856 16.866 1.922.55.335.723 1.05.437 1.684zM19.1 8.63a1.406 1.406 0 0 1-1.934.468c-4.629-2.819-12.133-3.075-16.438-1.685a1.406 1.406 0 1 1-.824-2.698c5.009-1.53 13.274-1.232 18.567 2.002.67.408.884 1.306.63 1.913z"
      />
    </svg>
  )
}

export default function ActionPage() {
  const [mode, setMode] = useState<'transfer' | 'sync'>('transfer')
  const [source, setSource] = useState<'spotify' | null>(null)

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
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md ${svc.enabled ? 'text-[#1DB954]' : 'text-slate-400'}`}>
                    {isSpotify ? (
                      <SpotifyIcon className="h-6 w-6" />
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
