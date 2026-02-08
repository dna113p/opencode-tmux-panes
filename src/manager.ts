import type { TmuxPanesConfig } from "./config"
import type { SessionInfo } from "./suppression"
import type { TrackedSession, CapacityConfig, WindowState, TmuxConfig } from "./core/types"
import { 
  isInsideTmux as defaultIsInsideTmux,
  queryWindowState as defaultQueryWindowState,
} from "./core"
import { 
  executeActions as defaultExecuteActions, 
  executeAction as defaultExecuteAction,
  type ExecuteActionsResult,
  type ActionResult,
  type ExecuteContext,
} from "./core/action-executor"
import { decideSpawnActions, decideCloseAction, type SessionMapping } from "./core/decision-engine"
import { log } from "./core/logger"
import { getCachedTmuxPath } from "./core/tmux-path"
import { spawnSync } from "child_process"

export interface TmuxPaneManagerDeps {
  isInsideTmux: () => boolean
  queryWindowState: (sourcePaneId: string) => Promise<WindowState | null>
  executeActions: (actions: import("./core/types").PaneAction[], ctx: ExecuteContext) => Promise<ExecuteActionsResult>
  executeAction: (action: import("./core/types").PaneAction, ctx: ExecuteContext) => Promise<ActionResult>
}

const defaultDeps: TmuxPaneManagerDeps = {
  isInsideTmux: defaultIsInsideTmux,
  queryWindowState: defaultQueryWindowState,
  executeActions: defaultExecuteActions,
  executeAction: defaultExecuteAction,
}

export interface TmuxPaneManagerOptions {
  config: TmuxPanesConfig
  serverUrl: string
  sourcePaneId?: string
  deps?: TmuxPaneManagerDeps
}

/**
 * Simplified Tmux Pane Manager for standalone plugin.
 * 
 * Architecture:
 * 1. QUERY: Get actual tmux pane state (source of truth)
 * 2. DECIDE: Pure function determines actions based on state
 * 3. EXECUTE: Execute actions with verification
 * 4. UPDATE: Update internal cache only after tmux confirms success
 */
export class TmuxPaneManager {
  private config: TmuxPanesConfig
  private serverUrl: string
  private sourcePaneId: string | undefined
  private sessions = new Map<string, TrackedSession>()
  private pendingSessions = new Set<string>()
  private deps: TmuxPaneManagerDeps

  constructor(options: TmuxPaneManagerOptions) {
    this.config = options.config
    this.serverUrl = options.serverUrl
    this.sourcePaneId = options.sourcePaneId
    this.deps = options.deps ?? defaultDeps

    log("[TmuxPaneManager] initialized", {
      serverUrl: this.serverUrl,
      sourcePaneId: this.sourcePaneId,
    })
  }

  isEnabled(): boolean {
    return this.deps.isInsideTmux() && !!this.sourcePaneId
  }

  getTrackedSessions(): string[] {
    return Array.from(this.sessions.keys())
  }

  private getTmuxConfig(): TmuxConfig {
    return {
      enabled: true, // Always enabled when manager is active
      layout: this.config.layout,
      main_pane_size: this.config.main_pane_size,
      main_pane_min_width: this.config.main_pane_min_width,
      agent_pane_min_width: this.config.agent_pane_min_width,
    }
  }

  private getCapacityConfig(): CapacityConfig {
    return {
      mainPaneMinWidth: this.config.main_pane_min_width,
      agentPaneWidth: this.config.agent_pane_min_width,
    }
  }

  private getSessionMappings(): SessionMapping[] {
    return Array.from(this.sessions.values()).map((s) => ({
      sessionId: s.sessionId,
      paneId: s.paneId,
      createdAt: s.createdAt,
    }))
  }

  async onSessionCreated(info: SessionInfo): Promise<void> {
    if (!this.isEnabled()) return

    const sessionId = info.id
    const title = info.title ?? "Subagent"

    log("[TmuxPaneManager] onSessionCreated", { sessionId, title, parentID: info.parentID })

    // Skip if not a subagent (no parentID)
    if (!info.parentID) {
      log("[TmuxPaneManager] skipping non-subagent session", { sessionId })
      return
    }

    // Skip if already tracked or pending
    if (this.sessions.has(sessionId) || this.pendingSessions.has(sessionId)) {
      log("[TmuxPaneManager] session already tracked or pending", { sessionId })
      return
    }

    if (!this.sourcePaneId) {
      log("[TmuxPaneManager] no source pane id")
      return
    }

    this.pendingSessions.add(sessionId)

    try {
      const state = await this.deps.queryWindowState(this.sourcePaneId)
      if (!state) {
        log("[TmuxPaneManager] failed to query window state")
        return
      }

      log("[TmuxPaneManager] window state queried", {
        windowWidth: state.windowWidth,
        mainPane: state.mainPane?.paneId,
        agentPaneCount: state.agentPanes.length,
      })

      const decision = decideSpawnActions(
        state,
        sessionId,
        title,
        this.getCapacityConfig(),
        this.getSessionMappings()
      )

      log("[TmuxPaneManager] spawn decision", {
        canSpawn: decision.canSpawn,
        reason: decision.reason,
        actionCount: decision.actions.length,
      })

      if (!decision.canSpawn) {
        log("[TmuxPaneManager] cannot spawn", { reason: decision.reason })
        return
      }

      const result = await this.deps.executeActions(
        decision.actions,
        { config: this.getTmuxConfig(), serverUrl: this.serverUrl, windowState: state }
      )

      // Update cache based on actions
      for (const { action, result: actionResult } of result.results) {
        if (action.type === "close" && actionResult.success) {
          this.sessions.delete(action.sessionId)
        }
        if (action.type === "replace" && actionResult.success) {
          this.sessions.delete(action.oldSessionId)
        }
      }

      if (result.success && result.spawnedPaneId) {
        const now = Date.now()
        this.sessions.set(sessionId, {
          sessionId,
          paneId: result.spawnedPaneId,
          description: title,
          createdAt: new Date(now),
          lastSeenAt: new Date(now),
        })
        log("[TmuxPaneManager] pane spawned and tracked", {
          sessionId,
          paneId: result.spawnedPaneId,
        })
      } else {
        log("[TmuxPaneManager] spawn failed", { success: result.success })
      }
    } finally {
      this.pendingSessions.delete(sessionId)
    }
  }

  async onSessionDeleted(sessionId: string): Promise<void> {
    if (!this.isEnabled()) return
    if (!this.sourcePaneId) return

    const tracked = this.sessions.get(sessionId)
    if (!tracked) return

    log("[TmuxPaneManager] onSessionDeleted", { sessionId })

    const state = await this.deps.queryWindowState(this.sourcePaneId)
    if (!state) {
      this.sessions.delete(sessionId)
      return
    }

    const closeAction = decideCloseAction(state, sessionId, this.getSessionMappings())
    if (closeAction) {
      await this.deps.executeAction(closeAction, { 
        config: this.getTmuxConfig(), 
        serverUrl: this.serverUrl, 
        windowState: state 
      })
    }

    this.sessions.delete(sessionId)
  }

  async cleanup(): Promise<void> {
    if (this.sessions.size === 0) return
    if (!this.sourcePaneId) return

    log("[TmuxPaneManager] cleanup", { sessionCount: this.sessions.size })

    const state = await this.deps.queryWindowState(this.sourcePaneId)
    if (!state) {
      this.sessions.clear()
      return
    }

    const closePromises = Array.from(this.sessions.values()).map((s) =>
      this.deps.executeAction(
        { type: "close", paneId: s.paneId, sessionId: s.sessionId },
        { config: this.getTmuxConfig(), serverUrl: this.serverUrl, windowState: state }
      ).catch((err) =>
        log("[TmuxPaneManager] cleanup error for pane", {
          paneId: s.paneId,
          error: String(err),
        }),
      ),
    )

    await Promise.all(closePromises)
    this.sessions.clear()
  }

  /**
   * Synchronous cleanup for use in process exit handlers where
   * async operations are not reliable.
   */
  cleanupSync(): void {
    if (this.sessions.size === 0) return

    const tmux = getCachedTmuxPath()
    if (!tmux) {
      log("[TmuxPaneManager] cleanupSync: no cached tmux path")
      return
    }

    log("[TmuxPaneManager] cleanupSync", { sessionCount: this.sessions.size })

    for (const session of this.sessions.values()) {
      try {
        spawnSync(tmux, ["kill-pane", "-t", session.paneId], {
          timeout: 2000,
        })
        log("[TmuxPaneManager] cleanupSync killed pane", { paneId: session.paneId })
      } catch (err) {
        log("[TmuxPaneManager] cleanupSync error", {
          paneId: session.paneId,
          error: String(err),
        })
      }
    }

    this.sessions.clear()
  }

  /**
   * Clean up orphaned panes from previous plugin instances.
   * Detects panes with titles matching "omo-subagent-*" that aren't
   * tracked by this manager instance.
   */
  async cleanupOrphanedPanes(): Promise<void> {
    if (!this.sourcePaneId) return

    const state = await this.deps.queryWindowState(this.sourcePaneId)
    if (!state) return

    const orphanedPanes = state.agentPanes.filter(
      (p) => p.title?.startsWith("omo-subagent-")
    )

    if (orphanedPanes.length === 0) return

    log("[TmuxPaneManager] cleaning up orphaned panes", {
      count: orphanedPanes.length,
      panes: orphanedPanes.map((p) => ({ id: p.paneId, title: p.title })),
    })

    for (const pane of orphanedPanes) {
      try {
        await this.deps.executeAction(
          { type: "close", paneId: pane.paneId, sessionId: "orphan" },
          { config: this.getTmuxConfig(), serverUrl: this.serverUrl, windowState: state }
        )
        log("[TmuxPaneManager] orphaned pane closed", { paneId: pane.paneId })
      } catch (err) {
        log("[TmuxPaneManager] failed to close orphaned pane", {
          paneId: pane.paneId,
          error: String(err),
        })
      }
    }
  }
}
