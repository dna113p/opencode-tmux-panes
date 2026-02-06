import { z } from "zod"

export const TmuxLayoutSchema = z.enum([
  "main-vertical",
  "main-horizontal",
  "tiled",
  "even-horizontal",
  "even-vertical",
])

export type TmuxLayout = z.infer<typeof TmuxLayoutSchema>

export const TmuxPanesConfigSchema = z.object({
  layout: TmuxLayoutSchema.default("main-vertical"),
  main_pane_size: z.number().min(20).max(80).default(60),
  main_pane_min_width: z.number().min(40).default(120),
  agent_pane_min_width: z.number().min(20).default(40),
  exclude: z.array(z.string()).default([]),
})

export type TmuxPanesConfig = z.infer<typeof TmuxPanesConfigSchema>
