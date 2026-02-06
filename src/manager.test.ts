import { describe, expect, it, mock, beforeEach } from "bun:test"
import { TmuxPaneManager } from "./manager"
import type { TmuxPanesConfig } from "./config"

describe("TmuxPaneManager", () => {
  const defaultConfig: TmuxPanesConfig = {
    layout: "main-vertical",
    main_pane_size: 60,
    main_pane_min_width: 120,
    agent_pane_min_width: 40,
    exclude: [],
  }

  it("can be instantiated", () => {
    const manager = new TmuxPaneManager({
      config: defaultConfig,
      serverUrl: "http://localhost:4096",
      sourcePaneId: "%0",
    })
    expect(manager).toBeDefined()
  })

  it("returns empty sessions initially", () => {
    const manager = new TmuxPaneManager({
      config: defaultConfig,
      serverUrl: "http://localhost:4096",
      sourcePaneId: "%0",
    })
    expect(manager.getTrackedSessions()).toEqual([])
  })

  it("isEnabled returns false when not inside tmux", () => {
    const manager = new TmuxPaneManager({
      config: defaultConfig,
      serverUrl: "http://localhost:4096",
      sourcePaneId: "%0",
      deps: {
        isInsideTmux: () => false,
        queryWindowState: async () => null,
        executeActions: async () => ({ success: true, results: [] }),
        executeAction: async () => ({ success: true }),
      },
    })
    expect(manager.isEnabled()).toBe(false)
  })

  it("isEnabled returns true when inside tmux with source pane", () => {
    const manager = new TmuxPaneManager({
      config: defaultConfig,
      serverUrl: "http://localhost:4096",
      sourcePaneId: "%0",
      deps: {
        isInsideTmux: () => true,
        queryWindowState: async () => null,
        executeActions: async () => ({ success: true, results: [] }),
        executeAction: async () => ({ success: true }),
      },
    })
    expect(manager.isEnabled()).toBe(true)
  })

  it("tracks sessions after successful onSessionCreated", async () => {
    const mockWindowState = {
      windowWidth: 200,
      windowHeight: 50,
      mainPane: { paneId: "%0", width: 200, height: 50, left: 0, top: 0, title: "", isActive: true },
      agentPanes: [],
    }

    const manager = new TmuxPaneManager({
      config: defaultConfig,
      serverUrl: "http://localhost:4096",
      sourcePaneId: "%0",
      deps: {
        isInsideTmux: () => true,
        queryWindowState: async () => mockWindowState,
        executeActions: async () => ({ 
          success: true, 
          spawnedPaneId: "%1",
          results: [] 
        }),
        executeAction: async () => ({ success: true }),
      },
    })

    await manager.onSessionCreated({
      id: "session-123",
      parentID: "parent-456",
      title: "test-agent",
    })

    const sessions = manager.getTrackedSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toBe("session-123")
  })

  it("removes tracked session on onSessionDeleted", async () => {
    const mockWindowState = {
      windowWidth: 200,
      windowHeight: 50,
      mainPane: { paneId: "%0", width: 200, height: 50, left: 0, top: 0, title: "", isActive: true },
      agentPanes: [{ paneId: "%1", width: 100, height: 50, left: 100, top: 0, title: "", isActive: false }],
    }

    const manager = new TmuxPaneManager({
      config: defaultConfig,
      serverUrl: "http://localhost:4096",
      sourcePaneId: "%0",
      deps: {
        isInsideTmux: () => true,
        queryWindowState: async () => mockWindowState,
        executeActions: async () => ({ 
          success: true, 
          spawnedPaneId: "%1",
          results: [] 
        }),
        executeAction: async () => ({ success: true }),
      },
    })

    // First create a session
    await manager.onSessionCreated({
      id: "session-123",
      parentID: "parent-456",
      title: "test-agent",
    })
    expect(manager.getTrackedSessions()).toHaveLength(1)

    // Then delete it
    await manager.onSessionDeleted("session-123")
    expect(manager.getTrackedSessions()).toHaveLength(0)
  })
})
