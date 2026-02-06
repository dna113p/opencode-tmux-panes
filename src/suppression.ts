import { minimatch } from "minimatch"
import type { TmuxPanesConfig } from "./config"

export interface SessionInfo {
  id: string
  title?: string
  parentID?: string
  metadata?: Record<string, unknown>
}

/**
 * Determines if a session should be suppressed from tmux pane management.
 * 
 * Suppression rules (in order):
 * 1. If metadata.tmux === false, suppress
 * 2. If title matches any exclude pattern, suppress
 * 3. Otherwise, don't suppress
 */
export function shouldSuppress(
  info: SessionInfo,
  config: TmuxPanesConfig
): boolean {
  // Check metadata opt-out (explicit false only)
  if (info.metadata?.tmux === false) {
    return true
  }

  // Check pattern exclusions
  const title = info.title ?? ""
  for (const pattern of config.exclude) {
    if (minimatch(title, pattern)) {
      return true
    }
  }

  return false
}
