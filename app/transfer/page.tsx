import TransferWizard from '@/components/transfer/TransferWizard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-static'

export default function TransferPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-16 space-y-8">
        <Card className="max-w-3xl mx-auto border-0 shadow-lg bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">TuneMyMusic – Clone</CardTitle>
            <CardDescription>Transfer playlists between services (local import/export included)</CardDescription>
          </CardHeader>
          <CardContent>
            <TransferWizard />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
