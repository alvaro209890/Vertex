# Instalação do Vertex

Guia rápido para instalar, reinstalar e executar o Vertex em Linux ou WSL.

Versão atual esperada:

```text
1.2.1 (Vertex)
```

## Antes de Começar

- No Windows, rode tudo dentro do WSL. Primeiro abra o `cmd` ou PowerShell e entre com:

```bat
wsl
```

- No Linux/WSL, os comandos abaixo devem ser executados no terminal bash.
- Crie sua conta primeiro no site: https://vertex-ad5da.web.app
- O CLI usa login por email/senha (Firebase Auth) — não precisa de chave DeepSeek

## Instalação Nova

Use este caminho em um PC que ainda não tem Vertex instalado.

### Ubuntu, Debian e WSL Ubuntu

```bash
sudo apt update
sudo apt install -y curl pipx
pipx ensurepath
source ~/.bashrc

pipx install --force "git+https://github.com/alvaro209890/Vertex.git"
source ~/.bashrc
hash -r

vertex auth login
vertex auth status
vertex
vertex --version
```

### Fedora

```bash
sudo dnf install -y curl pipx
pipx ensurepath
source ~/.bashrc

pipx install --force "git+https://github.com/alvaro209890/Vertex.git"
source ~/.bashrc
hash -r

vertex auth login
vertex auth status
vertex
vertex --version
```

### Arch Linux e Manjaro

```bash
sudo pacman -Sy --needed curl python-pipx
pipx ensurepath
source ~/.bashrc

pipx install --force "git+https://github.com/alvaro209890/Vertex.git"
source ~/.bashrc
hash -r

vertex auth login
vertex auth status
vertex
vertex --version
```

## Atualizar Instalação Pipx Existente

Use este caminho em outros PCs onde o Vertex foi instalado com `pipx`.

```bash
pipx install --force "git+https://github.com/alvaro209890/Vertex.git"
hash -r
vertex --version
vertex auth status
```

## Atualizar Checkout Existente

Use este caminho em um PC onde você já trabalha com o repositório clonado.

```bash
cd /path/to/Vertex
git pull origin main
uv sync
uv run vertex --version
uv run vertex auth login
uv run vertex auth status
uv run vertex
```

## Reinstalação Limpando Tudo

Use este caminho em um PC que já tinha Vertex instalado e precisa recomeçar do zero.

```bash
pkill -f vertex-proxy || true
pkill -f vertex_proxy.py || true
pkill -f "vendor/vertex-cli" || true

pipx uninstall vertex-deepseek || true

rm -rf ~/.vertex
rm -rf ~/.config/vertex
rm -rf ~/.local/share/pipx/venvs/vertex-deepseek
rm -f ~/.local/bin/vertex ~/.local/bin/vertex-init ~/.local/bin/vertex-proxy

hash -r

pipx install --force "git+https://github.com/alvaro209890/Vertex.git"
pipx ensurepath
source ~/.bashrc
hash -r

vertex
```

Se `vertex` não for encontrado, rode diretamente:

```bash
~/.local/bin/vertex
```

## Rodar com Permissão Total

Este modo pula prompts de permissão da CLI e permite que o agente execute ferramentas, comandos e edições sem pedir confirmação.
Use apenas em máquina e pasta confiáveis.

```bash
vertex --dangerously-skip-permissions
```

Se o comando `vertex` não estiver no PATH:

```bash
~/.local/bin/vertex --dangerously-skip-permissions
```

## Web Dashboard

Acesse seu painel de uso em: https://vertex-ad5da.web.app

Features:
- Login/cadastro por email e senha
- Dashboard com tabela de uso de tokens por modelo
- Custos estimados em USD e BRL
- Aba de comandos da CLI para referência

## Admin Panel

Acesso administrativo em: https://vertex-admin-panel.web.app

- Login: `alvaro231120` / `785291aE`
- Bloquear/desbloquear usuários
- Visualizar métricas (total de usuários, ativos, bloqueados, tokens)

## Modelo Padrão

O Vertex vem configurado por padrão para:

```text
deepseek/deepseek-v4-flash
```

Disponíveis:
- `deepseek/deepseek-v4-flash` — Respostas rápidas
- `deepseek/deepseek-v4-pro` — Raciocínio completo (thinking)

## Aparência da CLI

Os estados visíveis da CLI enquanto o Vertex está respondendo, pensando,
editando ou mostrando bolhas de fala usam texto verde. Isso evita os tons
amarelos ou laranja claros que eram usados por partes da CLI vendorizada.

## Diagnóstico Rápido

Verificar se o comando está instalado:

```bash
command -v vertex
vertex --version
```

Verificar apps instalados pelo pipx:

```bash
pipx list
```

Se a API/proxy ficou preso em processo antigo:

```bash
pkill -f vertex-proxy || true
pkill -f vertex_proxy.py || true
vertex
```
