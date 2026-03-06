# Figma CLI - Developer & AI Reference

This document serves as the primary system prompt and operational guide for interacting with `figma-ds-cli`. It outlines connection routines, available commands, design token specifications, and crucial requirements for generating JSX structures that render reliably inside Figma.

---

## Connection Modes

The CLI must establish a connection before performing any canvas operations.

### Yolo Mode (Recommended)
Automatically connects via Chrome DevTools Protocol (CDP).
```powershell
node src/index.js connect
```

### Safe Mode
Requires launching the local plugin first (Plugins → Development → FigCli).
```powershell
node src/index.js connect --safe
```


## Quick Actions & Basic Usage

| Action | Command |
| ------ | ------- |
| Establish connection | `node src/index.js connect` |
| View current selection | `node src/index.js canvas info` |
| Generate a rectangle | `node src/index.js render '<Frame bg="#111" w={200} h={100}></Frame>'` |
| Group to a component | `node src/index.js node to-component "NODE_ID"` |
| Find an exact node | `node src/index.js find 'TargetName'` |

*Note: For all deep-dive commands, consult [`REFERENCE.md`](REFERENCE.md).*


## Design Tokens

Use design tokens rather than hardcoded colors whenever possible.

```powershell
# Load Tailwind CSS color palette (242 colors)
node src/index.js tokens tailwind

# Load primary design system variables
node src/index.js tokens ds

# Display all tokens physically on the Figma canvas
node src/index.js var visualize
```

*Note: `var list` displays existing variables. You must run one of the `tokens` commands above to actually inject them.*


## Creating Components & Workflows

When implementing structural designs (e.g., Cards, Buttons, Form Inputs):

1. **Keep components independent**: Render top-level frames separately.
2. **Convert immediately to components**: Run the `to-component` command targeting the generated Node IDs.
3. **Bind tokens externally**: Apply exact fill, stroke, and layout styles using variable binding.

**Example Workflow:**

```powershell
# 1. Render UI Elements
node src/index.js render-batch '[
  "<Frame name=\"TestButton1\" w={120} h={40} bg=\"#fff\" rounded={8}></Frame>",
  "<Frame name=\"TestButton2\" w={120} h={40} bg=\"#fff\" rounded={8}></Frame>"
]'

# 2. Convert raw frames into distinct Figma Components
node src/index.js node to-component "ID1" "ID2"

# 3. Bind styling variables programmatically
node src/index.js bind fill "zinc/900" -n "ID1"
```


## JSX Rendering Syntactic Rules

The AST evaluating parser converts JSX-like inputs directly into Figma native API shapes. 

### Supported Elements
`<Frame>`, `<Rectangle>`, `<Ellipse>`, `<Text>`, `<Line>`, `<Image>`, `<SVG>`, `<Icon>`

### Essential Properties

- **Layout & Positioning**: 
  - `flex="row"` or `flex="col"` (Auto Layout)
  - `gap={16}`, `wrap={true}`
  - `justify="start|center|end|between"`
  - `items="start|center|end"`
- **Dimensions**:
  - `w={300} h={200}` (Absolute)
  - `w="fill" h="fill"` (Responsive)
- **Padding**:
  - `p={24}` (All)
  - `px={16} py={8}` (Symmetrical)
  - `pt={4} pr={8} pb={4} pl={8}` (Individual)
- **Styling**:
  - `bg="#0a0a0f"`, `stroke="#333"`, `opacity={0.8}`
  - `rounded={12}`, `shadow="0 4 12 #00000040"`

### Critical Pitfalls to Avoid

> [!WARNING]
> **Text Wrapping Failures**
> Without explicitly setting `w="fill"`, Text nodes evaluate linearly and clip dynamically resizing layouts. 
> *Ensure both the parent `<Frame>` AND the `<Text>` components apply `w="fill"` bindings!*

> [!WARNING]
> **Legacy Configuration Syntax**
> Never pass raw unmapped Figma API enumerators. 
> **Wrong**: `layout="horizontal"`, `padding={24}`, `cornerRadius={12}`
> **Correct**: `flex="row"`, `p={24}`, `rounded={12}`


## Executing JavaScript Directly

Direct evaluation (`eval`) pushes logic immediately inside the Figma VM. You must utilize the built-in Plugin API (`figma.*`).

```powershell
# Inline Evaluation
node src/index.js eval "console.log('Document Name: ' + figma.root.name);"

# Complex execution from a local file
node src/index.js run script.js
```

### Known limitations of the Evaluation Context
- The `eval` execution inherently runs silently. To log or retrieve output, explicitly call `return` or `console.log`, then query the state utilizing standard command wrappers.
- Use `rescale(factor)` when resizing complex hierarchies, as manual `resize()` can fracture inner layer relationships.


## Modifying Library Variables (Modes)

Swapping Dark/Light modes on variables native to linked external libraries involves querying a node's internal `boundVariables` list, tracing the parent collection's configurations, and enforcing the explicit mode override. 

Refer to [`REFERENCE.md`](REFERENCE.md#advanced-javascript-techniques) for the fully compliant snippet necessary to programmatically toggle these mode configurations safely.
