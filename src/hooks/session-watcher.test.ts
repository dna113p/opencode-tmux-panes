import { describe, expect, it, mock } from "bun:test"
import { createSessionWatcherHook } from "./session-watcher"

describe("createSessionWatcherHook", () => {
  it("ignores non-session.created events", async () => {
    const onSessionCreated = mock(() => Promise.resolve())
    const hook = createSessionWatcherHook({ onSessionCreated })

    await hook.event?.({
      event: { type: "tool.called", properties: {} },
    } as never)

    expect(onSessionCreated).not.toHaveBeenCalled()
  })

  it("ignores sessions without parentID (not subagents)", async () => {
    const onSessionCreated = mock(() => Promise.resolve())
    const hook = createSessionWatcherHook({ onSessionCreated })

    await hook.event?.({
      event: {
        type: "session.created",
        properties: { info: { id: "123", title: "main" } },
      },
    } as never)

    expect(onSessionCreated).not.toHaveBeenCalled()
  })

  it("calls onSessionCreated for subagent sessions", async () => {
    const onSessionCreated = mock(() => Promise.resolve())
    const hook = createSessionWatcherHook({ onSessionCreated })

    await hook.event?.({
      event: {
        type: "session.created",
        properties: {
          info: { id: "child-123", parentID: "parent-456", title: "agent" },
        },
      },
    } as never)

    expect(onSessionCreated).toHaveBeenCalledWith({
      id: "child-123",
      parentID: "parent-456",
      title: "agent",
      metadata: undefined,
    })
  })

  it("passes metadata when present", async () => {
    const onSessionCreated = mock(() => Promise.resolve())
    const hook = createSessionWatcherHook({ onSessionCreated })

    await hook.event?.({
      event: {
        type: "session.created",
        properties: {
          info: { 
            id: "child-123", 
            parentID: "parent-456", 
            title: "agent",
            metadata: { tmux: false },
          },
        },
      },
    } as never)

    expect(onSessionCreated).toHaveBeenCalledWith({
      id: "child-123",
      parentID: "parent-456",
      title: "agent",
      metadata: { tmux: false },
    })
  })

  it("calls onSessionDeleted when session.deleted event", async () => {
    const onSessionCreated = mock(() => Promise.resolve())
    const onSessionDeleted = mock(() => Promise.resolve())
    const hook = createSessionWatcherHook({ onSessionCreated, onSessionDeleted })

    await hook.event?.({
      event: {
        type: "session.deleted",
        properties: { info: { id: "session-123" } },
      },
    } as never)

    expect(onSessionDeleted).toHaveBeenCalledWith("session-123")
  })
})
