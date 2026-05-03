# Vertex Web

Interface web e backend de autenticação para o Vertex CLI.

## Estrutura

```
web/
├── backend/           # API Express (Node.js)
│   ├── server.js      # Servidor Express
│   ├── middleware/     # Middleware de autenticação JWT
│   ├── routes/        # Rotas /me, /usage
│   ├── db/            # Camada de dados em JSON (filesystem)
│   ├── .env           # Configuração
│   └── .env.example   # Template de configuração
├── cloudflared/       # Config do Cloudflare Tunnel
├── src/               # Frontend React + Vite
├── start.sh           # Script para subir backend + tunnel
├── firebase.json      # Config Firebase Hosting
└── .firebaserc        # Projeto Firebase
```

## Porta

O backend usa a porta **4000**. Para alterar, edite `backend/.env`:

```
PORT=4000
```

## Configuração do `.env`

Copie `backend/.env.example` para `backend/.env` e ajuste:

| Variável | Descrição | Default |
|----------|-----------|---------|
| `PORT` | Porta do servidor | `4000` |
| `DB_PATH` | Caminho do banco de dados JSON | `/media/server/HD Backup/.../vertex` |
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase | `vertex-ad5da` |
| `DEEPSEEK_API_KEY` | Chave da API DeepSeek | (definida) |
| `USD_TO_BRL` | Taxa de câmbio | `5.0` |

## Cloudflare Tunnel

1. **Autentique o cloudflared**:
   ```bash
   cloudflared tunnel login
   ```

2. **Crie um túnel**:
   ```bash
   cloudflared tunnel create vertex-api
   ```
   Anote o UUID gerado.

3. **Configure o DNS**:
   ```bash
   cloudflared tunnel route dns vertex-api vertex-api.cursar.space
   ```

4. **Edite `cloudflared/config.yml`**:
   - Substitua `TUNNEL_ID` pelo UUID do passo 2
   - Ajuste o `credentials-file` para o caminho correto

5. **Inicie o túnel**:
   ```bash
   cloudflared tunnel run vertex-api
   ```

## Rodar Localmente

```bash
# 1. Backend
cd backend
npm install
npm start

# 2. Frontend (desenvolvimento)
cd ..
npm install
npm run dev

# 3. Túnel (em outro terminal)
cloudflared tunnel run vertex-api
```

Ou use o script único:

```bash
./start.sh
```

## Deploy do Frontend

```bash
cd web
npm run build
firebase deploy --only hosting
```

O frontend estará disponível em `https://vertex-ad5da.web.app`.

## Login e Logout na CLI

A CLI do Vertex agora usa autenticação por email/senha (Firebase Auth):

- **Login**: `vertex auth login` ou `/login`
- **Logout**: `vertex logout` ou `/logout`
- **Status**: `vertex auth status`

A conta é a mesma criada pelo site em `https://vertex-ad5da.web.app`.
