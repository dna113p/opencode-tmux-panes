import type { SessionInfo } from "../suppression"
import { log } from "../core/logger"

export interface SessionWatcherDeps {
  onSessionCreated: (info: SessionInfo) => Promise<void>
  onSessionDeleted?: (sessionId: string) => Promise<void>
}

export function createSessionWatcherHook(deps: SessionWatcherDeps) {
  return {
    event: async (input: { event: { type: string; properties?: unknown } }) => {
      const rawEvent = input.event
      const event = rawEvent as {
        type: string
        properties?: {
          info?: {
            id?: string
            parentID?: string
            title?: string
            metadata?: Record<string, unknown>
          }
          sessionID?: string
          status?: {
            type?: string
          }
        }
      }

      // Log session-related events for diagnostics
      if (event.type.startsWith("session.")) {
        log("[session-watcher] event received", {
          type: event.type,
          sessionId: event.properties?.info?.id ?? event.properties?.sessionID,
          parentID: event.properties?.info?.parentID,
          hasInfo: !!event.properties?.info,
        })
      }

      if (event.type === "session.created") {
        const info = event.properties?.info
        if (!info?.id || !info?.parentID) return // Only subagents have parentID

        await deps.onSessionCreated({
          id: info.id,
          parentID: info.parentID,
          title: info.title,
          metadata: info.metadata,
        })
      }

      if (event.type === "session.deleted" && deps.onSessionDeleted) {
        const sessionId = event.properties?.info?.id
        if (sessionId) {
          log("[session-watcher] calling onSessionDeleted", { sessionId })
          await deps.onSessionDeleted(sessionId)
        }
      }

      // Also handle session.idle as an alternative cleanup trigger
      // When a sub-agent session goes idle, it means the agent finished its work
      if (event.type === "session.idle" && deps.onSessionDeleted) {
        const sessionId = event.properties?.sessionID ?? event.properties?.info?.id
        if (sessionId) {
          log("[session-watcher] session idle, triggering cleanup", { sessionId })
          await deps.onSessionDeleted(sessionId)
        }
      }
    },
  }
}
