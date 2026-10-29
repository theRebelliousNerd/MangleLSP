import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'mangle',
  component: 'Pane',
  requestId: 'mangle',
  props: {
    title: 'Mangle',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const PLAN = {
  plan: [
    { code: 'E003', severity: 'error', category: 'stratification', title: 't', file: 'rules.mg', line: 5,
      message: "'_' in the negated atom is a variable nothing binds" },
    { code: 'A001', severity: 'warning', category: 'advice', title: 't', file: 'rules.mg', line: 9,
      message: 'fn:max joined back: a merge lattice keeps the winner' },
    { code: 'B004', severity: 'warning', category: 'boundary', title: 't', file: 'rules.mg', line: 2,
      message: 'Go asserts q/3 but the Decl is q/1' },
    { code: 'E019', severity: 'warning', category: 'performance', title: 't', file: 'rules.mg', line: 7,
      message: 'join' },
    { code: 'E071', severity: 'error', category: 'type', title: 't', file: 'other.mg', line: 1,
      message: 'elsewhere' },
  ],
}

function engine(on: Parameters<Parameters<typeof test>[1]>[1], opened: string[]) {
  on('command.register', () => ({ value: { command: 'pane' } }))
  on('ui.open', (_, e) => { opened.push(e.id); return { value: { isPlaced: true } } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('clock.every', () => ({ value: () => {} }))
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 28, 12) }))
  on('process.run', (_, e) =>
    e.argv[0] === 'git'
      ? { value: { exitCode: 0, stdout: '/p\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
      : { value: { exitCode: 0, stdout: JSON.stringify(PLAN), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
}

test('before any .mg edit the pane says what it is for', async ($, on) => {
  engine(on, [])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Edit a \.mg file/ }))?.text).toBeTruthy()
  await ui.unmount()
})

test('an edit to a .mg file opens the pane; other files do not', async ($, on) => {
  const opened: string[] = []
  engine(on, opened)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/p/main.go', old_string: 'a', new_string: 'b' })
  expect(opened).toEqual([])
  await $.tool.call({ tool: 'Edit', file_path: '/p/rules.mg', old_string: 'a', new_string: 'b' })
  expect(opened).toEqual(['mangle'])
})

test('the review of the edited file fills the sections, on every surface', async ($, on) => {
  engine(on, [])
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/p/rules.mg', old_string: 'a', new_string: 'b' })
  await $.command.run({ command: 'pane' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^rules\.mg$/ }))?.text).toBe('rules.mg')
    expect((await ui.find({ type: 'Text', text: /^Errors 1$/ }))?.text).toBe('Errors 1')
    expect((await ui.find({ type: 'Text', text: /^Use more Mangle 1$/ }))?.text).toBe('Use more Mangle 1')
    expect((await ui.find({ type: 'Text', text: /^Go boundary 1$/ }))?.text).toBe('Go boundary 1')
    expect((await ui.find({ type: 'Text', text: /2 errors across/ }))?.text).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /\+1 join\/variable-style hidden/ }))?.text).toBeTruthy()
    await ui.unmount()
  }
})
