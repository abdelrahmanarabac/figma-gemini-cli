---
name: figma-ui-generator
description: Generate high-fidelity Figma UI components using a custom JSX-like syntax. Enforces production-grade aesthetics and Figma-native Auto Layout logic.
---

# Expert: High-Fidelity Figma UI Architect (figma-ui-generator)

## 1. Purpose
To generate production-ready Figma UI components that strictly adhere to the project's design system, layout logic, and PowerShell-safe execution standards.

## 2. Triggering
- **Primary Trigger:** Any request to "create," "design," "render," or "modify" a UI component, layout, or style.
- **Prerequisite:** The `init-cli` expert should have already been initialized to provide context on existing tokens.

## 3. Expected Inputs
- A design requirement (e.g., "Create a modern login card").
- Current design tokens (retrieved via `var list` and `style list`).
- (Optional) Existing Node ID for modifications.

## 4. Step-by-Step Execution Workflow (The Protocol)
1. **Token Inventory (Mandatory):**
   - Run `node src/index.js var list` and `node src/index.js style list`.
   - Identify existing variables for colors, spacing, and typography.
2. **Missing Token Protocol:**
   - If a requested style lacks a token, propose the new token name/value.
   - Obtain user permission before using raw values or creating new tokens.
3. **JSX Architecture (The "Perfect" Component):**
   - **Root Frame:** MUST define fixed numeric `w` and `h` (e.g., `w={1440} h={1024}`).
   - **Sub-Frames:** Explicitly define `w` and `h` using numbers, `fill`, or `hug`.
   - **Styling:** Use `rounded={12}`, `p={24}`, `gap={16}` as defaults.
   - **Icons:** Use `<SVG content={...} w={24} h={24} />`. Never use text placeholders.
4. **Shell Compatibility (The Windows Rule):**
   - Wrap ALL property values in curly braces: `{}`.
   - Escape ALL dollar signs (`$`) as `` `$ ``.
   - Use the `--code` flag for complex JSX to avoid PowerShell redirection issues.
5. **Execution:**
   - For new designs: `node src/index.js render --code "..."`.
   - For modifications: `inspect <id>` then `update <id> --code "..."`.

## 5. Constraints & Forbidden Actions (CRITICAL)
- **NO Padding:** Use `p`, `px`, `py`, etc.
- **NO Layout:** Use `flex={row}` or `flex={col}`.
- **NO Raw Values:** Forbidden for colors, spacing, and typography if a token is available.
- **NO Recreations:** Never delete and recreate a node; always use `update` with ID preservation.
- **NO Unit Labels:** Use raw numbers only (e.g., `p={24}`, not `p={24px}`).

## 6. Output Format
- Direct execution of the rendering command.
- A concise confirmation of the layout logic and token usage.
- High-fidelity, functional, and aesthetically modern UI results.
