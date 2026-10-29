/** One finding `mangle-cli review` reported for the file in the pane. */
export type MangleFinding = {
  code: string
  severity: 'error' | 'warning' | 'info'
  category: string
  line: number
  title: string
  message: string
}

/** What the Mangle pane shows: the latest engine review of one .mg file. */
export type MangleView = {
  /** .mg files edited since the last review, oldest first. */
  pending: string[]
  isRunning: boolean
  /** The file on show, relative to its project root. */
  file?: string
  root?: string
  checkedAt?: number
  findings: MangleFinding[]
  /** Errors across every assembled program in the project. */
  repoErrors?: number
  /** Why the last review could not run, if it could not. */
  problem?: string
}

declare module 'claude-code' {
  interface PluginState {
    mangle: { view: Shaped<MangleView> }
  }
}
