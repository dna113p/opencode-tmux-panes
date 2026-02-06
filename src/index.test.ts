import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import tmuxPanesPlugin from "./index"

describe("tmuxPanesPlugin", () => {
  const originalTmux = process.env.TMUX
  const originalTmuxPane = process.env.TMUX_PANE

  afterEach(() => {
    if (originalTmux) {
      process.env.TMUX = originalTmux
    } else {
      delete process.env.TMUX
    }
    if (originalTmuxPane) {
      process.env.TMUX_PANE = originalTmuxPane
    } else {
      delete process.env.TMUX_PANE
    }
  })

  it("returns hooks when inside tmux", async () => {
    process.env.TMUX = "/tmp/tmux-1000/default,12345,0"
    process.env.TMUX_PANE = "%0"

    const mockCtx = {
      client: {},
      project: {},
      directory: "/test",
      worktree: "/test",
      serverUrl: new URL("http://localhost:4096"),
      $: {} as never,
    }

    const hooks = await tmuxPanesPlugin(mockCtx as never)
    expect(hooks.event).toBeDefined()
  })

  it("returns empty hooks when outside tmux", async () => {
    delete process.env.TMUX
    delete process.env.TMUX_PANE

    const mockCtx = {
      client: {},
      project: {},
      directory: "/test",
      worktree: "/test",
      serverUrl: new URL("http://localhost:4096"),
      $: {} as never,
    }

    const hooks = await tmuxPanesPlugin(mockCtx as never)
    expect(hooks.event).toBeUndefined()
  })
})
