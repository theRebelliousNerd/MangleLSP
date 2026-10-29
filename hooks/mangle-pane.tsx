import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { MangleFinding, MangleView } from '../types'

// The Mangle pane: after Claude edits a .mg file, the engine-backed review
// of that file (errors, advice on Mangle-only features, Go boundary
// findings) beside the chat. The review runs on a timer, never inside the
// edit, so Claude is not kept waiting.
const PANE = 'mangle'
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit'])
// Warnings that dominate real corpora; counted, not listed.
const QUIET = new Set(['E019', 'E074'])
const EMPTY: MangleView = { pending: [], isRunning: false, findings: [] }
// Change the tag when MangleView's fields change.
const view = atom({ plugin: 'mangle', key: 'view' } as const, EMPTY, { shape: 'view-1' })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pane',
      description: 'Show the Mangle pane: engine review, advice and Go boundary findings for the .mg file being edited',
    })
    $.clock.every(2000, () => void refresh($))

    return next(e)
  })

  on('command.run', { command: 'pane' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Mangle' })
    await refresh($)

    return { text: 'Mangle pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const path = (e as { file_path?: unknown }).file_path
    if (EDIT_TOOLS.has(e.tool) && typeof path === 'string' && path.endsWith('.mg') && ran.deny === undefined) {
      await update($, view, v => ({ ...v, pending: [...v.pending.filter(p => p !== path), path] }))
      void $.ui.open({ id: PANE, title: 'Mangle' })
    }

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const v = await read($, view)
    if (!v.file) {
      return (
        <Box flexDirection="column">
          <Text dimColor>{v.isRunning ? 'Reviewing…' : 'Edit a .mg file and its engine review appears here.'}</Text>
          {v.problem && <Text color="red">{v.problem}</Text>}
        </Box>
      )
    }
    const room = Math.max(3, Math.floor(((e.viewport?.rows ?? 30) - 8) / 3))
    const errors = v.findings.filter(f => f.severity === 'error')
    const advice = v.findings.filter(f => f.category === 'advice')
    const boundary = v.findings.filter(f => f.category === 'boundary' && f.severity !== 'error')
    const warnings = v.findings.filter(f => f.severity === 'warning' && f.category !== 'advice' && f.category !== 'boundary')
    const quiet = warnings.filter(f => QUIET.has(f.code)).length
    const when = v.checkedAt ? new Date(v.checkedAt).toLocaleTimeString() : ''
    const row = (f: MangleFinding) => (
      <Text>
        <Text dimColor>L{f.line} </Text>
        <Text bold>{f.code}</Text> {f.message}
      </Text>
    )

    return (
      <Box flexDirection="column">
        <Text bold>{v.file}</Text>
        <Text dimColor>
          {v.isRunning ? 'reviewing…' : `checked ${when}`}
          {v.repoErrors !== undefined ? ` · ${v.repoErrors} errors across the project's programs` : ''}
        </Text>
        {v.problem && <Text color="red">{v.problem}</Text>}
        <Text bold color={errors.length ? 'red' : 'green'}>Errors {errors.length}</Text>
        {errors.slice(0, room).map(row)}
        <Text bold color="cyan">Use more Mangle {advice.length}</Text>
        {advice.slice(0, room).map(row)}
        <Text bold color="yellow">Go boundary {boundary.length}</Text>
        {boundary.slice(0, room).map(row)}
        <Text dimColor>
          Warnings {warnings.length - quiet}
          {quiet ? ` (+${quiet} join/variable-style hidden)` : ''} · mangle-cli review --root .
        </Text>
      </Box>
    )
  })
}

/** Review the most recently edited .mg file, if one waits and none runs. */
async function refresh($: EngineInterface): Promise<void> {
  const v = await read($, view)
  const file = v.pending[v.pending.length - 1]
  if (v.isRunning || !file) return
  await update($, view, s => ({ ...s, pending: [], isRunning: true, problem: undefined }))
  try {
    const dir = file.slice(0, file.lastIndexOf('/')) || '.'
    const git = await $.process.run(['git', '-C', dir, 'rev-parse', '--show-toplevel'])
    const root = git.exitCode === 0 ? git.stdout.trim() : dir
    const cli = `${$.plugin.root}/bin/mangle-cli`
    const res = await $.process.run([cli, 'review', '--root', root, '--severity', 'warning', '--format', 'json'], {
      cwd: root, timeoutMs: 180_000,
    })
    const plan: Array<MangleFinding & { file: string }> = JSON.parse(res.stdout).plan ?? []
    const rel = file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file
    const findings = plan.filter(i => i.file === rel)
      .map(({ code, severity, category, line, title, message }) => ({ code, severity, category, line, title, message }))
    const repoErrors = plan.filter(i => i.severity === 'error').length
    const checkedAt = await $.clock.now()
    await update($, view, s => ({ ...s, isRunning: false, file: rel, root, checkedAt, findings, repoErrors }))
  } catch (err) {
    await update($, view, s => ({ ...s, isRunning: false, problem: `review failed: ${String(err).slice(0, 200)}` }))
  }
}
