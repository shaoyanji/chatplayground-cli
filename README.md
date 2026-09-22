# ChatPlayground CLI (`chatplayground`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Models](https://img.shields.io/badge/Models-36%2B%20Available-orange.svg)](#-supported-models)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

> A lightning-fast, terminal-native CLI to query AI models and generate images via [ChatPlayground AI](https://web.chatplayground.ai/). Defaulted to **Claude Sonnet 5** (`claude-sonnet-5-l`) with real-time streaming, vision inputs, multi-turn REPL, and **GPT Image 2** generation.

---

## ✨ Features

- ⚡ **Native HTTP Streaming**: Real-time typewriter output directly from the API—no heavy browser automation required for queries.
- 🤖 **Claude Sonnet 5 by Default**: Pre-configured to query Anthropic's latest flagship model at [`https://web.chatplayground.ai/chat/claude-sonnet-5-l`](https://web.chatplayground.ai/chat/claude-sonnet-5-l).
- 🎨 **Image Generation with GPT Image 2**: Generate visuals at multiple aspect ratios and save directly to disk via [`https://web.chatplayground.ai/generate-image/gpt-image-2`](https://web.chatplayground.ai/generate-image/gpt-image-2).
- 🖼️ **Multimodal Vision Input**: Pass local images or remote URLs (`-i / --image`) for analysis, code debugging, or image-to-image prompts.
- 🔁 **36+ AI Models**: Switch seamlessly between models using natural aliases (`-m gemini`, `-m gpt`, `-m deepseek`, `-m grok`, `-m opus`, etc.).
- 💬 **Interactive Multi-Turn REPL**: Conversational memory with `chatId` persistence, live model switching, and image attachments.
- 🛡️ **Stealth Browser Login**: Automated Google OAuth anti-bot bypass for one-time setup, with headless background session auto-refresh.
- 🚰 **Standard Input Piping**: Easily pipe terminal output, logs, or codebases directly into the prompt.

---

## 📦 Installation

### Option 1: Global NPM Install (Recommended)
```bash
git clone https://github.com/shaoyanji/chatplayground-cli.git
cd chatplayground-cli
npm install -g .
```

### Option 2: Run Directly with Node / NPX
```bash
node bin/cli.js --help
```

---

## 🔑 Authentication

ChatPlayground AI secures model endpoints with Clerk. Choose either authentication method:

### Method A: One-Time Browser Sign-In (Recommended)
```bash
chatplayground login
```
*Opens a Chromium/Helium window with Google OAuth stealth settings enabled. Sign in with Google or Email. The CLI saves your session and will automatically renew tokens in the background headlessly.*

### Method B: Direct Token Copy (No Browser Automation)
1. Open [https://web.chatplayground.ai](https://web.chatplayground.ai) in your normal browser and log in.
2. Open DevTools (<kbd>F12</kbd>), navigate to the **Console** tab, and run:
   ```javascript
   copy(await window.Clerk.session.getToken())
   ```
3. Paste it in your terminal:
   ```bash
   chatplayground login <pasted_token>
   ```

---

## 🚀 Quick Usage

### 1. Ask Claude Sonnet 5 (Default)
```bash
chatplayground "Explain the difference between WebSockets and Server-Sent Events"
```

### 2. Multimodal Vision Analysis (`-i` / `--image`)
```bash
# Analyze a local screenshot or photo
chatplayground -i screenshot.png "What does this stack trace mean?"

# Analyze a remote image URL
chatplayground -i https://example.com/architecture.png "Summarize this system architecture"
```

### 3. Image Generation (`gpt-image-2`)
```bash
# Basic image generation
chatplayground generate-image "A futuristic cyberpunk city at twilight with glowing neon signs"

# Specify size (1024x1024, 1536x1024, or 1024x1536) and download to file:
chatplayground generate-image --size 1536x1024 --output city.png "Serene Japanese zen garden in autumn"

# Image-to-image / Reference image:
chatplayground generate-image -i sketch.png "Turn this sketch into a photorealistic render"
```

### 4. Switch Between AI Models (`-m` / `--model`)
```bash
# Using convenient shorthand aliases:
chatplayground -m gemini "Compare Go and Rust concurrency models"
chatplayground -m gpt "Write a quicksort implementation in Python"
chatplayground -m deepseek "Solve this complex logic puzzle"
chatplayground -m grok "Summarize the latest developments in nuclear fusion"
chatplayground -m opus "Draft an in-depth essay on artificial intelligence governance"
chatplayground -m mistral "Explain Docker containerization and namespaces"
```

### 5. Change Permanent Default Model
```bash
chatplayground set-model gemini-3.8-flash-l   # Changes default to Gemini
chatplayground set-model claude-sonnet-5-l    # Changes default back to Claude Sonnet 5
```

### 6. Interactive Multi-Turn REPL
Run without arguments to enter conversational mode:
```bash
chatplayground
# or
chatplayground repl
```
Inside REPL:
- `/image <path> [prompt]` – Attach and analyze images
- `/model <name>` – Switch AI models on the fly
- `/models` – List all models with `[Vision]` indicators
- `/clear` – Clear conversation history
- `/status` – View active session and turn count
- `/exit` – Exit REPL

### 7. Unix / PowerShell Pipe Support
```bash
# PowerShell
Get-Content package.json | chatplayground "Summarize the project dependencies"

# Bash / Zsh
cat server.log | chatplayground "Identify any anomalous 500 errors"
```

---

## 📋 Supported Models

Run `chatplayground models` to see the live list of all 36 available models:

| Bot ID | Display Name | Provider | Capabilities | Alias |
| :--- | :--- | :--- | :--- | :--- |
| `claude-sonnet-5-l` | **Claude (Latest Model)** | Anthropic | Vision, Text *(Default)* | `claude`, `sonnet` |
| `claude-opus-5` | **Claude Opus 5** | Anthropic | Vision, Text | `opus` |
| `claude-fable-5` | **Claude Fable 5** | Anthropic | Vision, Text | `fable` |
| `gpt-5.6-sol` | **ChatGPT-5.6 Sol** | OpenAI | Vision, Text | `gpt`, `sol` |
| `gemini-3.8-flash-l` | **Gemini (Latest Model)** | Google | Vision, Text | `gemini`, `flash` |
| `deepseek-r1` | **DeepSeek R1** | DeepSeek | Reasoning, Text | `deepseek`, `r1` |
| `grok-4.6` | **Grok 4.6** | xAI | Vision, Text | `grok` |
| `llama-4-maverick` | **Llama 4 Maverick** | Meta | Vision, Text | `llama`, `maverick` |
| `gpt-image-2` | **GPT Image 2** | OpenAI | Image Generation | `gpt-image-2` |
| `gpt-image-1.5` | **GPT Image 1.5** | OpenAI | Image Generation | `gpt-image-1.5` |

---

## 🛠️ CLI Options Reference

```text
USAGE:
  chatplayground [options] [prompt]
  chatplayground <command> [options]

COMMANDS:
  login [token]       Log in via browser or save session token
  logout              Log out and clear stored session
  whoami, status      Check authentication and active user
  models              List all available models and capabilities
  set-model <botId>   Set your preferred default model
  generate-image <p>  Generate image using GPT Image 2
  repl                Start interactive multi-turn chat session

OPTIONS:
  -m, --model <id>        Specify model by ID or alias
  -i, --image <file/url>  Attach image for vision analysis or reference
  --size <size>           Image generation size: 1024x1024, 1536x1024, 1024x1536
  -o, --output <file>     Download and save generated image to file
  -t, --token <token>     Pass Clerk session token directly
  --raw                   Print raw text without formatting
  -h, --help              Show help message
  -v, --version           Show version
```

---

## 🏗️ Architecture

```
chatplayground-cli/
├── bin/
│   └── cli.js            # Main CLI entrypoint and argument parser
├── lib/
│   ├── api.js            # Core HTTP streaming client (azure/lmsys/perplexity)
│   ├── auth.js           # Credential store and headless refresh manager
│   ├── browser.js        # Playwright & Helium stealth browser integration
│   ├── image_gen.js      # GPT Image 2 generation and image downloader
│   ├── models.js         # Model cache, alias resolution, and defaults
│   ├── repl.js           # Multi-turn interactive readline interface
│   └── upload.js         # Multipart asset uploader to temp-file-host
├── package.json
├── LICENSE               # MIT License
└── README.md
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
