# Figma Gemini CLI (`figma-gemini-cli`)

A professional Node.js-based command-line interface that provides direct, programmatic control over the Figma Desktop application. By utilizing either a patched Chrome DevTools Protocol (CDP) connection or a local WebSocket-bridged plugin environment, it bypasses official API key requirements and enables lightning-fast batch operations.

## Features

- **Direct Figma Manipulation**: Full programmatic access without requiring API keys.
- **High-Performance Architecture**: Uses a persistent background daemon to proxy commands, achieving up to 10x faster execution.
- **Robust Layout Engine**: Evaluates JSX-style declarations directly into native Figma nodes with smart positioning.
- **Design Token Automation**: Integrates advanced design systems (like Tailwind CSS and custom IDS Base colors) effortlessly.

## Architecture

The CLI relies on a modern, Object-Oriented command router (`CliRouter`) with robust dependency injection.

- **Transport Layer**: Negotiates CDP or Plugin WebSocket connections to interact with the Figma VM.
- **Orchestration Daemon**: Maintains persistent connection health and minimizes command latency.
- **Execution Engine**: Injects JavaScript payloads into the internal Figma Plugin VM, proxying commands via a local HTTP daemon (port 3456).

## Installation

1. Ensure **Node.js >= 18** is installed on your system.
2. Install the dependencies:
   ```powershell
   npm install
   ```
3. Initialize the environment parameters and configure the Figma application:
   ```powershell
   node src/index.js init
   ```
   *Note: On macOS, ensure your terminal application is granted Full Disk Access (System Settings → Privacy & Security) to successfully patch Figma for CDP.*

## Quick Start

You can operate the CLI in two primary modes.

### 1. CDP Mode (Recommended)
This mode automatically negotiates the patch process for the Figma Desktop app, providing an autonomous, stable CDP connection.
```powershell
node src/index.js connect
```

### 2. Safe Mode
Uses the built-in Figma plugin instead of modifying the native application. This requires manually starting the plugin in Figma (Plugins → Development → FigCli).
```powershell
node src/index.js connect --safe
```

Once connected, check your connection status:
```powershell
node src/index.js status
```

For full documentation and all supported commands, refer to the [Command Reference](REFERENCE.md). For AI guidelines and quick tips, refer to [GEMINI.md](GEMINI.md).
