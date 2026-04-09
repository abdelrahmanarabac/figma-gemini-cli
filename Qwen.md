# QWEN.md — figma-cli Project Context

## Project Overview

**figma-gemini-cli** is a Node.js-based CLI tool that bridges your terminal with Figma Desktop via a local plugin and WebSocket/HTTP daemon. It enables guarded rendering, AI-driven JSX generation, design token management, accessibility auditing, and automated design workflows.

### Key Characteristics
- **Node.js** (ESM, `type: "module"`) — requires v18+
- **Figma Desktop Plugin** — native bridge (`plugin/manifest.json` + `code.js` + `ui.html`)
- **WebSocket/HTTP Daemon** — transport layer in `src/transport/`
- **Guardian Middleware** — validates every render before committing to canvas
- **Pipeline Architecture** — `prepare → build → validate → render`
- **JSX-Based Rendering** — CLI parses JSX into Figma AST commands

### Architecture
```
src/
├── cli/          — Router, command context, command base class
├── commands/     — 26+ modular commands (render, tokens, audit, etc.)
├── parser/       — JSX-to-Figma AST translation
├── pipeline/     — Design generation pipeline (prepare, build, validate)
├── transport/    — Daemon bridge (bridge.js, daemon.js)
└── utils/        — Helpers (config, file IO, Figma operations)

plugin/
├── code.js       — Figma plugin logic
├── ui.html       — Plugin UI (WebSocket relay)
└── manifest.json — Figma plugin manifest
```

---

## Building and Running

### Prerequisites
1. **Node.js v18+**
2. **Figma Desktop** installed and running

### Setup
```bash
npm install
```

Then install the Figma plugin:
1. Open Figma Desktop
2. Plugins → Development → Import plugin from manifest
3. Select `plugin/manifest.json`

### Core Commands

```bash
# Start daemon + connect to Figma
node src/index.js connect

# Check connection status
node src/index.js status

# Render JSX directly
node src/index.js render --code "<Frame w={320} h={180}><Text>Hello</Text></Frame>"

# Generate design via AI pipeline
node src/index.js generate "Create a modern login screen"

# Dry-run (validate without rendering)
node src/index.js render --dry-run --code "<Frame w={400}><Text>Test</Text></Frame>"

# Audit accessibility
node src/index.js audit a11y --page

# Manage design tokens
node src/index.js tokens tailwind       # inject Tailwind palette
node src/index.js tokens spacing        # create spacing scale
node src/index.js tokens clear          # wipe all variables
```

### Testing
```bash
npm test          # runs node --test
```

---

## Development Conventions

### Token Hierarchy (STRICT)
- **Primitives**: ONLY collection allowed to have raw numeric/color values
- **Semantic tokens**: MUST be aliases (`--alias`) pointing to Primitives
- **Component tokens**: MUST be aliases pointing to Semantic tokens
- **NEVER** hardcode values in Semantic or Component tokens

### JSX Syntax Rules
- All values wrapped in `{}`: `name={Card}` `bg={#ffffff}`
- No CSS units (`24px` → use `24`)
- Root frames require **fixed numeric** dimensions: `w={1440} h={1024}`
- Use `flex={row}` or `flex={col}`, NOT `layout={row}`
- Use `p={24}` NOT `padding={24}` (shorthand required)
- Use `items` / `justify`, NOT `alignItems` / `justifyContent`

### Guardian Validation Rules
| Rule | Severity | Description |
|---|---|---|
| `NO_RAW_COLORS` | warning | Hex colors should be tokens |
| `ROOT_SIZING` | error | Root frames need fixed numeric w/h |
| `NAMING` | info | Avoid default names (Frame, Rectangle) |
| `MIN_DIMENSIONS` | warning | Interactive elements must be ≥44×44px |
| `SPACING_SCALE` | info | Spacing should align to 4px grid |

### Shell Safety (Windows)
- PowerShell interprets `<` and `>` as redirection operators
- Use `--code` flag or file input (`-f`) for JSX
- Escape `$` with backtick: `` `$12.00 ``

### Code Patterns
- Commands extend `Command` base class (`src/cli/command.js`)
- Each command file exports default array or single Command instance
- Connection gating via `needsConnection` flag on commands
- Use `ctx.evalOp()` for Figma interactions (only supported method)
- Config stored in `~/.figma-cli/`

---

## Key Context Files

| File | Purpose |
|---|---|
| `GEMINI.md` | AI agent instructions — design standards, pipeline flow, forbidden patterns |
| `REFERENCE.md` | Full command reference — all CLI commands, flags, and examples |

---

## Important Notes

1. **Experimental Status**: Features and APIs may change frequently
2. **FigJam commands disabled** until transport layer implemented
3. **No temp file creation** — use `--code` flag or stdin for JSX input
4. **No workspace clutter** — keep project root clean
5. **ID Preservation**: Use `inspect {id}` → `update {id} "{JSX}"` — never delete/recreate nodes
