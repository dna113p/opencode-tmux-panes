import { describe, expect, it } from "bun:test"
import { shouldSuppress, type SessionInfo } from "./suppression"
import type { TmuxPanesConfig } from "./config"

describe("shouldSuppress", () => {
  const defaultConfig: TmuxPanesConfig = {
    layout: "main-vertical",
    main_pane_size: 60,
    main_pane_min_width: 120,
    agent_pane_min_width: 40,
    exclude: [],
  }

  it("returns false when no suppression rules match", () => {
    const result = shouldSuppress(
      { id: "123", title: "my-agent" },
      defaultConfig
    )
    expect(result).toBe(false)
  })

  it("returns true when metadata.tmux is false", () => {
    const result = shouldSuppress(
      { id: "123", title: "my-agent", metadata: { tmux: false } },
      defaultConfig
    )
    expect(result).toBe(true)
  })

  it("returns false when metadata.tmux is true", () => {
    const result = shouldSuppress(
      { id: "123", title: "my-agent", metadata: { tmux: true } },
      defaultConfig
    )
    expect(result).toBe(false)
  })

  it("returns false when metadata has unrelated fields", () => {
    const result = shouldSuppress(
      { id: "123", title: "my-agent", metadata: { other: "value" } },
      defaultConfig
    )
    expect(result).toBe(false)
  })

  it("returns true when title matches exclude pattern", () => {
    const config = { ...defaultConfig, exclude: ["explore-*"] }
    const result = shouldSuppress(
      { id: "123", title: "explore-codebase" },
      config
    )
    expect(result).toBe(true)
  })

  it("returns false when title does not match exclude pattern", () => {
    const config = { ...defaultConfig, exclude: ["explore-*"] }
    const result = shouldSuppress(
      { id: "123", title: "implement-feature" },
      config
    )
    expect(result).toBe(false)
  })

  it("handles multiple exclude patterns", () => {
    const config = { ...defaultConfig, exclude: ["explore-*", "quick-*"] }
    
    expect(shouldSuppress({ id: "1", title: "explore-x" }, config)).toBe(true)
    expect(shouldSuppress({ id: "2", title: "quick-lookup" }, config)).toBe(true)
    expect(shouldSuppress({ id: "3", title: "implement" }, config)).toBe(false)
  })

  it("handles sessions without title", () => {
    const config = { ...defaultConfig, exclude: ["explore-*"] }
    const result = shouldSuppress({ id: "123" }, config)
    expect(result).toBe(false)
  })

  it("handles empty title", () => {
    const config = { ...defaultConfig, exclude: ["explore-*"] }
    const result = shouldSuppress({ id: "123", title: "" }, config)
    expect(result).toBe(false)
  })

  it("metadata.tmux=false takes precedence over non-matching patterns", () => {
    const config = { ...defaultConfig, exclude: ["explore-*"] }
    // Title doesn't match pattern, but metadata says no
    const result = shouldSuppress(
      { id: "123", title: "implement-feature", metadata: { tmux: false } },
      config
    )
    expect(result).toBe(true)
  })
})
