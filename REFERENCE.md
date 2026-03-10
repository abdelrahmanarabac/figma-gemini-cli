# Command Reference

The `figma-gemini-cli` provides an extensive suite of commands manipulating the Figma workspace, design tokens, and FigJam boards.

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
node src/index.js daemon status
node src/index.js daemon restart
```

---

## 2. Variables & Design Tokens

Inject, manage, and audit variable definitions seamlessly.

### Provision Token Libraries
```powershell
# Base UI framework primitives
node src/index.js tokens ds

# Full 242-color Tailwind palette
node src/index.js tokens tailwind

# Predefined geometric spacing values
node src/index.js tokens spacing

# Standardized border corner radii constraints
node src/index.js tokens radii
```

### Manage Variable Collections
```powershell
# Enumerate all accessible variables
node src/index.js var list

# Enumerate all local styles (Text, Paint, Effect, Grid)
node src/index.js style list

# Search for a distinct variable format
node src/index.js var find "primary/*"
```

# Create a variable procedurally
node src/index.js var create "primary/500" -c "CollectionId" -t COLOR -v "#3b82f6"

# Create a new collection block
node src/index.js col create "Semantic Colors"
```

### Bind Extracted Variables
Apply existing design tokens against specific structural elements.

```powershell
node src/index.js bind fill "primary/500"
node src/index.js bind gap "spacing/md"
node src/index.js bind radius "radius/sm"

# Apply specifically to targeted Layer IDs
node src/index.js bind padding "spacing/lg" -n "ID1" "ID2"
```

---

## 3. Element Creation & Layout

Construct primitive vector shapes or deploy robust semantic AST templates directly on the canvas.

### Generate Simple Primitives
```powershell
# Commands can be executed securely in PowerShell environments
node src/index.js create rect "Card" -w 320 -h 200 --fill "#fff" --radius 12
node src/index.js create text "Welcome" -s 24 -c "#000" -w bold
node src/index.js create icon lucide:star -s 24 -c "#f59e0b"
node src/index.js create image "https://example.com/placeholder.png" -w 400
node src/index.js create autolayout "Stack" -d col -g 16 -p 24
```

### Render Expressive JSX
Leverages the robust parser mapping declarative attributes to their native Figma API equivalents. Use multiple lines or save to a variable to avoid syntax errors inside PowerShell.
```powershell
node src/index.js render "<Frame w={320} h={180} bg=\"#fff\" flex=\"col\" p={24}>
  <Text size={20} weight=\"bold\" color=\"#222\">Success Alert</Text>
</Frame>"
```

### Iterative Multi-Frame Renders
```powershell
node src/index.js render-batch '[
  "<Frame name=\"First_Child\" w={300} h={200} bg=\"#fff\"><Text>1</Text></Frame>",
  "<Frame name=\"Second_Child\" w={300} h={200} bg=\"#fff\"><Text>2</Text></Frame>"
]' -d row -g 40
```

---

## 4. Query & Mutation Operations

Search, mutate, or organize existing document structures.

### Selectors & Inspection
```powershell
# View current selection and canvas details
node src/index.js canvas info

# Retrieve properties (defaults to selection if no ID provided)
node src/index.js get
node src/index.js get "1:234"

# Deep inspect and return JSX (defaults to selection)
node src/index.js inspect
node src/index.js inspect "1:234"
```

### Mutation Operations
```powershell
# Update an existing node (defaults to selection)
node src/index.js update "<Frame bg=\"#000\" />"
node src/index.js update "1:234" "<Frame bg=\"#000\" />"
```

### Geometric Modifications
```powershell
node src/index.js set fill "#3b82f6" -n "1:234"
node src/index.js set autolayout row -g 8 -p 16 -n "1:234"
node src/index.js set pos 100 100
node src/index.js sizing hug
node src/index.js align center
```

### Organizational Hygiene
```powershell
# Grid arrangement
node src/index.js arrange -g 100 -c 3

node src/index.js node tree "1:234" -d 5
node src/index.js node to-component "1:234"
node src/index.js node delete "1:234"
```

---

## 5. Exports & Static Analysis

Generate assets, CSS mappings, and evaluate semantic design rules.

### Exporters
```powershell
# Pixel asset extraction
node src/index.js export screenshot -o view.png
node src/index.js raw export "1:234" --scale 2 --suffix "_dark"

# Style extraction
node src/index.js export css
node src/index.js export tailwind

# Component JSX extraction
node src/index.js export-jsx "1:234" -o ExportedCard.jsx --pretty
```

### Auditing
```powershell
node src/index.js lint
node src/index.js lint --fix
node src/index.js analyze colors
node src/index.js analyze spacing
```

---

## 6. FigJam Support

FigJam implements a distinct subset of the Plugin API that demands separate abstractions.

```powershell
# Find active boards
node src/index.js fj list

# Interactively draw standard elements
node src/index.js fj sticky "Meeting Note" -x 100 -y 100 --color "#FEF08A"
node src/index.js fj shape "Process Step" -x 200 -y 100 -w 200 -h 100 --type DIAMOND
node src/index.js fj text "Header" -x 100 -y 400 --size 32

# Operations mapped strictly to the connected FigJam workspace
node src/index.js fj connect "2:30" "2:34"
node src/index.js fj move "2:30" 500 500
node src/index.js fj update "2:30" "Re-written content"
node src/index.js fj delete "2:30"
```

*Note: In FigJam, operations that define `text` inputs internally block on rendering cycles securely until internal fonts (`Inter`) are dynamically downloaded by the host system.*

---

## 7. Advanced JavaScript Techniques

Deploy complex logic directly inside the Figma application by stringifying functions.

### Switching Modes for Bound Library Variables
This function traces local bound nodes safely back to external library definitions for Mode Swapping (e.g., Light to Dark).

```javascript
// file: switch-mode.js
const nodeIds = ['1:92', '1:112'];

function findModeCollection(n) {
  if (n.boundVariables) {
    for (const [prop, binding] of Object.entries(n.boundVariables)) {
      const b = Array.isArray(binding) ? binding[0] : binding;
      if (b && b.id) {
        try {
          const variable = figma.variables.getVariableById(b.id);
          if (variable) {
            const col = figma.variables.getVariableCollectionById(variable.variableCollectionId);
            if (col && col.modes.length > 1) {
              return { col, modes: col.modes };
            }
          }
        } catch(e) {}
      }
    }
  }
  if (n.children) {
    for (const c of n.children) {
      const found = findModeCollection(c);
      if (found) return found;
    }
  }
  return null;
}

const targetNode = figma.getNodeById(nodeIds[0]);
const found = findModeCollection(targetNode);

if (found) {
  const lightMode = found.modes.find(m => m.name.includes('Light'));
  if (lightMode) {
    nodeIds.forEach(id => {
      const n = figma.getNodeById(id);
      if (n) {
        n.setExplicitVariableModeForCollection(found.col, lightMode.modeId);
      }
    });
  }
}
```

```powershell
# Execute the logic script
node src/index.js run switch-mode.js
```

### Proportional Vector Sub-Tree Scaling
Using native `.rescale()` retains corner and path relations. Calling `.resize()` improperly scales internal group constraints.
```javascript
// file: rescale.js
const n = figma.getNodeById('1:223');
n.rescale(1.5);

// Maintain explicit bounding coordinates after scale operations
const frameW = 1920, frameH = 1080;
n.x = (frameW - n.width) / 2;
n.y = (frameH - n.height) / 2;
```

```powershell
# Run the script via the CLI
node src/index.js run rescale.js
```
