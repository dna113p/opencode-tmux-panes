import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { TmuxPanesConfigSchema, type TmuxPanesConfig } from "./config"
import { TmuxPaneManager } from "./manager"
import { createSessionWatcherHook } from "./hooks/session-watcher"
import { shouldSuppress } from "./suppression"
import { isInsideTmux, getCurrentPaneId } from "./core/tmux-utils"
import { log } from "./core/logger"

/**
 * Creates the opencode-tmux-panes plugin.
 * 
 * This plugin automatically manages tmux panes for opencode subagents.
 * When a subagent session is created, it spawns a new tmux pane for it.
 * When the session ends, the pane is cleaned up.
 */
const tmuxPanesPlugin: Plugin = async (ctx: PluginInput) => {
  // Parse config - in a real plugin this would come from ctx or plugin config
  const config = TmuxPanesConfigSchema.parse({})

  log("[opencode-tmux-panes] initializing", {
    isInsideTmux: isInsideTmux(),
    currentPaneId: getCurrentPaneId(),
    serverUrl: ctx.serverUrl?.toString(),
  })

  // If not inside tmux, return dormant plugin (no hooks)
  if (!isInsideTmux()) {
    log("[opencode-tmux-panes] not inside tmux, staying dormant")
    return {}
  }

  const sourcePaneId = getCurrentPaneId()
  if (!sourcePaneId) {
    log("[opencode-tmux-panes] no TMUX_PANE, staying dormant")
    return {}
  }

  const serverUrl = ctx.serverUrl?.toString() ?? `http://localhost:${process.env.OPENCODE_PORT ?? "4096"}`

  const manager = new TmuxPaneManager({
    config,
    serverUrl,
    sourcePaneId,
  })

  log("[opencode-tmux-panes] manager created, registering hooks")

  // Clean up orphaned panes from previous sessions on startup
  await manager.cleanupOrphanedPanes()

  // Register process exit handlers to clean up panes
  const exitCleanup = () => {
    log("[opencode-tmux-panes] process exit, cleaning up panes")
    // Use synchronous cleanup since we're in an exit handler
    manager.cleanupSync()
  }

  process.on("SIGTERM", () => {
    log("[opencode-tmux-panes] SIGTERM received")
    exitCleanup()
    process.exit(0)
  })

  process.on("SIGINT", () => {
    log("[opencode-tmux-panes] SIGINT received")
    exitCleanup()
    process.exit(0)
  })

  process.on("beforeExit", () => {
    log("[opencode-tmux-panes] beforeExit")
    exitCleanup()
  })

  const sessionWatcher = createSessionWatcherHook({
    onSessionCreated: async (info) => {
      // Check suppression rules before spawning
      if (shouldSuppress(info, config)) {
        log("[opencode-tmux-panes] session suppressed", { id: info.id, title: info.title })
        return
      }
      await manager.onSessionCreated(info)
    },
    onSessionDeleted: async (sessionId) => {
      await manager.onSessionDeleted(sessionId)
    },
  })

  return {
    event: sessionWatcher.event as (input: { event: import("@opencode-ai/sdk").Event }) => Promise<void>,
  }
}

export default tmuxPanesPlugin
