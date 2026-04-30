# Instalacao do Vertex

Guia rapido para instalar, reinstalar e executar o Vertex em Linux ou WSL.

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

curl -fsSL https://raw.githubusercontent.com/alvaro209890/Vertex/main/scripts/install-vertex.sh | bash
source ~/.bashrc
hash -r

vertex
```

### Fedora

```bash
sudo dnf install -y curl pipx
pipx ensurepath
source ~/.bashrc

curl -fsSL https://raw.githubusercontent.com/alvaro209890/Vertex/main/scripts/install-vertex.sh | bash
source ~/.bashrc
hash -r

vertex
```

### Arch Linux e Manjaro

```bash
sudo pacman -Sy --needed curl python-pipx
pipx ensurepath
source ~/.bashrc

curl -fsSL https://raw.githubusercontent.com/alvaro209890/Vertex/main/scripts/install-vertex.sh | bash
source ~/.bashrc
hash -r

vertex
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
