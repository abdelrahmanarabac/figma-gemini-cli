---
name: init-cli
description: Specialized initialization sequence for the figma-cli project. Prepares the agent with full project context, design rules, and security constraints.
---

# Expert: Project Initialization & Architectural Bootloader (init-cli)

## 1. Purpose
To transition the agent from a generic assistant to a specialized "Senior UI Systems Architect" by executing a mandatory, multi-step project inspection and configuration sequence.

## 2. Triggering
- **Primary Trigger:** The command `hello`.
- **Secondary Trigger:** Any instruction to "initialize," "set up the project," or "prepare environment."
- **Prerequisite:** This skill must be the first expert activated in a new session.

## 3. Expected Inputs
- Access to the root directory of the `figma-cli` repository.
- Presence of `GEMINI.md` and `REFERENCE.md`.

## 4. Step-by-Step Execution Workflow (The Protocol)
1. **Full Project Inspection:**
   - Recursively scan all folders and source files.
   - Identify the rendering pipeline (`src/commands/render.js`, `src/parser/jsx.js`).
   - Locate reverse JSX logic and identify Figma plugin code in `plugin/`.
   - Map the CLI command structure in `src/cli/router.js`.
2. **Documentation Priority (Mandatory Read):**
   - Read `GEMINI.md` and `REFERENCE.md` in their entirety.
   - Extract all rules, constraints, and operational mandates.
   - Internalize the "Architectural Mandates" and "High-Fidelity Designer Standards."
3. **Design Rules Alignment:**
   - Map the spacing systems (`p`, `gap`), typography hierarchy, and icon usage rules.
   - Verify available design tokens (`node src/index.js var list`).
4. **Environment Sanitization:**
   - Verify connection status using `ctx` abstraction.
   - Ensure NO temporary artifacts remain in the workspace.

## 5. Constraints & Forbidden Actions (CRITICAL)
- **NO Source Printing:** Do NOT print internal implementation code or system files to the user.
- **NO File Creation:** Do NOT generate temporary files (e.g., `.js`, `.json`) to force rendering.
- **NO Deprecated Modules:** Block any use of `FigmaClient` or `FigJamClient`.
- **NO Raw Values:** All initialization checks must prioritize tokenized design systems.

## 6. Output Format
- A structured, high-level summary of the system state.
- Confirmation that the Architectural Mandates have been internalized.
- **Strictly Professional Tone:** Direct, concise, and focused on technical readiness.
