# Command Reference — figma-gemini-cli

> The CLI uses a **lean pipeline**: `prepare` (inventory scan) → `build` (JSX compile) → `validate` (Guardian + A11y) → `render` (push to Figma). The AI agent generates all JSX.

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

## 4. Token & Variable Management

### Token Commands
```powershell
node src/index.js tokens clear      # wipe all variables + collections
node src/index.js tokens import <file> --collection {Name}  # import from JSON
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

## 5. Canvas Query & Mutation

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

## 6. Component & Property Management

Create, inspect, and manage Figma Components and Component Sets (Variants) with full property control.

### Overview

| Command | Description |
|---|---|
| `component create [id]` | Convert a selected node into a standalone Component |
| `component create-set <name> [ids...]` | Combine selected nodes into a Component Set (Variants) |
| `component add-variant <id> <name> [props...]` | Add a variant to a component or component set |
| `component list` | List all Component Sets and standalone Components in the file |
| `component find <pattern>` | Find components by name pattern |
| `component rename <id> <newName>` | Rename a component or component set |
| `component detach <id>` | Convert a component or component set back to regular frames |
| `component delete <id>` | Delete a component or component set |
| `component inspect <id>` | List all properties and variants on a Component Set |
| `component add-prop <id> <name> <type> [default]` | Add a property definition (VARIANT, BOOLEAN, TEXT, INSTANCE_SWAP) |
| `component set-prop <id> <propertyName> <value>` | Set a variant name by assigning a property value |
| `component edit-prop <id> <oldName> <newName>` | Rename a property on a Component Set |
| `component delete-prop <id> <name>` | Delete a property from a Component Set |
| `component update-text <id> <text>` | Fill empty text nodes across all variants |

### Property Types

| Type | Use Case | Example |
|---|---|---|
| `VARIANT` | Toggle between visual states | `State=Default`, `State=Hover` |
| `BOOLEAN` | Show/hide elements | `HasIcon=true` |
| `TEXT` | Customizable labels | `Label=Submit` |
| `INSTANCE_SWAP` | Swap nested components | `Icon=ChevronRight` |

### Create a Component from Selection

```powershell
# Select a node in Figma, then convert it
node src/index.js select "My Frame"
node src/index.js component create

# Or specify a node ID directly
node src/index.js component create "12:345"
```

### List All Components

```powershell
# Human-readable tree output
node src/index.js component list

# JSON output for scripting
node src/index.js component list --json
```

### Create a Component Set (Variants)

Render 4 frames with plain names, select them, and combine:

```powershell
# Step 1: Render variants with plain names
node src/index.js render --code "<Frame name={Default} w={120} h={44} ...>...</Frame>"
node src/index.js render --code "<Frame name={Hover} w={120} h={44} x={140} bg={#2563eb} ...>...</Frame>"
node src/index.js render --code "<Frame name={Pressed} w={120} h={44} x={280} bg={#1d4ed8} ...>...</Frame>"
node src/index.js render --code "<Frame name={Disabled} w={120} h={44} x={420} bg={#9ca3af} ...>...</Frame>"

# Step 2: Select all and create
node src/index.js select "Default" "Hover" "Pressed" "Disabled"
node src/index.js component create-set "Button"

# Step 3: Rename the auto-generated property
node src/index.js component edit-prop "{ID}" "Property 1" "State"
```

You can also name frames with key=value patterns (e.g., `State=Default`) — the CLI will auto-discover the property:

```powershell
# With key=value naming in frame names
node src/index.js component create-set "Button"
# Auto-discovers "State" property from names like "State=Default,State=Hover"
```

### Add a Variant to an Existing Component or Component Set

Clone the first variant, apply overrides, and add to the set:

```powershell
# Add a variant to a standalone component (auto-creates Component Set)
node src/index.js component add-variant "{ComponentID}" "Hover" "State=Hover,bg=#2563eb"

# Add a variant to an existing Component Set
node src/index.js component add-variant "{ComponentSetID}" "Pressed" "State=Pressed,bg=#1d4ed8"
```

**Property syntax:** `Key=Value` pairs for variant naming, `bg=#hex` for fill override.

### Inspect a Component Set

Shows all property definitions, variant options, defaults, and the full variant tree:

```powershell
node src/index.js component inspect "12:345"
```

**Example output:**
```
Component Set: Button (12:345)
  ● Button  [12:345]
    ├─ State=Default  [12:346]
    ├─ State=Hover  [12:347]
    ├─ State=Pressed  [12:348]
    └─ State=Disabled  [12:349]
  Properties:
    • State → VARIANT [Default, Hover, Pressed, Disabled] (default: Default)
```

### Add a Property to a Component Set

```powershell
# Boolean property
node src/index.js component add-prop "12:345" "HasIcon" "BOOLEAN" "false"

# Variant property with options
node src/index.js component add-prop "12:345" "Size" "VARIANT" "Medium"

# Text property (customizable label)
node src/index.js component add-prop "12:345" "Label" "TEXT" "Button"

# Instance swap property
node src/index.js component add-prop "12:345" "Icon" "INSTANCE_SWAP"
```

### Set a Variant Property (Rename a Variant)

Assigns `propertyName=value` to the variant's name (Figma's naming convention):

```powershell
node src/index.js component set-prop "12:346" "State" "Hover"
# Result: variant "12:346" is renamed to "State=Hover"
```

### Rename a Property

```powershell
node src/index.js component edit-prop "12:345" "Property 1" "State"
# Works even when Figma API blocks renameComponentProperty
```

### Delete a Property

Removes the property from the Component Set and cleans up all variant names:

```powershell
node src/index.js component delete-prop "12:345" "HasIcon"
```

### Update Empty Text Across Variants

Fills all empty text nodes in every variant with the provided string:

```powershell
node src/index.js component update-text "12:345" "Click me"
```

### Rename a Component or Component Set

```powershell
node src/index.js component rename "165:167" "Primary Button"
```

### Find Components by Name Pattern

Searches all components and component sets in the file:

```powershell
# Search by partial name
node src/index.js component find "Button"

# Search for all components with "icon" in the name
node src/index.js component find "icon"

# JSON output for scripting
node src/index.js component find "Card" --json
```

### Detach a Component (Convert to Frames)

Converts a component or component set back to regular frames:

```powershell
# Detach a single component to a frame
node src/index.js component detach "12:345"

# Detach an entire component set (all variants become frames)
node src/index.js component detach "12:350"
```

### Delete a Component or Component Set

```powershell
node src/index.js component delete "12:345"
```

---

## 7. Responsive & Skeleton

```powershell
# Clone at multiple breakpoints (375, 768, 1440)
node src/index.js responsive {Dashboard} --breakpoints {375,768,1440}

# Convert to skeleton loading state
node src/index.js skeleton {Profile_Card} --color {#e2e8f0}
```

---

## 8. Prototyping

```powershell
node src/index.js proto link {Button} {Target_Frame} --trigger {ON_CLICK} --transition {SMART_ANIMATE}
```

---

## 9. Auditing

```powershell
# Accessibility audit for the current page
node src/index.js audit a11y --page

# Accessibility audit for every loaded page in the document
node src/index.js audit a11y --all
```

This audit is currently read-only and focuses on text contrast failures.

---

## 10. Exports

### `export` — Design Tokens to Multiple Formats
Export variables/collections to engineering-ready formats.

| Flag | Effect |
|---|---|
| `-o, --output <dir>` | Output directory (default: `dist`) |
| `-f, --format <format>` | Output format (see list below) |
| `--all` | Export to **ALL** supported formats at once |
| `--collection <name>` | Filter to a specific collection by name or ID |
| `--list-formats` | Print all supported formats and exit |

**Supported Formats:**

| Format | File | Target Platform |
|---|---|---|
| `json` | `tokens.json` | Flat key-value (generic) |
| `w3c-dtcg` | `tokens.json` | W3C Design Tokens spec |
| `css` | `tokens.css` | CSS Custom Properties |
| `scss` | `tokens.scss` | SCSS Variables |
| `tailwind` | `tokens.js` | Tailwind CSS v3 config |
| `tailwind-v4` | `tokens.css` | Tailwind CSS v4 `@theme` |
| `typescript` | `tokens.ts` | TypeScript interfaces |
| `android` | `tokens.xml` | Android `res/values/` |
| `swiftui` | `tokens.swift` | SwiftUI `Color` extensions |
| `flutter` | `tokens.dart` | Flutter `Color` constants |
| `react-native` | `tokens.js` | React Native styles |

```powershell
# Export as CSS custom properties
node src/index.js export --format css -o ./tokens

# Export to ALL formats at once
node src/index.js export --all -o ./design-tokens

# Export only the "Semantic Colors" collection as Tailwind v4
node src/index.js export --format tailwind-v4 --collection {Semantic Colors}

# List all supported formats
node src/index.js export --list-formats

# Export W3C DTCG format for Style Dictionary pipeline
node src/index.js export --format w3c-dtcg -o ./tokens
```

---

## 11. Design Workflow (Alfa)

```powershell
node src/index.js design start         # scaffold project
node src/index.js design architecture  # define screens
node src/index.js design tokens        # configure token palette
node src/index.js design status        # workflow progress
```

### Token Sync

Direct Figma-to-Figma token synchronization. No local files involved.

```powershell
# Sync from current active file → another connected file
node src/index.js design tokens-sync --to {Design System v2}

# Sync between two specific files
node src/index.js design tokens-sync --from {MyApp_Design_v1} --to {MyApp_Design_v2}

# Sync only a specific collection
node src/index.js design tokens-sync --to {Target_File} --collection {Semantic Colors}

# Dry run (preview without changes)
node src/index.js design tokens-sync --to {Target_File} --dry-run

# Merge mode — skip tokens that already exist in target
node src/index.js design tokens-sync --to {Target_File} --merge
```

| Flag | Effect |
|---|---|
| `--from <fileId\|name>` | Source file (default: current active file) |
| `--to <fileId\|name>` | Target file (default: current active file) |
| `--collection <name>` | Sync only this collection |
| `--dry-run` | Preview what would be synced |
| `--merge` | Skip existing tokens in target |
| `--force` | Skip confirmation prompt |

> **Requires multi-file mode** — connect multiple Figma files via the plugin before syncing.
> Use `files` to list connected files, `switch <name>` to change active file.

---

## 12. Advanced Execution

```powershell
# Inline JavaScript in Figma environment
node src/index.js eval "figma.currentPage.selection[0].fills = [{type:'SOLID', color:{r:1,g:0,b:0}}]"

# Run a JS file inside Figma
node src/index.js run path/to/script.js
```

---

## 13. Data Hydration

```powershell
# Inject JSON data into Figma components matching layer names starting with #
node src/index.js hydrate {data.json} {Card_Component} --clone
```

---

## 14. Pipeline Modules

| File | Role |
|---|---|
| `src/pipeline/prepare.js` | Inventory scanner (tokens, components, styles) |
| `src/pipeline/build.js` | JSX → Figma command compiler |
| `src/pipeline/validate.js` | Guardian rules + A11y checks |
| `src/pipeline/index.js` | Pipeline orchestrator (`run()`) |
| `src/data/tokens.js` | Token utility functions (no hardcoded values) |
| `src/data/copy-patterns.js` | Copy pattern stubs (AI-driven) |
| `src/data/icons.js` | Icon stubs (AI-driven) |

---

## 15. Utilities

```powershell
node src/index.js send-feedback "Great tool!"
```
