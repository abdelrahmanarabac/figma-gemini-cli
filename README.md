# Figma Gemini CLI 🎨🤖

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Figma](https://img.shields.io/badge/Figma-Desktop-blue.svg)](https://www.figma.com/)

A professional Node.js-based command-line interface that provides direct, programmatic control over the Figma Desktop application. By utilizing a secure, local WebSocket-bridged plugin environment, it enables lightning-fast batch operations, AI-driven design generation, and advanced token management with absolute production stability.

---

## 🚀 Key Features

*   **Secure Plugin Architecture**: Uses a local WebSocket bridge to communicate with a dedicated Figma plugin, ensuring no risk to the Figma binary.
*   **AI Design Generation**: Leverage Google Gemini to transform natural language prompts into native Figma layouts and components.
*   **High-Performance JSX Engine**: Render complex UI structures using a specialized JSX-to-Figma AST parser.
*   **Advanced Token Management**: Instant injection of industry-standard palettes (Tailwind CSS, Radix UI, Shadcn/UI) and custom design tokens.
*   **Architecture-First Design**: Decoupled transport layers and a command-based routing system for high maintainability.

---

## 📦 Installation

### Requirements
*   **Node.js**: v18.0.0 or higher.
*   **Figma Desktop**: The CLI interacts with the local desktop application.

### Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/abdelrahmanarabac/figma-gemini-cli.git
   cd figma-gemini-cli
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install the Figma Plugin**:
   *   Open Figma Desktop.
   *   Go to **Plugins -> Development -> Import plugin from manifest...**.
   *   Select the `plugin/manifest.json` file from this repository.

---

## ⚡ Quick Start

1. **Establish a connection**:
   ```bash
   node src/index.js connect
   ```
   *Follow the instructions to open the FigCli plugin in Figma.*

2. **Check your status**:
   ```bash
   node src/index.js status
   ```

3. **Render your first UI element**:
   ```bash
   node src/index.js render '<Frame name="Hero" w={400} h={200} bg="#000" rounded={12} flex="col" items="center" justify="center"><Text color="#fff">Hello Figma!</Text></Frame>'
   ```

---

## 🛠 Core Commands

### Connection & Maintenance
| Command | Description |
| :--- | :--- |
| `connect` | Starts the daemon and initiates the Figma connection. |
| `status` | Displays the health of the daemon and plugin connection. |

### Design & Rendering
| Command | Description |
| :--- | :--- |
| `ai "prompt"` | Generates Figma layouts using Gemini AI. |
| `render [jsx]` | Renders a JSX string or file into the current Figma page. |
| `render-batch [json]` | Executes a sequence of rendering commands for complex scenes. |

### Design Tokens
| Command | Description |
| :--- | :--- |
| `tokens tailwind` | Injects the full Tailwind CSS color palette as Figma variables. |
| `tokens clear` | Wipes all local variables and collections from the document. |
| `tokens preset shadcn` | Creates primitive and semantic token sets for shadcn/ui. |
| `tokens spacing` | Generates a 4px-base spacing scale. |

---

## 🏗 Project Architecture

The project is built on a modular architecture designed for performance and extensibility:

*   **`src/cli/`**: The framework layer, handling command routing, dependency injection, and execution context.
*   **`src/commands/`**: Pure command implementations. Each file represents a domain-specific capability.
*   **`src/core/`**: The engine room. Contains the Gemini AI integration logic.
*   **`src/transport/`**: Manages the communication lifecycle between the CLI and the Figma VM via a background daemon.
*   **`src/parser/`**: A custom JSX parser that maps declarative attributes to native Figma API methods.
*   **`plugin/`**: The bridge between the system and the Figma environment.

---

## 🎨 Design Systems & Tokens

The CLI is optimized for modern design system workflows. It treats **Figma Variables** as first-class citizens. Using the `tokens` command suite, you can programmatically define, update, and clear thousands of variables in milliseconds, bypassing the manual UI bottlenecks.

Pre-bundled palettes include:
*   **Tailwind CSS**: 240+ professional color primitives.
*   **Radix UI**: 156 color steps across 13 families.
*   **Shadcn/UI**: Ready-to-use semantic tokens for Light and Dark modes.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for the Figma Community by [abdelrahmanarabac](https://github.com/abdelrahmanarabac)**
