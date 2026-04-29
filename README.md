<div align="center">

# 🔷 Vertex

DeepSeek-native proxy for Claude Code CLI.

```bash
pipx install vertex-deepseek
vertex-init    # first run: prompts for your DeepSeek API key
vertex         # start the proxy
```

</div>

## What You Get

- One-command setup: `pipx install vertex-deepseek` then `vertex`
- First run prompts for your DeepSeek API key interactively
- Drop-in proxy for Claude Code's Anthropic API calls
- DeepSeek-native backend with Anthropic-compatible Messages API
- Per-model routing: Opus → v4-pro, Sonnet/Haiku → v4-flash
- Streaming, tool use, reasoning/thinking block handling
- Change API key anytime: `vertex --logout`

## Quick Start

### 1. Install Vertex

**macOS / Linux (recommended):**
```bash
pipx install vertex-deepseek
```

**Linux (Ubuntu/Debian) — install pipx first if needed:**
```bash
sudo apt install pipx
pipx ensurepath
pipx install vertex-deepseek
```

**Alternative (any OS with virtualenv):**
```bash
pip install vertex-deepseek
```
> Ubuntu 24.04+ blocks `pip install` outside a virtualenv (PEP 668).
> Use `pipx` instead, or create a venv first.

Requires Python 3.12+ and [Claude Code](https://github.com/anthropics/claude-code).

### 2. Configure

```bash
vertex-init
```

This creates `~/.config/vertex/.env` and asks for your DeepSeek API key.
Get one at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).

To change the key later: `vertex --logout`

### 3. Start The Proxy

```bash
vertex
```

That's it. The proxy starts on `0.0.0.0:8082`.

### 4. Run Claude Code

Point `ANTHROPIC_BASE_URL` at the proxy root. Do not append `/v1`.

PowerShell:

```powershell
$env:ANTHROPIC_AUTH_TOKEN="freecc"; $env:ANTHROPIC_BASE_URL="http://localhost:8082"; claude
```

Bash:

```bash
ANTHROPIC_AUTH_TOKEN="freecc" ANTHROPIC_BASE_URL="http://localhost:8082" claude
```

## Choose A Provider

Model values use this format:

```text
provider_id/model/name
```

`MODEL` is the fallback. `MODEL_OPUS`, `MODEL_SONNET`, and `MODEL_HAIKU` override routing for requests that Claude Code sends for those tiers.

| Provider | Prefix | Transport | Key | Default base URL |
| --- | --- | --- | --- | --- |
| DeepSeek | `deepseek/...` | Anthropic Messages | `DEEPSEEK_API_KEY` | `https://api.deepseek.com/anthropic` |
| NVIDIA NIM | `nvidia_nim/...` | OpenAI chat translation | `NVIDIA_NIM_API_KEY` | `https://integrate.api.nvidia.com/v1` |
| OpenRouter | `open_router/...` | Anthropic Messages | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` |
| LM Studio | `lmstudio/...` | Anthropic Messages | none | `http://localhost:1234/v1` |
| llama.cpp | `llamacpp/...` | Anthropic Messages | none | `http://localhost:8080/v1` |
| Ollama | `ollama/...` | Anthropic Messages | none | `http://localhost:11434` |

<details>
<summary><b>NVIDIA NIM</b></summary>

Get a key at [build.nvidia.com/settings/api-keys](https://build.nvidia.com/settings/api-keys).

```dotenv
NVIDIA_NIM_API_KEY="nvapi-your-key"
MODEL="nvidia_nim/z-ai/glm4.7"
```

Popular examples:

- `nvidia_nim/z-ai/glm4.7`
- `nvidia_nim/z-ai/glm5`
- `nvidia_nim/moonshotai/kimi-k2.5`
- `nvidia_nim/minimaxai/minimax-m2.5`

Browse models at [build.nvidia.com](https://build.nvidia.com/explore/discover). A cached model list is also kept in [`nvidia_nim_models.json`](nvidia_nim_models.json).

</details>

<details>
<summary><b>OpenRouter</b></summary>

Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).

```dotenv
OPENROUTER_API_KEY="sk-or-your-key"
MODEL="open_router/stepfun/step-3.5-flash:free"
```

Browse [all models](https://openrouter.ai/models) or [free models](https://openrouter.ai/collections/free-models).

</details>

<details>
<summary><b>DeepSeek</b></summary>

Get a key at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).

```dotenv
DEEPSEEK_API_KEY="your-deepseek-key"
MODEL="deepseek/deepseek-v4-pro"
```

Available models:
- `deepseek/deepseek-v4-pro` — Full reasoning (thinking mode)
- `deepseek/deepseek-v4-flash` — Fast responses (non-thinking mode)
- `deepseek/deepseek-chat` — Legacy (deprecated 2026/07/24 → maps to v4-flash)
- `deepseek/deepseek-reasoner` — Legacy (deprecated 2026/07/24 → maps to v4-flash thinking)

This provider uses DeepSeek's Anthropic-compatible endpoint, not the OpenAI chat-completions endpoint.

</details>

<details>
<summary><b>LM Studio</b></summary>

Start LM Studio's local server, load a model, then configure:

```dotenv
LM_STUDIO_BASE_URL="http://localhost:1234/v1"
MODEL="lmstudio/your-loaded-model"
```

Use the model identifier shown by LM Studio. Prefer models with tool-use support for Claude Code workflows.

</details>

<details>
<summary><b>llama.cpp</b></summary>

Start `llama-server` with an Anthropic-compatible `/v1/messages` endpoint and enough context for Claude Code requests.

```dotenv
LLAMACPP_BASE_URL="http://localhost:8080/v1"
MODEL="llamacpp/local-model"
```

For local coding models, context size matters. If llama.cpp returns HTTP 400 for normal Claude Code requests, increase `--ctx-size` and verify the model/server build supports the requested features.

</details>

<details>
<summary><b>Ollama</b></summary>

Run Ollama and pull a model:

```bash
ollama pull llama3.1
ollama serve
```

Then configure the proxy. `OLLAMA_BASE_URL` is the Ollama server root; do not append `/v1`.

```dotenv
OLLAMA_BASE_URL="http://localhost:11434"
MODEL="ollama/llama3.1"
```

Use the same tag shown by `ollama list`, for example `ollama/llama3.1:8b`.

</details>

<details>
<summary><b>Mix providers by model tier</b></summary>

Each tier can use a different provider:

```dotenv
NVIDIA_NIM_API_KEY="nvapi-your-key"
OPENROUTER_API_KEY="sk-or-your-key"

MODEL_OPUS="nvidia_nim/moonshotai/kimi-k2.5"
MODEL_SONNET="open_router/deepseek/deepseek-r1-0528:free"
MODEL_HAIKU="lmstudio/unsloth/GLM-4.7-Flash-GGUF"
MODEL="nvidia_nim/z-ai/glm4.7"
```

</details>

## Connect Claude Code

### Claude Code CLI

```bash
ANTHROPIC_AUTH_TOKEN="freecc" ANTHROPIC_BASE_URL="http://localhost:8082" claude
```

### VS Code Extension

Open Settings, search for `claude-code.environmentVariables`, choose **Edit in settings.json**, and add:

```json
"claudeCode.environmentVariables": [
  { "name": "ANTHROPIC_BASE_URL", "value": "http://localhost:8082" },
  { "name": "ANTHROPIC_AUTH_TOKEN", "value": "freecc" }
]
```

Reload the extension. If the extension shows a login screen, choose the Anthropic Console path once; the local proxy still handles model traffic after the environment variables are active.

### JetBrains ACP

Edit the installed Claude ACP config:

- Windows: `C:\Users\%USERNAME%\AppData\Roaming\JetBrains\acp-agents\installed.json`
- Linux/macOS: `~/.jetbrains/acp.json`

Set the environment for `acp.registry.claude-acp`:

```json
"env": {
  "ANTHROPIC_BASE_URL": "http://localhost:8082",
  "ANTHROPIC_AUTH_TOKEN": "freecc"
}
```

Restart the IDE after changing the file.

### Model Picker

`claude-pick` lets you choose a model at launch time.

```bash
brew install fzf
alias claude-pick="/absolute/path/to/free-claude-code/claude-pick"
claude-pick
```

You can also create fixed aliases:

```bash
alias claude-kimi='ANTHROPIC_BASE_URL="http://localhost:8082" ANTHROPIC_AUTH_TOKEN="freecc:moonshotai/kimi-k2.5" claude'
```

## Optional Integrations

### Discord And Telegram Bots

The bot wrapper runs Claude Code sessions remotely, streams progress, supports reply-based conversation branches, and can stop or clear tasks.

Discord minimum config:

```dotenv
MESSAGING_PLATFORM="discord"
DISCORD_BOT_TOKEN="your-discord-bot-token"
ALLOWED_DISCORD_CHANNELS="123456789"
CLAUDE_WORKSPACE="./agent_workspace"
ALLOWED_DIR="C:/Users/yourname/projects"
```

Create the bot in the [Discord Developer Portal](https://discord.com/developers/applications), enable Message Content Intent, and invite it with read/send/history permissions.

Telegram minimum config:

```dotenv
MESSAGING_PLATFORM="telegram"
TELEGRAM_BOT_TOKEN="123456789:ABC..."
ALLOWED_TELEGRAM_USER_ID="your-user-id"
CLAUDE_WORKSPACE="./agent_workspace"
ALLOWED_DIR="C:/Users/yourname/projects"
```

Get a token from [@BotFather](https://t.me/BotFather) and your user ID from [@userinfobot](https://t.me/userinfobot).

Useful commands:

- `/stop` cancels a task; reply to a task message to stop only that branch.
- `/clear` resets sessions; reply to clear one branch.
- `/stats` shows session state.

### Voice Notes

Voice notes work on Discord and Telegram. Choose one backend:

```bash
uv sync --extra voice_local
uv sync --extra voice
uv sync --extra voice --extra voice_local
```

```dotenv
VOICE_NOTE_ENABLED=true
WHISPER_DEVICE="cpu"          # cpu | cuda | nvidia_nim
WHISPER_MODEL="base"
HF_TOKEN=""
```

Use `WHISPER_DEVICE="nvidia_nim"` with the `voice` extra and `NVIDIA_NIM_API_KEY` for NVIDIA-hosted transcription.

## Configuration Reference

[`.env.example`](.env.example) is the canonical list of variables. The sections below are the ones most users change.

### Model Routing

```dotenv
MODEL="nvidia_nim/z-ai/glm4.7"
MODEL_OPUS=
MODEL_SONNET=
MODEL_HAIKU=
ENABLE_MODEL_THINKING=true
ENABLE_OPUS_THINKING=
ENABLE_SONNET_THINKING=
ENABLE_HAIKU_THINKING=
```

Blank per-tier values inherit the fallback. Blank thinking overrides inherit `ENABLE_MODEL_THINKING`.

### Provider Keys And URLs

```dotenv
NVIDIA_NIM_API_KEY=""
OPENROUTER_API_KEY=""
DEEPSEEK_API_KEY=""
LM_STUDIO_BASE_URL="http://localhost:1234/v1"
LLAMACPP_BASE_URL="http://localhost:8080/v1"
OLLAMA_BASE_URL="http://localhost:11434"
```

Proxy settings are per provider:

```dotenv
NVIDIA_NIM_PROXY=""
OPENROUTER_PROXY=""
LMSTUDIO_PROXY=""
LLAMACPP_PROXY=""
```

### Rate Limits And Timeouts

```dotenv
PROVIDER_RATE_LIMIT=1
PROVIDER_RATE_WINDOW=3
PROVIDER_MAX_CONCURRENCY=5
HTTP_READ_TIMEOUT=120
HTTP_WRITE_TIMEOUT=10
HTTP_CONNECT_TIMEOUT=10
```

Use lower limits for free hosted providers; local providers can usually tolerate higher concurrency if the machine can handle it.

### Security And Diagnostics

```dotenv
ANTHROPIC_AUTH_TOKEN=
LOG_RAW_API_PAYLOADS=false
LOG_RAW_SSE_EVENTS=false
LOG_API_ERROR_TRACEBACKS=false
LOG_RAW_MESSAGING_CONTENT=false
LOG_RAW_CLI_DIAGNOSTICS=false
LOG_MESSAGING_ERROR_DETAILS=false
```

Raw logging flags can expose prompts, tool arguments, paths, and model output. Keep them off unless you are debugging locally.

### Local Web Tools

```dotenv
ENABLE_WEB_SERVER_TOOLS=true
WEB_FETCH_ALLOWED_SCHEMES=http,https
WEB_FETCH_ALLOW_PRIVATE_NETWORKS=false
```

These tools perform outbound HTTP from the proxy. Keep private-network access disabled unless you are in a controlled lab environment.

## Troubleshooting

### Claude Code says `undefined ... input_tokens`, `$.speed`, or malformed response

Update to the latest commit first. Older versions could emit invalid usage metadata in streaming responses. Then check:

- `ANTHROPIC_BASE_URL` is `http://localhost:8082`, not `http://localhost:8082/v1`.
- The proxy is returning Server-Sent Events for `/v1/messages`.
- `server.log` contains no upstream 400/500 response before the malformed-response error.

### llama.cpp or LM Studio returns HTTP 400

This usually means the local runtime rejected the Anthropic Messages request before the proxy could stream a model answer.

Check:

- The local server supports `POST /v1/messages`.
- The model and runtime support the requested context length and tools.
- llama.cpp was started with enough `--ctx-size` for Claude Code prompts.
- The configured base URL includes `/v1` for LM Studio and llama.cpp.

### Provider disconnects during streaming

Errors like `incomplete chunked read`, `server disconnected`, or a peer closing the body usually come from the upstream provider or gateway. Reduce concurrency, raise timeouts, or retry later.

### Tool calls work on one model but not another

Tool support is model and provider dependent. Some OpenAI-compatible models emit malformed tool-call deltas, omit tool names, or return tool calls as plain text. Try another model or provider before assuming the proxy is broken.

### The VS Code extension still shows a login screen

Confirm the extension environment variables are set, then reload the extension or restart VS Code. The browser login flow may still appear once; the local proxy is used when `ANTHROPIC_BASE_URL` is active in the extension process.

## How It Works

```text
Claude Code CLI / IDE
        |
        | Anthropic Messages API
        v
Vertex proxy (:8082)
        |
        | provider-specific request/stream adapter
        v
NIM / OpenRouter / DeepSeek / LM Studio / llama.cpp / Ollama
```

Important pieces:

- FastAPI exposes Anthropic-compatible routes such as `/v1/messages`, `/v1/messages/count_tokens`, and `/v1/models`.
- Model routing resolves the Claude model name to `MODEL_OPUS`, `MODEL_SONNET`, `MODEL_HAIKU`, or `MODEL`.
- NIM uses OpenAI chat streaming translated into Anthropic SSE.
- OpenRouter, DeepSeek, LM Studio, llama.cpp, and Ollama use Anthropic Messages style transports.
- The proxy normalizes thinking blocks, tool calls, token usage metadata, and provider errors into the shape Claude Code expects.
- Request optimizations answer trivial Claude Code probes locally to save latency and quota.

## Development

### Project Structure

```text
free-claude-code/
├── server.py              # ASGI entry point
├── api/                   # FastAPI routes, service layer, routing, optimizations
├── core/                  # Shared Anthropic protocol helpers and SSE utilities
├── providers/             # Provider transports, registry, rate limiting
├── messaging/             # Discord/Telegram adapters, sessions, voice
├── cli/                   # Package entry points and Claude process management
├── config/                # Settings, provider catalog, logging
└── tests/                 # Unit and contract tests
```

### Commands

```bash
uv run ruff format
uv run ruff check
uv run ty check
uv run pytest
```

Run them in that order before pushing. CI enforces the same checks.

### Package Scripts

`pyproject.toml` installs:

- `vertex`: starts the proxy with configured host and port.
- `vertex-init`: creates the user config template at `~/.config/vertex/.env`.

### Extending

- Add OpenAI-compatible providers by extending `OpenAIChatTransport`.
- Add Anthropic Messages providers by extending `AnthropicMessagesTransport`.
- Register provider metadata in `config.provider_catalog` and factory wiring in `providers.registry`.
- Add messaging platforms by implementing the `MessagingPlatform` interface in `messaging/`.

## Contributing

- Report bugs and feature requests in [Issues](https://github.com/Alishahryar1/free-claude-code/issues).
- Keep changes small and covered by focused tests.
- Do not open Docker integration PRs.
- Do not open README change PRs just open an issue for it.
- Run the full check sequence before opening a pull request.
- The syntax Except X, Y is brought back in python 3.14 final version (not in 3.14 alpha). Keep in mind before opening PRs.

## License

MIT License. See [LICENSE](LICENSE) for details.
