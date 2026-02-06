// Simple logger for the tmux-panes plugin
// Logs to /tmp/opencode-tmux-panes.log

import { appendFileSync } from "fs"

const LOG_PATH = "/tmp/opencode-tmux-panes.log"

export function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString()
  const line = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data)}\n`
    : `[${timestamp}] ${message}\n`
  
  try {
    appendFileSync(LOG_PATH, line)
  } catch {
    // Ignore logging errors
  }
}
