# Command Reference: figma-gemini-cli

The `figma-gemini-cli` provides a comprehensive suite of commands for manipulating the Figma workspace, managing design tokens, and automating design workflows.

---

## 1. Setup & Connection

Establish an authenticated bridge to the native Figma application.

### Start the Proxy
```powershell
# Autonomously configures CDP routing (Requires Full Disk Access on MacOS)
node src/index.js connect

# Bridge via the manual Figma Plugin interface
node src/index.js connect --safe
```

### Validate and Diagnose
```powershell
node src/index.js status
```

---

## 2. Variables & Design Tokens

Manage Figma Variables (Collections, Modes, and Values) and local Styles.

### Automated Palette Generation
```powershell
# Full 242-color Tailwind palette
node src/index.js tokens tailwind

# Predefined geometric spacing values (4px base)
node src/index.js tokens spacing

# Standardized border corner radii constraints
node src/index.js tokens radii

# Import W3C DTCG compliant tokens ($value, $type)
node src/index.js tokens w3c import "path/to/tokens.json"

# Import from a standard JSON file
node src/index.js tokens import "colors.json" --collection {Colors}

# Clear all local variables and collections
node src/index.js tokens clear
```

### Manage Variable Collections
```powershell
# Enumerate all accessible variables and collections
node src/index.js var list

# Enumerate all local styles (Text, Paint, Effect, Grid)
node src/index.js style list

# Create a variable collection
node src/index.js col create {Semantic Colors}

# Rename or delete a collection
node src/index.js col rename {ID_OR_NAME} {New Name}
node src/index.js col delete {ID_OR_NAME}
```

### Manage Individual Variables
```powershell
# Create a variable procedurally
node src/index.js var create {primary/500} {COLOR} {#3b82f6} --collection {CollectionID}

# Set a variable value for a specific mode
node src/index.js var value {primary/500} {Dark Mode} {#1e3a8a}

# Rename or delete a variable
node src/index.js var rename {ID_OR_NAME} {new/name}
node src/index.js var delete {ID_OR_NAME}
```

### Manage Variable Modes
```powershell
# Add a new mode to a collection
node src/index.js mode add {Semantic Colors} {High Contrast}

# Rename an existing mode
node src/index.js mode edit {Semantic Colors} {Light} {Day Mode}

# Batch generate a Dark mode from Light (Auto-inverts colors)
node src/index.js mode multi {Semantic Colors} --from {Light} --to {Dark} --strategy {invert}
```

### Binding Variables
Apply existing design tokens against specific structural elements.

```powershell
node src/index.js bind fill {primary/500}
node src/index.js bind gap {spacing/md}
node src/index.js bind radius {radius/sm}

# Apply specifically to targeted Layer IDs
node src/index.js bind padding {spacing/lg} -n {ID1} {ID2}
```

---

## 3. Rendering & Generation

Construct primitives or deploy robust semantic AST templates directly on the canvas.

### AI-Powered UI Synthesis
```powershell
# Synthesize a high-fidelity Figma UI from a description
node src/index.js generate {A modern login card with email and password fields}
```

### Render Expressive JSX
Leverages the robust parser mapping declarative attributes to native Figma API equivalents.
**Mandate:** Wrap all property values in `{}` and escape any `$` (e.g., `` `$ ``).

```powershell
node src/index.js render --code "<Frame w={320} h={180} bg={#ffffff} flex={col} p={24} rounded={12}>
  <Text size={20} weight={bold} color={#222222} w={fill}>Success Alert</Text>
</Frame>"
```

### Batch Rendering
```powershell
node src/index.js render-batch "[
  \"<Frame name={First_Child} w={300} h={200} bg={#fff}><Text>1</Text></Frame>\",
  \"<Frame name={Second_Child} w={300} h={200} bg={#fff}><Text>2</Text></Frame>\"
]"
```

### Advanced UI Automation
```powershell
# Inject JSON data into a component matching layer names starting with #
node src/index.js hydrate {data.json} {Card_Component} --clone

# Test layout responsiveness by generating clones at different breakpoints
node src/index.js responsive {Dashboard} --breakpoints {375,768,1440}

# Convert a UI component into a skeleton loading state
node src/index.js skeleton {Profile_Card} --color {#e2e8f0}
```

---

## 4. Query & Mutation Operations

Search, mutate, or organize existing document structures.

### Selectors & Inspection
```powershell
# View current selection and canvas details
node src/index.js canvas info

# Retrieve properties (defaults to selection if no ID provided)
node src/index.js get {1:234}

# Deep inspect and return JSX (defaults to selection)
node src/index.js inspect {1:234}

# Find nodes by name
node src/index.js find {Card}
```

### Mutation Operations
```powershell
# Update an existing node (defaults to selection)
node src/index.js update {1:234} "<Frame bg={#000000} />"
```

### Organizational Hygiene
```powershell
# Node operations: to-component, delete (defaults to selection)
node src/index.js node to-component {1:234}
node src/index.js node delete {1:234}
```

---

## 5. Prototyping

Create interactive prototypes directly from the command line.

```powershell
# Create a prototype interaction from a source node to a target node
node src/index.js proto link {Button} {Target_Frame} --trigger {ON_CLICK} --transition {SMART_ANIMATE}
```

---

## 6. Exports & Auditing

Generate assets and evaluate semantic design rules.

### Exporting
```powershell
# Export design system as zip with themes, tokens, and metadata
node src/index.js export-zip -o {dist}
```

### Auditing
```powershell
# Perform an autonomous accessibility audit for color contrast failures
node src/index.js audit a11y --page
```

---

## 7. FigJam Support

FigJam implements a distinct subset of the Plugin API that demands separate abstractions.

```powershell
# List available FigJam pages
node src/index.js fj pages

# Create a sticky note
node src/index.js fj sticky {Meeting Note} -x {100} -y {100} --color {#FEF08A}
```

---

## 8. Automated Design Workflow (Alfa)

An end-to-end workflow to scaffold and configure design systems.

```powershell
# Step 1: Scaffold a new project and research folder
node src/index.js design start

# Step 2: Define product architecture and screens
node src/index.js design architecture

# Step 3: Configure design system tokens (palette, roundness)
node src/index.js design tokens

# Check the status of the current workflow
node src/index.js design status
```

---

## 9. Advanced JavaScript Execution

Deploy complex logic directly inside the Figma application using `eval` or `run`.

### Execute Inline JavaScript
```powershell
node src/index.js eval "figma.currentPage.selection[0].fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]"
```

### Run Logic Scripts
```powershell
# Execute a JavaScript file directly in the Figma environment
node src/index.js run path/to/script.js
```
