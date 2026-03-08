# Figma Gemini CLI 🎨🤖

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Figma](https://img.shields.io/badge/Figma-Desktop-blue.svg)](https://www.figma.com/)

A professional Node.js-based command-line interface that provides direct, programmatic control over the Figma Desktop application. By utilizing a secure, local WebSocket-bridged plugin environment, it enables lightning-fast batch operations, AI-driven design generation, and advanced token management with absolute production stability.

---

## ⚠️ Experimental Status

This CLI is currently **experimental and under active development**.
Features, commands, and APIs may change frequently as the project evolves.

Use it for testing, experimentation, and development workflows, but expect breaking changes between versions.

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

### 3. Gemini CLI
Install the official Gemini CLI globally to enable AI-powered design features:

```bash
npm install -g @google/gemini-cli
```

Then authenticate your account:

```bash
gemini auth login
```

Verify the installation:
```bash
gemini --version
```

---

## 📦 Full Setup

Follow these steps to get the project running locally:

```bash
# 1. Clone the repository
git clone https://github.com/abdelrahmanarabac/figma-gemini-cli.git

# 2. Enter the project directory
cd figma-gemini-cli

# 3. Install project dependencies
npm install

4. Gemini
gemini

# 5. Install the Figma Plugin by
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

3. **Generate a design via AI**:
   ```bash
   node src/index.js ai "Create a modern login screen for a SaaS app with dark mode"
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
| `ai <prompt>` | Generates Figma layouts using Gemini AI. | `node src/index.js ai "Create a pricing table"` |
| `render <jsx>` | Renders a JSX string directly into Figma. | `node src/index.js render '<Frame bg="#f0f" w={100} h={100} />'` |
| `render-batch` | Executes a sequence of rendering commands from a file. | `node src/index.js render-batch ./scene.json` |

### 💎 Design Tokens
Advanced management of Figma Variables and color palettes.

| Command | Description | Example |
| :--- | :--- | :--- |
| `tokens tailwind` | Injects the full Tailwind CSS palette. | `node src/index.js tokens tailwind` |
| `tokens preset` | Adds specific sets (e.g., `shadcn`, `radix`). | `node src/index.js tokens preset shadcn` |
| `tokens spacing` | Creates a standardized 4px-base spacing scale. | `node src/index.js tokens spacing` |
| `tokens clear` | **Destructive**: Wipes all local variables/collections. | `node src/index.js tokens clear` |
| `tokens import` | Imports a JSON token file into a collection. | `node src/index.js tokens import ./my-tokens.json` |

### 🛠 Utilities & FigJam
Helper commands for documentation and collaboration.

| Command | Description | Example |
| :--- | :--- | :--- |
| `export-zip` | Bundles tokens and themes into a portable ZIP. | `node src/index.js export-zip -o ./backup` |
| `fj pages` | Lists all active FigJam pages. | `node src/index.js fj pages` |
| `fj sticky` | Creates a sticky note in FigJam. | `node src/index.js fj sticky "Meeting notes"` |

---

## 🏗 Project Architecture

*   **`src/cli/`**: The routing and execution engine.
*   **`src/commands/`**: Modular command definitions.
*   **`src/core/`**: Core logic for AI and Figma communication.
*   **`src/transport/`**: Background daemon handling WebSocket traffic.
*   **`src/parser/`**: JSX-to-Figma AST translation logic.
*   **`plugin/`**: Native Figma environment bridge.

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
