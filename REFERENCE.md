# Command Reference — figma-gemini-cli (MoE Design Agent)

> Every command funnels through the **Mix-of-Experts pipeline**. Experts are scored, dispatched, and their outputs chained before anything hits the Figma canvas.

---

## 1. Connection & Status

| Command | Description |
|---|---|
| `connect` | Start the Figma bridge (daemon + plugin WebSocket relay) |
| `connect --safe` | Manual plugin-based connection (no CDP) |
| `status` | Verify bridge health (daemon alive, plugin connected) |

```powershell
node src/index.js connect        # auto CDP routing
node src/index.js connect --safe # manual plugin mode
node src/index.js status         # check connection
```

---

## 2. MoE Generation Pipeline

### `generate <description>` — MoE UI Synthesis
Routes through **all 8 experts**: Orchestrator parses intent → TokenExpert ensures tokens → Builder selects template → UXWriter provides copy → Visual matches icons → Guardian validates → A11y checks contrast → Responsive analyzes breakpoints.

| Flag | Effect |
|---|---|
| `--verbose` / `-v` | Print full pipeline trace (expert scores, decisions, timing) |
| `--dry-run` | Execute pipeline without requiring a live Figma render |
| `--mode <mode>` | Theme mode: `Light` or `Dark` (default: Light) |

```powershell
# Full AI synthesis with expert pipeline
node src/index.js generate "A modern login card with email and password fields"

# Verbose — see which experts fired and why
node src/index.js generate "A stat card showing `$12,500 revenue with +12% growth" --verbose

# Dry-run — inspect pipeline output without rendering
node src/index.js generate "A pricing page with 3 tiers" --dry-run
```

When Guardian reports errors, generation stops before render and exits non-zero.

**Pipeline trace output:**
```
🧠 [intent] Action: generate, Tags: [component]
🔀 [gate] Selected 8 experts: guardian(1.00), builder(0.95), a11y(0.75),
          token-expert(0.60), ux-writer(0.50), analyzer(0.40),
          visual(0.40), responsive(0.40)
⚡ → builder (0.95) → matched card/stat template
⚡ → a11y (0.75) → WCAG check: 7.2:1 ✓
⚡ → token-expert (0.60) → 2 raw colors → token recommendations
✅ Pipeline finished in 9ms
```

### Builder Templates (Auto-Matched from Description)
| Template | Triggered by |
|---|---|
| `button/primary` | "button", "CTA", "submit" |
| `button/secondary` | "secondary button" |
| `button/ghost` | "ghost button", "text button" |
| `button/destructive` | "delete button", "destructive" |
| `input/text` | "input", "field", "text field" |
| `card/basic` | "card" |
| `card/stat` | "stat card", "metric", "KPI" |
| `badge/status` | "badge", "tag", "label" |
| `nav/sidebar` | "sidebar", "navigation" |

---

## 3. Rendering (Guardian-Protected)

### `render [jsx]` — JSX to Figma Canvas
Guardian middleware validates **every render** before committing to canvas.

| Flag | Effect |
|---|---|
| `--code <jsx>` / `-c` | Inline JSX string |
| `--file <path>` / `-f` | Read JSX from file |
| `--dry-run` | Parse + Guardian validate, no live Figma connection required |
| `--verbose` | Show Guardian warnings in detail |

```powershell
# Render with Guardian pre-validation
node src/index.js render --code "<Frame w={320} h={180} bg={#ffffff} flex={col} p={24} rounded={12}>
  <Text size={20} weight={bold} color={#222} w={fill}>Alert</Text>
</Frame>"

# Dry-run with Guardian report
node src/index.js render --dry-run --code "<Frame w={400} h={300} bg={#fff} p={24}><Text>Hello</Text></Frame>"
```

If Guardian finds blocking errors during a real render, the command exits before sending anything to Figma.

**Guardian validation output:**
```
Guardian: 0 errors, 2 warnings, 1 info
  [!] [NO_RAW_COLORS] Frame: Raw hex color detected. Prefer design token references.
  [!] [NO_RAW_COLORS] Text: Raw hex color detected. Prefer design token references.
  [i] [NAMING] Frame: Node uses default generic name.
```

### Guardian Rules
| Rule | Severity | What It Catches |
|---|---|---|
| `NO_RAW_COLORS` | warning | Hex fills/strokes that should be tokens |
| `ROOT_SIZING` | error | Root frames without fixed numeric w/h |
| `NAMING` | info | Default names (Frame, Rectangle, Text) |
| `MIN_DIMENSIONS` | warning | Interactive elements < 44×44px |
| `SPACING_SCALE` | info | Spacing values not on 4px grid |

### `render-batch [jsxArray]` — Sequential Multi-Frame Render
```powershell
node src/index.js render-batch "[
  \"<Frame name={Card_1} w={300} h={200} bg={#fff}><Text>1</Text></Frame>\",
  \"<Frame name={Card_2} w={300} h={200} bg={#fff}><Text>2</Text></Frame>\"
]"
```

---

## 4. Token & Variable Management (TokenExpert Domain)

### Presets
```powershell
node src/index.js tokens tailwind   # 242-color Tailwind palette
node src/index.js tokens shadcn     # shadcn/ui tokens (Light + Dark modes)
node src/index.js tokens spacing    # 4px-base geometric spacing scale
node src/index.js tokens radii      # border-radius constraints
node src/index.js tokens clear      # wipe all variables + collections
```

### W3C DTCG Import
```powershell
node src/index.js tokens w3c import "path/to/tokens.json"
node src/index.js tokens import "colors.json" --collection {Colors}
```

### Collections
```powershell
node src/index.js col create {Semantic Colors}
node src/index.js col rename {ID_OR_NAME} {New Name}
node src/index.js col delete {ID_OR_NAME}
```

### Variables
```powershell
node src/index.js var list
node src/index.js var create {primary/500} {COLOR} {#3b82f6} --collection {CollectionID}
node src/index.js var rename {ID_OR_NAME} {new/name}
node src/index.js var delete {ID_OR_NAME}
```

### Modes
```powershell
node src/index.js mode add {Semantic Colors} {Dark}
node src/index.js mode edit {Semantic Colors} {Light} {Day Mode}
node src/index.js mode multi {Semantic Colors} --from {Light} --to {Dark} --strategy {invert}
```

### Variable Binding
```powershell
node src/index.js bind fill {primary/500}
node src/index.js bind gap {spacing/md}
node src/index.js bind radius {radius/sm}
node src/index.js bind padding {spacing/lg} -n {ID1} {ID2}
```

### Styles
```powershell
node src/index.js style list
node src/index.js style update {Inter} [pattern]
```

---

## 5. Canvas Query & Mutation (Analyzer Domain)

### Inspection
```powershell
node src/index.js canvas info      # current page/selection state
node src/index.js get {1:234}      # node properties (default: selection)
node src/index.js inspect {1:234}  # deep inspect → returns JSX
node src/index.js find {Card}      # find nodes by name
```

### Mutation
```powershell
node src/index.js update {1:234} "<Frame bg={#000} />"  # update node via JSX
node src/index.js node to-component {1:234}              # convert to component
node src/index.js node delete {1:234}                    # delete node
```

---

## 6. Responsive & Skeleton (Responsive Expert Domain)

```powershell
# Clone at multiple breakpoints (375, 768, 1440)
node src/index.js responsive {Dashboard} --breakpoints {375,768,1440}

# Convert to skeleton loading state
node src/index.js skeleton {Profile_Card} --color {#e2e8f0}
```

---

## 7. Prototyping

```powershell
node src/index.js proto link {Button} {Target_Frame} --trigger {ON_CLICK} --transition {SMART_ANIMATE}
```

---

## 8. Auditing (A11y Expert Domain)

```powershell
# Accessibility audit for the current page
node src/index.js audit a11y --page

# Accessibility audit for every loaded page in the document
node src/index.js audit a11y --all
```

This audit is currently read-only and focuses on text contrast failures.

---

## 9. Exports

```powershell
node src/index.js export-zip -o {dist}
```

---

## 10. Design Workflow (Alfa)

```powershell
node src/index.js design start         # scaffold project
node src/index.js design architecture  # define screens
node src/index.js design tokens        # configure token palette
node src/index.js design status        # workflow progress
```

---

## 11. Advanced Execution

```powershell
# Inline JavaScript in Figma environment
node src/index.js eval "figma.currentPage.selection[0].fills = [{type:'SOLID', color:{r:1,g:0,b:0}}]"

# Run a JS file inside Figma
node src/index.js run path/to/script.js
```

---

## 12. Data Hydration

```powershell
# Inject JSON data into Figma components matching layer names starting with #
node src/index.js hydrate {data.json} {Card_Component} --clone
```



## 14. Utilities

```powershell
node src/index.js send-feedback "Great tool!"
```

---

## Appendix: MoE Agent Files

| File | Expert | Gate | Priority |
|---|---|---|---|
| `src/agents/expert.js` | Base class | — | — |
| `src/agents/orchestrator.js` | 🧠 Orchestrator | Router | — |
| `src/agents/guardian.js` | 🛡️ Guardian | 1.00 | 90 |
| `src/agents/builder.js` | 🏗️ Builder | 0.95 | 30 |
| `src/agents/a11y-expert.js` | ♿ A11y | 0.75 | 85 |
| `src/agents/token-expert.js` | 🎨 TokenExpert | 0.60 | 10 |
| `src/agents/ux-writer.js` | ✏️ UXWriter | 0.50 | 25 |
| `src/agents/analyzer.js` | 🔍 Analyzer | 0.40 | 5 |
| `src/agents/visual-expert.js` | 🖼️ Visual | 0.40 | 20 |
| `src/agents/responsive-expert.js` | 📱 Responsive | 0.40 | 70 |
| `src/agents/index.js` | Loader | — | — |
| `src/memory/design-memory.js` | 🗄️ Memory | — | — |
