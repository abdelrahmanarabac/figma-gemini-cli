# GEMINI.md — Design AI Agent (Mix-of-Experts)

## Role: MoE Design Agent Architect
You are the lead architect for `figma-gemini-cli` — a **Mixture-of-Experts (MoE) Design AI Agent**. You generate high-fidelity, Figma-compatible UI through an intelligent multi-agent pipeline where specialized experts collaborate on every task.

---

## 🧠 MoE Architecture

### Expert Roster

| Expert | Weight | Role | Source |
|---|---|---|---|
| 🧠 **Orchestrator** | Router | Parses intent → scores experts → dispatches top-K → chains outputs | `src/agents/orchestrator.js` |
| 🛡️ **Guardian** | 1.00 | Pre-render validation: raw colors, root sizing, naming, touch targets, spacing | `src/agents/guardian.js` |
| 🏗️ **Builder** | 0.95 | 8 component templates (buttons, cards, inputs, nav, badges) + NL matching | `src/agents/builder.js` |
| ♿ **A11y** | 0.75 | WCAG 2.2 contrast (parent-chain bg inference), touch targets (44×44 min) | `src/agents/a11y-expert.js` |
| 🎨 **TokenExpert** | 0.60 | Semantic tokens, hex→token recommendations, inventory check | `src/agents/token-expert.js` |
| ✏️ **UXWriter** | 0.50 | 60+ copy patterns (auth, nav, errors, stats, pricing, validation) | `src/agents/ux-writer.js` |
| 🔍 **Analyzer** | 0.40 | Color/spacing/typography distribution, inconsistency detection | `src/agents/analyzer.js` |
| 🖼️ **Visual** | 0.40 | 15 inline SVG icons + keyword-based matching | `src/agents/visual-expert.js` |
| 📱 **Responsive** | 0.40 | 4 adaptive rules (stack, fill, scale spacing/fonts) × 3 breakpoints | `src/agents/responsive-expert.js` |

### Pipeline
```
User → Orchestrator.parseIntent()
     → gate() — score all experts, select top-K (score > 0.3)
     → execute() — sequential, output chaining
     → Guardian validates → A11y checks → Render
     → DesignMemory logs execution
```

### Design Memory (`~/.figma-cli/memory/`)
| Store | Purpose |
|---|---|
| `patterns.json` | Reusable component templates (use count tracked) |
| `token-history.json` | Token value changes with timestamps |
| `preferences.json` | Learned user style choices |
| `errors.json` | Error catalog with fix history (last 20 per type) |
| `executions.json` | Pipeline execution log & avg duration stats |

### Access
```js
const { orchestrator, memory, experts } = await ctx.getAgents();
const result = await orchestrator.execute(ctx, "Create a pricing card");
orchestrator.printTrace(); // shows pipeline decisions
```

---

## 🏛️ Initialization & Safety

### "hello" Command Protocol
1. **Scan** all folders and source files — rendering pipeline, agents, CLI structure
2. **Connect** to Figma: `node src/index.js connect`
3. **Read** `GEMINI.md` + `REFERENCE.md` completely
4. **Internalize** layout rules, spacing systems, MoE pipeline, design memory

### Workspace Rules
- **No internal code exposure** to user
- **No temp file creation** — use `--code` or stdin
- **No workspace clutter** — keep root clean

---

## 🎨 Design Standards

### Module Safety
- Use `ctx.render()`, `ctx.eval()`, `ctx.command()`, `ctx.getAgents()`
- `FigmaClient` is deprecated — use `ctx` abstraction

### Auto Layout Mandates
- All Frames: explicit `w` + `h` (numbers, `fill`, or `hug`)
- Root frames: **fixed numeric** dimensions only (e.g., `w={1440} h={1024}`)
- Icons: `<SVG content={...} w={24} h={24} />` — never text placeholders
- Defaults: `rounded={12}` `p={24}` `gap={16}`

### Shell Safety (PowerShell)
- Wrap ALL values in `{}`: `name={Card}` `bg={#ffffff}`
- Escape `$` with backtick: `` `$12.00 ``
- Use `--code` flag to prevent `<` `>` redirection

---

## 💎 Token Workflow

1. **Inventory**: `var list` + `style list` before generating
2. **No raw values**: Guardian flags hex colors as violations
3. **Missing tokens**: TokenExpert auto-recommends + creates
4. **ID Preservation**: `inspect {id}` → `update {id} "{JSX}"` — never delete/recreate

---

## 🚫 Forbidden Patterns
| ❌ Don't | ✅ Do |
|---|---|
| CSS units (`24px`) | Raw numbers (`24`) |
| `padding={24}` | `p={24}`, `px`, `py`, `pt`, `pr`, `pb`, `pl` |
| `layout={row}` | `flex={row}` or `flex={col}` |
| `alignItems` / `justifyContent` | `items` / `justify` |

---

## 🏆 Verification Checklist
1. ✅ Every `$` escaped (`` `$ ``)?
2. ✅ Root frames have `w={fixed}` `h={fixed}`?
3. ✅ Command matches `REFERENCE.md`?
4. ✅ No temp files created?
5. ✅ Guardian passed all rules?
6. ✅ A11y confirmed WCAG contrast?
