'use client'

import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { Check } from 'lucide-react'
import { useState } from 'react'

export const dynamic = 'force-static'


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

  const steps: { label: string }[] = [
    { label: 'Select source' },
    { label: 'Select destination' },
    { label: 'Review details' },
    { label: 'Start transfer' },
  ]
  const current = 0

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

        {/* Flow widget: step circles */}
        <div className="mx-auto mt-10 max-w-2xl px-2">
          <div className="relative">
            <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[2px] rounded bg-slate-300 dark:bg-slate-700" aria-hidden />
            <div
              className="absolute left-4 top-1/2 -translate-y-1/2 h-[2px] rounded bg-[#7c3aed]"
              style={{ width: `${(current / (steps.length - 1)) * 100}%` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={steps.length - 1}
              aria-valuenow={current}
              aria-label="Step progress"
            />
            <ol className="relative z-10 flex items-center justify-between gap-3 text-[11px]">
              {steps.map((s, i) => {
                const state = i < current ? 'complete' : i === current ? 'current' : 'upcoming'
                return (
                  <li key={s.label} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center text-center">
                      <div
                        className={[
                          'flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-medium',
                          state === 'current'
                            ? 'bg-[#7c3aed] text-white border-[#7c3aed]'
                            : state === 'complete'
                            ? 'bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]/40'
                            : 'bg-white/70 text-slate-600 border-slate-300 backdrop-blur-sm dark:bg-slate-900/40 dark:border-slate-700 dark:text-slate-300',
                        ].join(' ')}
                        aria-current={state === 'current' ? 'step' : undefined}
                      >
                        {state === 'complete' ? (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>
                      <span className="mt-1 whitespace-nowrap text-[11px] text-slate-600 dark:text-slate-300">
                        {s.label}
                      </span>
                      <div className="mt-1.5 flex flex-col items-center gap-[2px]" aria-hidden>
                        <span className={[
                          'block h-[3px] w-8 rounded-full',
                          state === 'current' ? 'bg-[#7c3aed]' : state === 'complete' ? 'bg-[#7c3aed]' : 'bg-slate-300 dark:bg-slate-700',
                        ].join(' ')} />
                        <span className={[
                          'block h-[3px] w-6 rounded-full',
                          state === 'current' ? 'bg-[#7c3aed]/60' : state === 'complete' ? 'bg-[#7c3aed]' : 'bg-slate-300 dark:bg-slate-700',
                        ].join(' ')} />
                        <span className={[
                          'block h-[3px] w-4 rounded-full',
                          state === 'current' ? 'bg-[#7c3aed]/30' : state === 'complete' ? 'bg-[#7c3aed]' : 'bg-slate-300 dark:bg-slate-700',
                        ].join(' ')} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-xl text-center">
          <p className="mt-2 text-sm text-muted-foreground">Only Spotify is available in this MVP. Others are coming soon.</p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {services.map((svc) => {
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
                    'group flex items-center justify-center rounded-lg border p-4 text-center transition-colors',
                    'bg-white/70 backdrop-blur-sm dark:bg-slate-900/40 dark:border-slate-800',
                    svc.enabled ? 'hover:border-[#7c3aed] focus-visible:border-[#7c3aed] focus-visible:ring-[#7c3aed]/40 focus-visible:ring-[3px] outline-none' : 'opacity-50 grayscale cursor-not-allowed',
                    isSelected ? 'ring-2 ring-[#7c3aed]/60 border-[#7c3aed]' : '',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  <span className={`service-icon service-icon--${svc.id}`} aria-hidden="true" />
                  <span className="sr-only">{svc.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
