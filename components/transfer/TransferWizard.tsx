"use client"
import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Download, PlayCircle } from 'lucide-react'
import type { DestinationServiceAdapter, Playlist, SourceServiceAdapter, Track, TransferResult } from '@/lib/transfer/types'
import { createAvailableServices, CsvFileExportService, CsvFileImportService, JsonFileImportService, M3UExportService, MockMusicService } from '@/lib/transfer/mockServices'

function useServices() {
  const [{ sourceServices, destinationServices }] = React.useState(createAvailableServices())
  return { sourceServices, destinationServices }
}

function useStepNavigation(total: number) {
  const [step, setStep] = React.useState(0)
  const next = () => setStep((s) => Math.min(total - 1, s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))
  const go = (n: number) => setStep(() => Math.max(0, Math.min(total - 1, n)))
  return { step, next, prev, go }
}

type Selected = {
  source?: SourceServiceAdapter
  destination?: DestinationServiceAdapter
  playlist?: Playlist
  tracks: Track[]
}

export default function TransferWizard() {
  const { sourceServices, destinationServices } = useServices()
  const { step, next, prev, go } = useStepNavigation(5)
  const [selected, setSelected] = React.useState<Selected>({ tracks: [] })
  const [logs, setLogs] = React.useState<string[]>([])
  const [result, setResult] = React.useState<TransferResult | null>(null)

  const appendLog = (line: string) => setLogs((l) => [...l, line])

  const startAuthSource = async (svc: SourceServiceAdapter) => {
    await svc.signIn();
    setSelected((s) => ({ ...s, source: svc }))
    if (svc instanceof CsvFileImportService || svc instanceof JsonFileImportService) {
      go(1)
    } else {
      go(2)
    }
  }

  const handleSourceFile = async (file: File) => {
    const svc = selected.source
    if (svc && svc instanceof CsvFileImportService) {
      await svc.importFile(file)
    }
    if (svc && svc instanceof JsonFileImportService) {
      await svc.importFile(file)
    }
    const pls = await svc!.listPlaylists()
    setSelected((s) => ({ ...s, playlist: pls[0], tracks: pls[0]?.tracks || [] }))
    go(2)
  }

  const pickPlaylist = async (pl: Playlist) => {
    const svc = selected.source!
    const tracks = await svc.getPlaylistTracks(pl.id)
    setSelected((s) => ({ ...s, playlist: pl, tracks }))
    go(3)
  }

  const startAuthDestination = async (svc: DestinationServiceAdapter) => {
    await svc.signIn()
    setSelected((s) => ({ ...s, destination: svc }))
    go(4)
  }

  const runTransfer = async () => {
    if (!selected.source || !selected.destination || !selected.playlist) return
    setLogs([])
    setResult(null)
    appendLog(`Creating playlist '${selected.playlist.name}' in destination...`)
    const created = await selected.destination.createPlaylist(selected.playlist.name, selected.playlist.description)
    appendLog(`Adding ${selected.tracks.length} tracks...`)
    const add = await selected.destination.addTracks(created.id, selected.tracks)
    let artifacts: TransferResult['artifacts'] = []
    if (selected.destination instanceof CsvFileExportService) {
      const arts = selected.destination.getArtifacts()
      artifacts = arts.map((a) => ({ label: 'CSV', filename: a.name, mime: a.mime, data: a.data }))
    }
    if (selected.destination instanceof M3UExportService) {
      const arts = selected.destination.getArtifacts()
      artifacts = arts.map((a) => ({ label: 'M3U', filename: a.name, mime: a.mime, data: a.data }))
    }
    const res: TransferResult = { createdPlaylistId: created.id, added: add.added, failed: [], artifacts, logs: [] }
    setResult(res)
    appendLog(`Done. Added ${add.added} tracks.`)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Transfer Playlists</CardTitle>
          <CardDescription>Move playlists between sources and destinations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant={step === 0 ? 'default' : 'secondary'}>1. Source</Badge>
            <Badge variant={step === 1 ? 'default' : 'secondary'}>2. Import</Badge>
            <Badge variant={step === 2 ? 'default' : 'secondary'}>3. Playlist</Badge>
            <Badge variant={step === 3 ? 'default' : 'secondary'}>4. Destination</Badge>
            <Badge variant={step === 4 ? 'default' : 'secondary'}>5. Transfer</Badge>
          </div>

          {step === 0 && (
            <ServicePicker
              title="Choose source"
              description="Sign in or select a local file"
              services={sourceServices}
              onPick={startAuthSource}
            />
          )}

          {step === 1 && (
            <FileImport
              service={selected.source}
              onFile={handleSourceFile}
              onBack={prev}
            />
          )}

          {step === 2 && (
            <PlaylistStep
              source={selected.source!}
              selected={selected.playlist}
              onPick={pickPlaylist}
              onBack={prev}
            />
          )}

          {step === 3 && (
            <ServicePicker
              title="Choose destination"
              description="Select where to export"
              services={destinationServices}
              onPick={startAuthDestination}
              onBack={prev}
            />
          )}

          {step === 4 && (
            <TransferStep
              tracks={selected.tracks}
              playlistName={selected.playlist?.name || ''}
              onRun={runTransfer}
              onBack={prev}
              result={result}
              logs={logs}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ServicePicker({ title, description, services, onPick, onBack }: {
  title: string
  description: string
  services: (SourceServiceAdapter | DestinationServiceAdapter)[]
  onPick: (svc: any) => void
  onBack?: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((svc) => (
          <button key={svc.id} onClick={() => onPick(svc)} className="rounded-xl border p-4 text-left hover:bg-accent transition-colors">
            <div className="font-medium">{svc.displayName}</div>
            <div className="text-xs text-muted-foreground">{svc.kind === 'source' || (svc as any).listPlaylists ? 'Source' : 'Destination'}</div>
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        {onBack ? (
          <Button variant="outline" onClick={onBack}><ChevronLeft className="size-4" /> Back</Button>
        ) : <span />}
      </div>
    </div>
  )
}

function FileImport({ service, onFile, onBack }: { service?: SourceServiceAdapter; onFile: (f: File) => void; onBack: () => void }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const accept = service instanceof CsvFileImportService ? '.csv,.tsv' : service instanceof JsonFileImportService ? '.json' : undefined
  return (
    <div className="space-y-6">
      <div>
        <div className="text-lg font-semibold">Import from file</div>
        <div className="text-sm text-muted-foreground">Upload a file to import tracks</div>
      </div>
      <div className="rounded-xl border p-6 text-center">
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }} />
        <Button onClick={() => ref.current?.click()}>
          <Download className="size-4" /> Choose file
        </Button>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ChevronLeft className="size-4" /> Back</Button>
      </div>
    </div>
  )
}

function PlaylistStep({ source, selected, onPick, onBack }: { source: SourceServiceAdapter; selected?: Playlist; onPick: (pl: Playlist) => void; onBack: () => void }) {
  const [playlists, setPlaylists] = React.useState<Playlist[]>([])
  React.useEffect(() => {
    source.listPlaylists().then(setPlaylists)
  }, [source])
  return (
    <div className="space-y-6">
      <div>
        <div className="text-lg font-semibold">Choose playlist</div>
        <div className="text-sm text-muted-foreground">Select the playlist to transfer</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {playlists.map((pl) => (
          <button key={pl.id} onClick={() => onPick(pl)} className="rounded-xl border p-4 text-left hover:bg-accent transition-colors">
            <div className="font-medium">{pl.name}</div>
            <div className="text-xs text-muted-foreground">{pl.tracks?.length || 0} tracks</div>
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ChevronLeft className="size-4" /> Back</Button>
      </div>
    </div>
  )
}

function TransferStep({ tracks, playlistName, onRun, onBack, result, logs }: { tracks: Track[]; playlistName: string; onRun: () => void; onBack: () => void; result: TransferResult | null; logs: string[] }) {
  const [running, setRunning] = React.useState(false)
  const run = async () => { setRunning(true); await onRun(); setRunning(false) }
  return (
    <div className="space-y-6">
      <div>
        <div className="text-lg font-semibold">Confirm and transfer</div>
        <div className="text-sm text-muted-foreground">Playlist: {playlistName} • {tracks.length} tracks</div>
      </div>
      <div className="rounded-xl border p-4 max-h-40 overflow-auto text-sm">
        {logs.length === 0 ? <div className="text-muted-foreground">No logs yet</div> : logs.map((l, i) => (<div key={i}>{l}</div>))}
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}><ChevronLeft className="size-4" /> Back</Button>
        <Button onClick={run} disabled={running}>
          <PlayCircle className="size-4" /> {running ? 'Transferring...' : 'Run transfer'}
        </Button>
      </div>
      {result && result.artifacts && result.artifacts.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium">Downloads</div>
          <div className="flex flex-wrap gap-3">
            {result.artifacts.map((a, idx) => (
              <a key={idx} download={a.filename} href={createDownloadUrl(a.data, a.mime)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
                {a.label}: {a.filename}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function createDownloadUrl(data: string | Blob, mime: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data
  return URL.createObjectURL(blob)
}
