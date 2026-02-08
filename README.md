# opencode-tmux-panes

Automatic tmux pane management for opencode subagents.

When running inside tmux, this plugin automatically spawns new panes for subagent sessions and cleans them up when sessions end.

## Installation

```bash
git clone https://github.com/dna113p/opencode-tmux-panes.git
cd opencode-tmux-panes
bun install
bun run build
ln -sf "$(pwd)/dist/index.js" ~/.config/opencode/plugins/opencode-tmux-panes.js
```

## Usage

The plugin automatically manages tmux panes when running inside tmux. No configuration required.

### How it Works

1. When a subagent session is created, the plugin spawns a new tmux pane
2. The new pane runs `opencode attach` to connect to the subagent
3. Panes are arranged using the configured layout (default: main-vertical)
4. When sessions end, panes are automatically cleaned up

### Configuration (Optional)

Add to your opencode settings:

```json
{
  "plugins": {
    "opencode-tmux-panes": {
      "layout": "main-vertical",
      "main_pane_size": 60,
      "exclude": ["explore-*", "quick-*"]
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `layout` | string | `"main-vertical"` | Tmux layout: `main-vertical`, `main-horizontal`, `tiled`, `even-horizontal`, `even-vertical` |
| `main_pane_size` | number | `60` | Main pane size percentage (20-80) |
| `main_pane_min_width` | number | `120` | Minimum main pane width in columns |
| `agent_pane_min_width` | number | `40` | Minimum agent pane width in columns |
| `exclude` | string[] | `[]` | Glob patterns to exclude from pane management |

### Per-Session Opt-Out

Plugins can opt out specific sessions from pane management:

```typescript
await client.session.create({
  title: "my-agent",
  metadata: { tmux: false }  // This session won't get a pane
});
```

## Requirements

- Running inside a tmux session
- `tmux` binary available in PATH
- opencode >= 1.0.0

## Development

After making changes, rebuild with `bun run build` -- the symlink means opencode will pick up the new build on next launch.

```bash
bun run build      # rebuild the plugin
bun run typecheck  # check types
bun test           # run tests
```

## Architecture

The plugin uses a state-first approach:

1. **Query**: Get actual tmux pane state (source of truth)
2. **Decide**: Pure function determines actions based on state
3. **Execute**: Execute actions with verification
4. **Update**: Update internal cache only after tmux confirms success

## License

MIT
