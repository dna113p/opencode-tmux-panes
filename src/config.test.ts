import { describe, expect, it } from "bun:test"
import { TmuxPanesConfigSchema, type TmuxPanesConfig } from "./config"

describe("TmuxPanesConfigSchema", () => {
  it("provides sensible defaults", () => {
    const config = TmuxPanesConfigSchema.parse({})
    
    expect(config.layout).toBe("main-vertical")
    expect(config.main_pane_size).toBe(60)
    expect(config.main_pane_min_width).toBe(120)
    expect(config.agent_pane_min_width).toBe(40)
    expect(config.exclude).toEqual([])
  })

  it("validates layout enum", () => {
    expect(() => TmuxPanesConfigSchema.parse({ layout: "invalid" })).toThrow()
  })

  it("accepts valid layout values", () => {
    const layouts = ["main-vertical", "main-horizontal", "tiled", "even-horizontal", "even-vertical"] as const
    for (const layout of layouts) {
      const config = TmuxPanesConfigSchema.parse({ layout })
      expect(config.layout).toBe(layout)
    }
  })

  it("validates main_pane_size range", () => {
    expect(() => TmuxPanesConfigSchema.parse({ main_pane_size: 19 })).toThrow()
    expect(() => TmuxPanesConfigSchema.parse({ main_pane_size: 81 })).toThrow()
    
    const config = TmuxPanesConfigSchema.parse({ main_pane_size: 50 })
    expect(config.main_pane_size).toBe(50)
  })

  it("accepts valid exclude patterns", () => {
    const config = TmuxPanesConfigSchema.parse({
      exclude: ["explore-*", "quick-*"],
    })
    
    expect(config.exclude).toEqual(["explore-*", "quick-*"])
  })

  it("accepts custom min widths", () => {
    const config = TmuxPanesConfigSchema.parse({
      main_pane_min_width: 150,
      agent_pane_min_width: 60,
    })
    
    expect(config.main_pane_min_width).toBe(150)
    expect(config.agent_pane_min_width).toBe(60)
  })
})
