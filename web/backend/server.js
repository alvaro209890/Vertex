import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { authMiddleware } from './middleware/auth.js';
import { meRouter } from './routes/me.js';
import { usageRouter } from './routes/usage.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '4001', 10);

// ─── Proxy reverso para o proxy DeepSeek (/v1/*) ──────
// PRECISA vir ANTES do express.json() para não consumir o body do POST.
// Encaminha requisições /v1/* para o FastAPI em PROXY_PORT.
function proxyToFastAPI(req, res, targetPath) {
  const options = {
    hostname: '127.0.0.1',
    port: PROXY_PORT,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers },
  };

  // Remove host header para evitar conflito
  delete options.headers.host;
  // Remove content-length também pois vamos pipe o body original
  // (ou não, depende do método)
  if (req.method === 'GET' || req.method === 'HEAD') {
    delete options.headers['content-length'];
  }

  const proxyReq = http.request(options, (proxyRes) => {
    // Se for streaming SSE, passa direto
    const contentType = proxyRes.headers['content-type'] || '';
    if (contentType.includes('text/event-stream')) {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
      return;
    }

    // Caso contrário, coleta o body e repassa
    let body = '';
    proxyRes.on('data', (chunk) => { body += chunk; });
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode).set(proxyRes.headers);
      if (body) {
        try {
          res.json(JSON.parse(body));
        } catch {
          res.send(body);
        }
      } else {
        res.end();
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy] Erro ao conectar no FastAPI (:${PROXY_PORT}):`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Proxy indisponivel' });
    }
  });

  // Pipe o body original (raw) para o proxy - NÃO usa req.body do express.json
  req.pipe(proxyReq);
}

// Middleware de proxy para rotas /v1/* (ANTES do express.json)
app.use('/v1', (req, res) => {
  proxyToFastAPI(req, res, req.originalUrl);
});

// Proxy para rotas internas do FastAPI (ANTES do express.json)
app.use('/api/metrics', (req, res) => {
  proxyToFastAPI(req, res, req.originalUrl);
});

app.use(cors());
app.use(express.json());

// Middleware de proxy para rotas /v1/*
app.use('/v1', (req, res) => {
  proxyToFastAPI(req, res, req.originalUrl);
});

// Proxy para rotas internas do FastAPI
app.use('/api/metrics', (req, res) => {
  proxyToFastAPI(req, res, req.originalUrl);
});

// Health check combinado
app.get('/health', async (_req, res) => {
  const backendStatus = { status: 'healthy', service: 'vertex-api' };

  // Verifica health do proxy FastAPI
  let proxyStatus = { status: 'unknown' };
  try {
    const proxyHealth = await new Promise((resolve, reject) => {
      const hReq = http.request(
        { hostname: '127.0.0.1', port: PROXY_PORT, path: '/health', method: 'GET', timeout: 2000 },
        (hRes) => {
          let body = '';
          hRes.on('data', (c) => { body += c; });
          hRes.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve({ status: 'error', detail: 'invalid json' }); }
          });
        }
      );
      hReq.on('error', (e) => reject(e));
      hReq.on('timeout', () => { hReq.destroy(); reject(new Error('timeout')); });
      hReq.end();
    });
    proxyStatus = proxyHealth;
  } catch {
    proxyStatus = { status: 'unavailable' };
  }

  res.json({
    backend: backendStatus,
    proxy: proxyStatus,
    combined: backendStatus.status === 'healthy' && proxyStatus.status === 'healthy' ? 'healthy' : 'degraded',
  });
});

// Rotas protegidas (auth Firebase)
app.use('/me', authMiddleware, meRouter);
app.use('/usage', authMiddleware, usageRouter);

// Rotas admin (auth propria via token simples)
app.use('/admin', adminRouter);

app.listen(PORT, () => {
  console.log(`Vertex API rodando em http://127.0.0.1:${PORT}`);
  console.log(`Proxy DeepSeek esperado em http://127.0.0.1:${PROXY_PORT}`);
});
