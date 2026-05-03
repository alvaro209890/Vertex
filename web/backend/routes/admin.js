import { Router } from 'express';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';

const DB_PATH = process.env.DB_PATH || '/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/vertex';
const ADMIN_USER = process.env.ADMIN_USER || 'alvaro231120';
const ADMIN_PASS = process.env.ADMIN_PASS || '785291aE';

export const adminRouter = Router();

// --- Admin token ---
// Simple token-based auth (not Firebase)
const tokens = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente' });
  }
  const token = authHeader.slice(7);
  const session = tokens.get(token);
  if (!session || session.expires < Date.now()) {
    tokens.delete(token);
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
  req.admin = session;
  next();
}

// POST /admin/login
adminRouter.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }
  const token = generateToken();
  tokens.set(token, { user: username, expires: Date.now() + 24 * 60 * 60 * 1000 });
  res.json({ token, user: username });
});

// GET /admin/users - listar todos os usuarios
adminRouter.get('/users', adminAuth, async (req, res) => {
  try {
    const users = [];
    if (!existsSync(DB_PATH)) {
      return res.json({ users: [] });
    }
    const dirs = await readdir(DB_PATH, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const uid = dir.name;
      const userDir = join(DB_PATH, uid);
      let profile = null;
      let usage = null;
      let blocked = false;

      try {
        const profileRaw = await readFile(join(userDir, 'profile.json'), 'utf-8');
        profile = JSON.parse(profileRaw);
      } catch {}

      try {
        const usageRaw = await readFile(join(userDir, 'usage.json'), 'utf-8');
        usage = JSON.parse(usageRaw);
      } catch {}

      try {
        const blockedRaw = await readFile(join(userDir, 'blocked.json'), 'utf-8');
        blocked = JSON.parse(blockedRaw)?.blocked || false;
      } catch {}

      users.push({
        uid,
        email: profile?.email || '',
        profile: profile || null,
        usage: usage || null,
        blocked,
      });
    }

    // Ordenar por data de criacao (mais recente primeiro)
    users.sort((a, b) => {
      const da = a.profile?.createdAt || '';
      const db = b.profile?.createdAt || '';
      return db.localeCompare(da);
    });

    res.json({ users });
  } catch (err) {
    console.error('Erro ao listar usuarios:', err);
    res.status(500).json({ error: 'Erro ao listar usuarios' });
  }
});

// POST /admin/users/:uid/toggle-block - bloquear/desbloquear
adminRouter.post('/users/:uid/toggle-block', adminAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    const { blocked } = req.body;
    const userDir = join(DB_PATH, uid);

    if (!existsSync(userDir)) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    await writeFile(
      join(userDir, 'blocked.json'),
      JSON.stringify({ blocked, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );

    res.json({ uid, blocked, status: blocked ? 'bloqueado' : 'desbloqueado' });
  } catch (err) {
    console.error('Erro ao alternar bloqueio:', err);
    res.status(500).json({ error: 'Erro ao alternar bloqueio' });
  }
});

// GET /admin/metrics - metricas gerais
adminRouter.get('/metrics', adminAuth, async (req, res) => {
  try {
    const metrics = {
      totalUsers: 0,
      activeUsers: 0,
      blockedUsers: 0,
      totalTokens: 0,
      tokensByModel: {},
    };

    if (!existsSync(DB_PATH)) {
      return res.json(metrics);
    }

    const dirs = await readdir(DB_PATH, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      metrics.totalUsers++;

      const userDir = join(DB_PATH, dir.name);

      // Verificar bloqueio
      try {
        const blockedRaw = await readFile(join(userDir, 'blocked.json'), 'utf-8');
        const blocked = JSON.parse(blockedRaw)?.blocked || false;
        if (blocked) {
          metrics.blockedUsers++;
          continue;
        }
      } catch {}

      metrics.activeUsers++;

      // Somar tokens
      try {
        const usageRaw = await readFile(join(userDir, 'usage.json'), 'utf-8');
        const usage = JSON.parse(usageRaw);
        if (usage.models) {
          for (const [model, data] of Object.entries(usage.models)) {
            const tokens = data.tokens || 0;
            metrics.totalTokens += tokens;
            metrics.tokensByModel[model] = (metrics.tokensByModel[model] || 0) + tokens;
          }
        }
      } catch {}
    }

    res.json(metrics);
  } catch (err) {
    console.error('Erro ao calcular metricas:', err);
    res.status(500).json({ error: 'Erro ao calcular metricas' });
  }
});
