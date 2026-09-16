export type Trail = {
  goal: string
  status: 'ok' | 'drifting' | 'fatal'
  sentence: string
  decisions: { turn: number; label: string; direction: 'toward' | 'sideways' | 'away'; why: string; agent?: string }[]
  fatal_turn: number | null
}

const STATUS_FACE: Record<Trail['status'], string> = {
  ok: '🟢😊',
  drifting: '🟡😰',
  fatal: '🔴💀',
}

const DIRECTION_ICON: Record<Trail['decisions'][number]['direction'], string> = {
  toward: '✅',
  sideways: '↔️',
  away: '❌',
}

export function renderGateMarkdown(trail: Trail, opts: { file: string; model: string }): string {
  const lines: string[] = []

  lines.push(`## ${STATUS_FACE[trail.status]} Tamabotchi: ${trail.status.toUpperCase()}`)
  lines.push('')
  lines.push(`*${trail.goal}*`)
  lines.push('')
  lines.push(`> ${trail.sentence}`)
  lines.push('')
  lines.push('| # | | decision | why |')
  lines.push('|---|---|---|---|')
  for (const d of trail.decisions) {
    const icon = DIRECTION_ICON[d.direction]
    const flag = d.turn === trail.fatal_turn ? ' ⚑' : ''
    const agentTag = d.agent ? ` \`${d.agent}\`` : ''
    lines.push(`| ${d.turn} | ${icon} | ${d.label}${flag}${agentTag} | ${d.why} |`)
  }
  lines.push('')
  lines.push(`_judged by ${opts.model} · source: ${opts.file}_`)

  return lines.join('\n')
}

if (import.meta.main) {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: bun gate.ts <file.jsonl>')
    process.exit(2)
  }

  const { judgeFile } = await import('./judge')
  const result = await judgeFile(file)

  if (!result.trail) {
    console.log('Tamabotchi: judge declined/unavailable')
    process.exit(2)
  }

  console.log(renderGateMarkdown(result.trail, { file, model: result.model }))
  process.exit(result.trail.status === 'fatal' ? 1 : 0)
}
