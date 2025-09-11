export type CsvRow = Record<string, string>

function detectDelimiter(sample: string): string {
  const counts = [',', ';', '\t'].map((d) => ({ d, c: (sample.match(new RegExp(`\${d}`, 'g')) || []).length }))
  counts.sort((a, b) => b.c - a.c)
  return counts[0]?.d || ','
}

export function parseCsv(text: string): CsvRow[] {
  const trimmed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!trimmed) return []
  const delimiter = detectDelimiter(trimmed.split('\n').slice(0, 5).join('\n'))

  const rows: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    const next = trimmed[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === '\n') {
      rows.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.length) rows.push(current)

  const parseLine = (line: string): string[] => {
    const out: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      const next = line[i + 1]
      if (ch === '"') {
        if (quoted && next === '"') {
          cell += '"'
          i++
        } else {
          quoted = !quoted
        }
        continue
      }
      if (!quoted && line.slice(i, i + delimiter.length) === delimiter) {
        out.push(cell)
        cell = ''
        i += delimiter.length - 1
        continue
      }
      cell += ch
    }
    out.push(cell)
    return out
  }

  const header = parseLine(rows[0]).map((h) => h.trim())
  const dataRows = rows.slice(1)
  return dataRows
    .filter((r) => r.trim().length > 0)
    .map((r) => {
      const cols = parseLine(r)
      const obj: CsvRow = {}
      header.forEach((h, idx) => {
        obj[h] = (cols[idx] ?? '').trim()
      })
      return obj
    })
}

export function toCsv(rows: CsvRow[], delimiter = ','): string {
  if (rows.length === 0) return ''
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (val: string) => {
    const needsQuote = /["\n\r,;\t]/.test(val)
    const safe = val.replace(/"/g, '""')
    return needsQuote ? `"${safe}"` : safe
  }
  const lines = [headers.map(esc).join(delimiter)]
  for (const row of rows) {
    lines.push(headers.map((h) => esc(String(row[h] ?? ''))).join(delimiter))
  }
  return lines.join('\r\n')
}
