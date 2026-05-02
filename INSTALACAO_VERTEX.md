# Instalacao do Vertex

Guia rapido para instalar, reinstalar e executar o Vertex em Linux ou WSL.

Versao atual esperada:

```text
1.1.3 (Vertex)
```

## Antes de Comecar

- No Windows, rode tudo dentro do WSL. Primeiro abra o `cmd` ou PowerShell e entre com:

```bat
wsl
```

- No Linux/WSL, os comandos abaixo devem ser executados no terminal bash.
- Tenha uma chave DeepSeek nova em maos: <https://platform.deepseek.com/api_keys>
- Nunca publique sua chave em chat, print, log ou GitHub. Se isso acontecer, revogue a chave e crie outra.

## Instalacao Nova

Use este caminho em um PC que ainda nao tem Vertex instalado.

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

## Atualizar Instalacao Pipx Existente

Use este caminho em outros PCs onde o Vertex foi instalado com `pipx`.

```bash
pipx install --force "git+https://github.com/alvaro209890/Vertex.git"
hash -r
vertex --version
vertex auth status
```

Se precisar trocar ou gravar novamente a chave DeepSeek:

```bash
vertex auth login
vertex auth status
```

## Atualizar Checkout Existente

Use este caminho em um PC onde voce ja trabalha com o repositorio clonado.

```bash
cd /path/to/Vertex
git pull origin main
uv sync
uv run vertex --version
uv run vertex auth login
uv run vertex auth status
uv run vertex
```

## Reinstalacao Limpando Tudo

Use este caminho em um PC que ja tinha Vertex instalado e precisa recomecar do zero.

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

Se `vertex` nao for encontrado, rode diretamente:

```bash
~/.local/bin/vertex
```

## Rodar com Permissao Total

Este modo pula prompts de permissao da CLI e permite que o agente execute ferramentas, comandos e edicoes sem pedir confirmacao.
Use apenas em maquina e pasta confiaveis.

```bash
vertex --dangerously-skip-permissions
```

Se o comando `vertex` nao estiver no PATH:

```bash
~/.local/bin/vertex --dangerously-skip-permissions
```

## Trocar a Chave DeepSeek

```bash
vertex --logout
```

Depois cole a nova chave DeepSeek quando solicitado.

## Modelo Padrao

O Vertex vem configurado por padrao para:

```text
deepseek/deepseek-v4-flash
```

## Aparencia da CLI

Os estados visiveis da CLI enquanto o Vertex esta respondendo, pensando,
editando ou mostrando bolhas de fala usam texto verde. Isso evita os tons
amarelos ou laranja claros que eram usados por partes da CLI vendorizada.

## Diagnostico Rapido

Verificar se o comando esta instalado:

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
