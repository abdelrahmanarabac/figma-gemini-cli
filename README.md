# Figma Gemini CLI 🎨🤖

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Figma](https://img.shields.io/badge/Figma-Desktop-blue.svg)](https://www.figma.com/)

A professional Node.js-based command-line interface for driving Figma Desktop through a local plugin bridge. The current surface focuses on guarded rendering, automated generation via AI, auditing, and token-driven workflows.

---

## ⚠️ Experimental Status

This CLI is currently **experimental and under active development**.
Features, commands, and APIs may change frequently as the project evolves.

Use it for testing, experimentation, and development workflows, but expect breaking changes between versions.

FigJam commands are currently disabled and hidden from the CLI until their transport layer is implemented.

### 💡 Feedback & Support

We highly encourage users to report bugs or provide feedback to help us improve. You can:
- Use the built-in command: `node src/index.js send-feedback "Your message"`
- Open an issue on [GitHub Issues](https://github.com/abdelrahmanarabac/figma-gemini-cli/issues)

---

## 🛠 Prerequisites

Before using this tool, ensure you have the following installed:

### 1. Node.js
Version **v18.0.0** or higher is required.

### 2. Figma Desktop
The CLI interacts directly with the local Figma Desktop application.

## 📦 Full Setup

Follow these steps to get the project running locally:

```bash
# 1. Clone the repository
git clone https://github.com/abdelrahmanarabac/figma-gemini-cli.git

# 2. Enter the project directory
cd figma-gemini-cli

# 3. Install project dependencies
npm install

# 4. Install the Figma Plugin by
# - Open Figma Desktop
# - Go to Plugins -> Development -> Import plugin from manifest...
# - Select 'plugin/manifest.json' from this folder
```

---

## ⚡ Quick Start

1. **Start the connection**:
   ```bash
   node src/index.js connect
   ```
   *Note: Open the "FigCli" plugin in Figma after running this.*

2. **Verify connection**:
   ```bash
   node src/index.js status
   ```

3. **Generate a design via the pipeline**:
   ```bash
   node src/index.js generate "Create a modern login screen for a SaaS app with dark mode"
   ```

4. **Inspect a generation without rendering to Figma**:
   ```bash
   node src/index.js generate "Create a pricing page with 3 tiers" --dry-run --verbose
   ```

---

## 📖 Command Reference

### 🔌 Connection & Lifecycle
Manage the bridge between your terminal and the Figma application.

| Command | Description | Example |
| :--- | :--- | :--- |
| `connect` | Starts the daemon and initiates the plugin connection. | `node src/index.js connect` |
| `status` | Checks if the daemon and plugin are correctly linked. | `node src/index.js status` |

### 🤖 Generative & Design
High-level commands for creating and rendering UI elements.

| Command | Description | Example |
| :--- | :--- | :--- |
| `generate <description>` | Runs the generation pipeline and renders when validation passes. | `node src/index.js generate "Create a pricing table"` |
| `render <jsx>` | Renders a JSX string directly into Figma. | `node src/index.js render '<Frame bg="#f0f" w={100} h={100} />'` |
| `render-batch` | Executes a sequence of rendering commands from a file. | `node src/index.js render-batch ./scene.json` |
| `audit a11y --page` | Audits text contrast on the current page. | `node src/index.js audit a11y --page` |

### 💎 Design Tokens
Advanced management of Figma Variables and color palettes.

| Command | Description | Example |
| :--- | :--- | :--- |
| `tokens tailwind` | Injects the full Tailwind CSS palette. | `node src/index.js tokens tailwind` |
| `tokens preset` | Adds specific sets (e.g., `shadcn`, `radix`). | `node src/index.js tokens preset shadcn` |
| `tokens spacing` | Creates a standardized 4px-base spacing scale. | `node src/index.js tokens spacing` |
| `tokens clear` | **Destructive**: Wipes all local variables/collections. | `node src/index.js tokens clear` |
| `tokens import` | Imports a JSON token file into a collection. | `node src/index.js tokens import ./my-tokens.json` |

### 🛠 Utilities
Helper commands for documentation and export workflows.

| Command | Description | Example |
| :--- | :--- | :--- |
| `export` | Export tokens to 11 formats (JSON, CSS, SCSS, Tailwind, TypeScript, Android, SwiftUI, Flutter, React Native). | `node src/index.js export --all -o ./tokens` |
| `send-feedback` | Sends feedback to the maintainer. | `node src/index.js send-feedback "Great tool"` |

---

## 🏗 Project Architecture

*   **`src/cli/`**: The routing and execution engine.
*   **`src/commands/`**: Modular command definitions.
*   **`src/pipeline/`**: Explicit design generation and validation workflow (prepare → build → validate).
*   **`src/transport/`**: Background daemon handling WebSocket traffic.
*   **`src/parser/`**: JSX-to-Figma AST translation logic.
*   **`src/utils/`**: Helper and abstraction utilities (file IO, common figma actions).
*   **`plugin/`**: Native Figma environment bridge with strict Logic and UI separation.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🎖 Acknowledgments

Special thanks to **[silships](https://github.com/silships)** for the inspiration, support, and contributions that helped shape key parts of this project.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for the Figma Community by [abdelrahmanarabac](https://github.com/abdelrahmanarabac)**
