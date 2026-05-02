<div align="center">

# 🔷 Vertex

Standalone Vertex CLI app with a bundled tool runtime and a local DeepSeek
proxy.

Vertex was created by Alvaro Emanuel Alves Araujo. It is not an Anthropic
product. The bundled assistant is instructed to identify as Vertex and to make
clear that it runs DeepSeek models through the local proxy.

```bash
pipx install --force git+https://github.com/alvaro209890/Vertex.git
vertex         # first run prompts for your DeepSeek API key
vertex --version
```

</div>

Current bundled Vertex CLI version: `1.1.4`.

## What You Get

- One-command setup: `pipx install --force git+https://github.com/alvaro209890/Vertex.git` then `vertex`
- Standalone `vertex` app; no external `openclaude` command is required
- First run prompts for your DeepSeek API key interactively
- `vertex-proxy` is a proxy-only support command; normal users run `vertex`
- Bundled agent/tool runtime vendored inside this project
- DeepSeek-native backend with Anthropic-compatible Messages API
- Assistant identity pinned to Vertex, created by Alvaro Emanuel Alves Araujo
- Per-model routing: Opus/Sonnet/Haiku → v4-flash by default
- Streaming, tool use, reasoning/thinking block handling
- Green CLI status text for responding, thinking, editing, and speech-bubble states
- Brazilian Portuguese text for the main work/status messages and core `/`
  commands in the bundled CLI
- Change API key anytime: `vertex --logout`

## Quick Start

### 1. Install Vertex

**macOS / Linux (recommended):**
```bash
pipx install --force git+https://github.com/alvaro209890/Vertex.git
```

**Linux (Ubuntu/Debian) — install pipx first if needed:**
```bash
sudo apt install pipx
pipx ensurepath
pipx install --force git+https://github.com/alvaro209890/Vertex.git
```

**Alternative (any OS with virtualenv):**
```bash
pip install git+https://github.com/alvaro209890/Vertex.git
```
> Ubuntu 24.04+ blocks `pip install` outside a virtualenv (PEP 668).
> Use `pipx` instead, or create a venv first.

Requires Python 3.12+ and Node.js 20+.

### 2. Configure

Run `vertex`. If `~/.config/vertex/.env` is missing or `DEEPSEEK_API_KEY` is
empty, Vertex asks for your DeepSeek API key and saves it.
Get one at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).

`vertex-init` is optional; it only pre-creates the config file. To change the key
later: `vertex /logout` or `vertex auth login`.

### 3. Open Vertex

```bash
vertex
```

That's it. `vertex` starts the local proxy if needed and opens the bundled
Vertex CLI runtime.

Internally, the CLI sends Anthropic Messages API traffic to
`http://127.0.0.1:8083`, and the local proxy routes it to DeepSeek. Anthropic
account login is disabled; the only supported login state is the DeepSeek API
key.

### 4. Proxy-Only Mode

If you only want the Anthropic-compatible local server:

```bash
vertex-proxy
```

The default proxy URL is `http://127.0.0.1:8083`. Do not append `/v1` when
pointing Anthropic-style clients at it.

## Update Existing Installs

Use these commands on every PC where Vertex is already installed.

If Vertex was installed with `pipx`:

```bash
pipx install --force git+https://github.com/alvaro209890/Vertex.git
vertex --version
vertex auth login
vertex auth status
```

If Vertex was cloned from GitHub:

```bash
cd /path/to/Vertex
git pull origin main
uv sync
uv run vertex --version
uv run vertex auth login
uv run vertex auth status
```

`vertex auth login` stores the DeepSeek API key in the local machine config.
Do not commit API keys to git. After updating, Vertex ignores non-DeepSeek
`MODEL*` values and routes chat through DeepSeek only.

The expected version after this update is `1.1.4 (Vertex)`.

## DeepSeek Only

Vertex is configured to use DeepSeek only. Model values use this format:

```text
deepseek/model/name
```

`MODEL` is the fallback. `MODEL_OPUS`, `MODEL_SONNET`, and `MODEL_HAIKU`
override routing for Claude-compatible requests that arrive for those tiers, but only
`deepseek/...` values are honored. Any non-DeepSeek model value is ignored by the
runtime and replaced with `deepseek/deepseek-v4-flash`.

| Provider | Prefix | Transport | Key | Default base URL |
| --- | --- | --- | --- | --- |
| DeepSeek | `deepseek/...` | Anthropic Messages | `DEEPSEEK_API_KEY` | `https://api.deepseek.com/anthropic` |

Get a key at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).

```dotenv
DEEPSEEK_API_KEY="your-deepseek-key"
MODEL="deepseek/deepseek-v4-flash"
```

Available models:
- `deepseek/deepseek-v4-flash` — Fast responses (non-thinking mode)
- `deepseek/deepseek-v4-pro` — Full reasoning (thinking mode)
- `deepseek/deepseek-chat` — Legacy (deprecated 2026/07/24 → maps to v4-flash)
- `deepseek/deepseek-reasoner` — Legacy (deprecated 2026/07/24 → maps to v4-flash thinking)

This provider uses DeepSeek's Anthropic-compatible endpoint, not the OpenAI chat-completions endpoint.

## Connect External Anthropic Clients

Vertex opens its own bundled CLI runtime with:

```bash
vertex
```

You can also point any Anthropic Messages-compatible client at the local proxy.

### VS Code Extension

Open Settings, search for `claude-code.environmentVariables`, choose **Edit in settings.json**, and add:

```json
"claudeCode.environmentVariables": [
  { "name": "ANTHROPIC_BASE_URL", "value": "http://localhost:8083" },
  { "name": "ANTHROPIC_AUTH_TOKEN", "value": "freecc" }
]
```

Reload the extension. If the extension shows a login screen, choose the API-key
path once; the local proxy still handles model traffic after the environment
variables are active.

### JetBrains ACP

Edit the installed Claude ACP config:

- Windows: `C:\Users\%USERNAME%\AppData\Roaming\JetBrains\acp-agents\installed.json`
- Linux/macOS: `~/.jetbrains/acp.json`

Set the environment for `acp.registry.claude-acp`:

```json
"env": {
  "ANTHROPIC_BASE_URL": "http://localhost:8083",
  "ANTHROPIC_AUTH_TOKEN": "freecc"
}
```

Restart the IDE after changing the file.

### Model Picker

`claude-pick` lets legacy Claude-compatible clients choose a DeepSeek model at launch time.

```bash
brew install fzf
alias claude-pick="/absolute/path/to/Vertex/claude-pick"
claude-pick
```

You can also create fixed aliases:

```bash
alias claude-deepseek-pro='ANTHROPIC_BASE_URL="http://localhost:8083" ANTHROPIC_AUTH_TOKEN="freecc:deepseek/deepseek-v4-pro" claude'
```

## Optional Integrations

### Discord And Telegram Bots

The bot wrapper runs Vertex CLI sessions remotely, streams progress, supports reply-based conversation branches, and can stop or clear tasks.

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

Voice notes work on Discord and Telegram with the local Whisper backend:

```bash
uv sync --extra voice_local
```

```dotenv
VOICE_NOTE_ENABLED=true
WHISPER_DEVICE="cpu"          # cpu | cuda
WHISPER_MODEL="base"
HF_TOKEN=""
```

## Configuration Reference

[`.env.example`](.env.example) is the canonical list of variables. The sections below are the ones most users change.

### Model Routing

```dotenv
MODEL="deepseek/deepseek-v4-flash"
MODEL_OPUS="deepseek/deepseek-v4-flash"
MODEL_SONNET="deepseek/deepseek-v4-flash"
MODEL_HAIKU="deepseek/deepseek-v4-flash"
ENABLE_MODEL_THINKING=true
ENABLE_OPUS_THINKING=
ENABLE_SONNET_THINKING=
ENABLE_HAIKU_THINKING=
```

Blank per-tier values inherit the fallback. Non-DeepSeek model values are ignored
and replaced with `deepseek/deepseek-v4-flash`. Blank thinking overrides inherit
`ENABLE_MODEL_THINKING`.

### Provider Key

```dotenv
DEEPSEEK_API_KEY=""
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
ENABLE_WEB_SERVER_TOOLS=false
WEB_FETCH_ALLOWED_SCHEMES=http,https
WEB_FETCH_ALLOW_PRIVATE_NETWORKS=false
```

These tools perform outbound HTTP from the proxy. Keep private-network access disabled unless you are in a controlled lab environment.

## Troubleshooting

### Vertex CLI says `undefined ... input_tokens`, `$.speed`, or malformed response

Update to the latest commit first. Older versions could emit invalid usage metadata in streaming responses. Then check:

- `ANTHROPIC_BASE_URL` is `http://localhost:8083`, not `http://localhost:8083/v1`.
- The proxy is returning Server-Sent Events for `/v1/messages`.
- `server.log` contains no upstream 400/500 response before the malformed-response error.

### Provider disconnects during streaming

Errors like `incomplete chunked read`, `server disconnected`, or a peer closing the body usually come from DeepSeek or the network path. Reduce concurrency, raise timeouts, or retry later.

### Tool calls work on one model but not another

Tool support is model dependent. Some models emit malformed tool-call deltas, omit tool names, or return tool calls as plain text. Try another DeepSeek model before assuming the proxy is broken.

### The VS Code extension still shows a login screen

Confirm the extension environment variables are set, then reload the extension or restart VS Code. The browser login flow may still appear once; the local proxy is used when `ANTHROPIC_BASE_URL` is active in the extension process.

## How It Works

```text
Vertex CLI / external Anthropic client
        |
        | Anthropic Messages API
        v
Vertex proxy (:8083)
        |
        | DeepSeek request/stream adapter
        v
DeepSeek Anthropic Messages API
```

Important pieces:

- FastAPI exposes Anthropic-compatible routes such as `/v1/messages`, `/v1/messages/count_tokens`, and `/v1/models`.
- Model routing resolves the incoming compatibility model name to `MODEL_OPUS`, `MODEL_SONNET`, `MODEL_HAIKU`, or `MODEL`.
- Non-DeepSeek `MODEL*` values are ignored so installed clients cannot route chat to another provider.
- DeepSeek uses Anthropic Messages style transport.
- The proxy normalizes thinking blocks, tool calls, token usage metadata, and provider errors into the shape Anthropic-compatible clients expect.
- Request optimizations answer trivial client probes locally to save latency and quota.

## Development

### Project Structure

```text
Vertex/
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

- Keep provider metadata in `config.provider_catalog` and factory wiring in `providers.registry`.
- Add messaging platforms by implementing the `MessagingPlatform` interface in `messaging/`.

## Contributing

- Report bugs and feature requests in [Issues](https://github.com/alvaro209890/Vertex/issues).
- Keep changes small and covered by focused tests.
- Do not open Docker integration PRs.
- Do not open README change PRs just open an issue for it.
- Run the full check sequence before opening a pull request.
- The syntax Except X, Y is brought back in python 3.14 final version (not in 3.14 alpha). Keep in mind before opening PRs.

## License

MIT License. See [LICENSE](LICENSE) for details.
