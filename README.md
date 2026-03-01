# Figma Design System CLI (figma-ds-cli)

A Node.js-based command-line interface that orchestrates direct, programmatic interactions with the Figma Desktop application. It bypasses official API key requirements by utilizing either a patched Chrome DevTools Protocol (CDP) connection or a local WebSocket-bridged plugin environment. The CLI leverages an internal persistent background daemon to batch and proxy layout, rendering, and design token management scripts directly into the active Figma JavaScript VM context.

## Architecture Overview

The project employs a hybrid CLI architecture natively wrapping Commander.js, transitioning from an imperative configuration pattern toward an Object-Oriented, dependency-injected command router (`CliRouter`).

*   **Separation of Concerns:** Operations are segmented into a Transport layer (negotiating CDP and Plugin WebSocket connections), an Orchestration daemon (persisting connections for speed), and an Execution layer (evaluating JS snippets via AST parsing or direct injection).
*   **Command Dispatch:** Legacy commands are bound directly to a global Commander instance. Newer modular commands extend a base `Command` class and are dynamically registered via `CliRouter`.
*   **Dependency Injection:** The `CommandContext` class intercepts runtime execution to hydrate commands with shared dependencies—such as configuration state, the `FigmaClient`, and transport wrappers (`fastEval`, `fastRender`).
*   **Module Communication:** Command modules are highly decoupled. They communicate with the host Figma VM either by marshalling raw JavaScript code into `figmaEval` (which proxies over a local HTTP daemon on port 3456) or by spawning out-of-process `npx figma-use` instances for heavy-lifting tasks like linting and AST-based JSX rendering.

## Installation

1. Ensure Node.js `>= 18` is installed.
2. Install dependencies via your preferred package manager (e.g., `npm install`).
3. Execute the CLI via the binary alias or directly through `node src/index.js`.
4. Run the interactive setup to configure the connection and patch the Figma Desktop application:
   ```bash
   figma-ds-cli init
   ```
   *Note: On macOS, your terminal must be granted Full Disk Access (System Settings → Privacy & Security) to successfully patch the Figma application for CDP access.*

## Usage

The CLI interface supports canvas operations, token management, exports, and property extraction.

### Core Connection Commands
*   `figma-ds-cli connect [--safe]` - Bootstraps Figma and the daemon proxy. Use `--safe` to bridge via the local FigCli plugin instead of patching CDP.
*   `figma-ds-cli status` - Validates daemon health and outputs the currently connected Figma file.
*   `figma-ds-cli unpatch` - Restores the Figma Desktop application to its original state, intentionally blocking CDP remote debugging.

### Node & Canvas Operations
*   `figma-ds-cli render <jsx> [--parent <id>] [-x <n>] [-y <n>] [--fast] [--no-smart-position]` - Renders JSX via `figma-use` AST analysis. Passing `--fast` natively parses simple frames via the speed daemon.
*   `figma-ds-cli render-batch <jsonArray> [-g <n>] [-d <dir>]` - Iterates and renders an array of JSX strings sequentially.
*   `figma-ds-cli get [nodeId]` - Extracts properties, dimensions, and layout rules of an absolute node or the current selection in JSON form.
*   `figma-ds-cli find <name> [-t <type>] [-l <limit>]` - Matches nodes in the document tree by partial string names.
*   `figma-ds-cli arrange [-g <n>] [-c <cols>]` - Re-arranges frames on the active canvas into a measured structural grid.
*   `figma-ds-cli set pos <x> <y> [-n <nodeId>]` - Mutates the geometric `x` and `y` coordinates of a node.
*   `figma-ds-cli set opacity <value> [-n <nodeId>]` - Sets alpha blending opacity (0.0 to 1.0).
*   `figma-ds-cli set name <name> [-n <nodeId>]` - Overwrites the display name configuration of a node.
*   `figma-ds-cli set autolayout <direction> [-g <gap>] [-p <padding>]` - Instantiates horizontal or vertical Auto-Layout properties bounding a frame.
*   `figma-ds-cli node tree [nodeId] [-d <depth>]` - Outputs the nested hierarchical layer structure up to a given depth.
*   `figma-ds-cli node bindings [nodeId]` - Discovers attached semantic layout and color variable bindings.
*   `figma-ds-cli node to-component <nodeIds...>` - Wraps standard geometric frames into reusable Figma Components.
*   `figma-ds-cli node delete <nodeIds...>` - Systematically purges nodes via absolute IDs.
*   `figma-ds-cli export screenshot [-o <file>]` - Captures the localized canvas selection as a PNG stream.
*   `figma-ds-cli export-jsx [nodeId] [-o <file>] [--pretty] [--match-icons]` - Hydrates a Figma node AST back into a mapped React JSX footprint.

### Token & Variable Management
*   `figma-ds-cli variables list` (or `var list`)
*   `figma-ds-cli variables create <name> -c <collection> -t <type> [-v <value>]` - Enforces creation of `COLOR`, `FLOAT`, `STRING`, or `BOOLEAN` primitives.
*   `figma-ds-cli variables find <pattern>`
*   `figma-ds-cli variables visualize [collection]` - Transpiles the variable scope into physical shadcn-style color swatches mapped onto the canvas.
*   `figma-ds-cli export css` - Serializes absolute modes into deterministic CSS custom properties (`:root { ... }`).
*   `figma-ds-cli export tailwind` - Converts underlying scoped variables into a compatible Tailwind CSS theme configuration object.

### Evaluation & Analysis
*   `figma-ds-cli eval [code] [-f <file>]` - Injects arbitrary JavaScript payloads into the internal Figma Plugin VM environment.
*   `figma-ds-cli run <file>` - Standardized alias for executing larger scripts (`eval --file`).
*   `figma-ds-cli raw <command...>` - Provides raw passthrough to bypass Commander routing and execute native `figma-use` binaries.
*   `figma-ds-cli lint [--fix] [--rule <rule>] [--preset <preset>] [--json]` - Leverages external tooling to execute design heuristics constraint checks.
*   `figma-ds-cli analyze [colors|typography|spacing|clusters] [--json]` - Generates mathematical frequency distributions mapping internal consistency.

### FigJam Specifics
*   `figma-ds-cli figjam delete <nodeId> [-p <page>]`
*   `figma-ds-cli figjam move <nodeId> <x> <y> [-p <page>]`
*   `figma-ds-cli figjam update <nodeId> <text> [-p <page>]`
*   `figma-ds-cli figjam eval <code> [-p <page>]`

## Internal Structure

*   `src/index.js`: The monolithic operational entry point. Bootstraps the environment and merges the routing tables of classic Commander execution paradigms with the modern `CliRouter`.
*   `src/cli/`: Defines core abstraction models.
    *   `router.js`: Ingestion and command parsing orchestration layer.
    *   `command.js`: Object-Oriented generic contract enforcing the execution format.
    *   `context.js`: The Dependency Injection layer supplying network adapters and configuration dependencies cleanly.
*   `src/commands/`: Extracted functional domains (e.g., `analyze.js`, `status.js`, `tokens.js`) bridging legacy implementations into the newer `Command` topology.
*   `src/core/`: Contains `figma-client.js` wrapping the specific Chrome DevTools Protocol socket integrations.
*   `src/utils/`: High-order generic execution utilities, encompassing process daemon lifecycle handling (`daemon.js`) and persistent state mechanisms (`config.js`).
*   `plugin/`: Distribution output housing the specific Figma Plugin structure mapping Safe Mode's `manifest.json`.
*   `docs/`: Houses supplemental internal operation manuals.

## Extending the CLI

The project architecture relies on an OOP router for extendability. To author a new command, comply with the underlying class routing specifications:

1.  Create a fresh JavaScript module within the `src/commands/` partition.
2.  Define and export a class extending the `Command` lifecycle interface (`../cli/command.js`).
3.  Hydrate fundamental class properties: assign a descriptive `name`, `description`, define an array of `options`, and optionally dictate connection parameters (`needsConnection = true`).
4.  Implement the required asynchronous executor method:
    ```javascript
    async execute(ctx, options, ...args) { ... }
    ```
5.  Access the core runtime variables naturally via the injected `.ctx` payload (e.g., `await ctx.figmaEval('...');`).
6.  Bind the component by constructing an instance and injecting it directly against the router within the system entry file (`router.register(new CustomCommand())`).

## Error Handling Model

*   **Propagation Protocol:** Runtime errors dynamically bubble securely up into the upper `execute` routing block, intercepted centrally by `CliRouter`.
*   **Response Handling:** Faults are propagated mathematically—translating into graceful terminal outputs via `ctx.logError(msg)` containing precise chalk-styled details, returning strictly exit code `1`. Active connection handles gracefully close execution states (`ctx.close()`).
*   **Pre-execution Gating:** When an execution boundary demands network stability (`needsConnection = true`), the router enforces an infrastructure ping loop. `router._ensureConnection()` explicitly pings the background daemon `http://127.0.0.1:3456/health`. If blocked, a secondary native CDP invocation is invoked prior to terminating the operation sequence.

## Technical Decisions

*   **Daemon Proxies Over Pure Sockets:** Opening unpooled WebSocket sessions dictates expensive handshake delays. Deploying a silent continuous background process allows iterative CLI commands to circumvent latency loops, rendering execution blocks instantaneously up to ~10x execution speed.
*   **Virtual Machine Evaluation Paradigm:** Instead of manipulating complex dynamic AST layers directly, execution scripts generate JavaScript payload fragments transported linearly explicitly into the built-in Figma `eval` loop. This sacrifices strong TS compiler safety runtime typing but greatly reduces complex serialization overhead metrics.
*   **Phased Migration Topologies:** Coexisting legacy Commander functional routing beside Object-Oriented abstractions intentionally mitigates integration risks. It provides necessary scaffolding empowering developers to systematically refactor legacy monoliths isolated without interrupting foundational API backward compatibility.
