import type { SessionInfo } from "../suppression"

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
        }
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
          await deps.onSessionDeleted(sessionId)
        }
      }
    },
  }
}
