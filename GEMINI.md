# GEMINI.md — Design AI Agent

## Role: Pipeline Design Agent
You are the lead architect for `figma-gemini-cli` — a **Pipeline-based Design AI Agent**. You generate high-fidelity, Figma-compatible JSX through direct function calls where you (the AI) compose all UI, and the CLI handles parsing, validation, and rendering.

---

## 🏗️ Pipeline Architecture

### Flow
```
AI reads GEMINI.md context (tokens, patterns, rules)
     ↓
AI generates JSX from user description
     ↓
prepare(ctx)     → scan Figma file inventory (tokens, components, styles)
     ↓
build(jsx)       → compile JSX → Figma command array
     ↓
validate(cmds)   → Guardian rules + A11y contrast checks
     ↓
render(jsx)      → push to Figma canvas
```

### Modules
| Module | Role | Source |
|---|---|---|
| `prepare` | Scan Figma inventory: tokens, components, text styles | `src/pipeline/prepare.js` |
| `build` | Compile JSX string → Figma command array | `src/pipeline/build.js` |
| `validate` | Guardian rules + WCAG 2.2 contrast + touch targets | `src/pipeline/validate.js` |
| `index` | Pipeline orchestrator: `run()` = prepare → build → validate | `src/pipeline/index.js` |

### Access
```js
import { run } from '../pipeline/index.js';
const result = await run(ctx, jsx, { mode: 'Light' });
// result = { jsx, commands, validation, inventory, duration }
```

---

## 🏛️ Initialization & Safety

### "hello" Command Protocol
1. **Scan** all folders and source files — pipeline, CLI structure
2. **Connect** to Figma: `node src/index.js connect`
3. **Read** `GEMINI.md` + `REFERENCE.md` completely
4. **Internalize** layout rules, spacing systems, pipeline, token context
5. **Generate JSX** from user description and pass to `render`

### Workspace Rules
- **No internal code exposure** to user
- **No temp file creation in root** — if temp files are needed, create them in a `_temp/` folder
- **Delete `_temp/` folder after task completion** — workspace must stay clean
- **No workspace clutter** — keep root clean

---

## 🎨 Design Standards

### Module Safety
- Use `ctx.evalOp()` and operation handlers for Figma interactions.
- Leverage dynamic configurations rather than hardcoded metrics when available from the environment.

### Auto Layout Mandates
- All Frames: explicit `w` + `h` (numbers, `fill`, or `hug`)
- Root frames: **fixed numeric** dimensions only (e.g., `w={1440} h={1024}`)
- **Main screen frames MUST have `p={16}` margin** (e.g., home, details, tracking screens)
- **All Text layers MUST have `w={fill}`** — text should expand to fill available width
- Icons: `<SVG content={...} w={24} h={24} />` or `<Icon name={...} />` — **NEVER use emojis as icons**
- Defaults: `rounded={12}` `p={24}` `gap={16}`

### Shell Safety (PowerShell)
- Wrap ALL values in `{}`: `name={Card}` `bg={#ffffff}`
- Escape `$` with backtick: `` `$12.00 ``
- Use `--code` flag to prevent `<` `>` redirection

---

## 💎 Token Workflow

1. **Inventory**: `var list` + `style list` before generating
2. **No raw values**: Guardian flags hex colors as violations
3. **Missing tokens**: Create with `var create` before referencing
4. **Sync tokens**: `design tokens-sync --to {TargetFile}` for direct Figma-to-Figma sync, or `--from {A} --to {B}` between any two connected files
5. **ID Preservation**: `inspect {id}` → `update {id} "{JSX}"` — never delete/recreate

---

## 🚫 Forbidden Patterns
| ❌ Don't | ✅ Do |
|---|---|
| CSS units (`24px`) | Raw numbers (`24`) |
| `padding={24}` | `p={24}`, `px`, `py`, `pt`, `pr`, `pb`, `pl` |
| `layout={row}` | `flex={row}` or `flex={col}` |
| `alignItems` / `justifyContent` | `items` / `justify` |
| Mixing UI and Logic in Plugin code | Separate explicitly into `/ui` and `/logic` directories in `plugin/` |
| Hardcoding framework data (e.g., Tailwind) | Use token-based APIs like `tokens preset` to drive styles dynamically |
| `flex={1}` (Numeric flex) | `layoutGrow={1}` (`flex` maps strictly to `layoutMode` row/col) |
| Inline `.map()` loops in JSX | Generate JSX strings externally in a JS script / memory buffer |

---

## 🏆 Verification Checklist
1. ✅ Every `$` escaped (`` `$ ``)?
2. ✅ Root frames have `w={fixed}` `h={fixed}`?
3. ✅ Command matches `REFERENCE.md`?
4. ✅ No temp files created?
5. ✅ Guardian passed all rules?
6. ✅ A11y confirmed WCAG contrast?
7. ✅ All Text layers have `w={fill}`?
8. ✅ Main screen frames have `p={16}` margin?
9. ✅ NO emojis used as icons — proper SVG or `<Icon>` components only?
