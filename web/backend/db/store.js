import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { emptyModelUsage, normalizeUsageDelta } from '../lib/pricing.js';

const DB_PATH = process.env.DB_PATH || '/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/vertex';

async function ensureUserDir(uid) {
  const userDir = join(DB_PATH, uid);
  if (!existsSync(userDir)) {
    await mkdir(userDir, { recursive: true });
  }
  return userDir;
}

function filePath(uid, name) {
  return join(DB_PATH, uid, name);
}

async function readJSON(uid, name) {
  const path = filePath(uid, name);
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJSON(uid, name, data) {
  const userDir = await ensureUserDir(uid);
  const path = join(userDir, name);
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Profile ---

export async function getProfile(uid) {
  return readJSON(uid, 'profile.json');
}

export async function ensureProfile(uid, email) {
  let profile = await getProfile(uid);
  if (!profile) {
    profile = { uid, email, createdAt: new Date().toISOString() };
    await writeJSON(uid, 'profile.json', profile);
  } else if (email && profile.email !== email) {
    profile = { ...profile, email };
    await writeJSON(uid, 'profile.json', profile);
  }
  return profile;
}

export async function isBlocked(uid) {
  const data = await readJSON(uid, 'blocked.json');
  return Boolean(data?.blocked);
}

// --- Usage ---

export async function getUsage(uid) {
  const data = await readJSON(uid, 'usage.json');
  return data || { models: {} };
}

export async function recordUsage(uid, usageDelta) {
  const delta = normalizeUsageDelta(usageDelta);
  if (!delta.model || delta.totalTokens <= 0) {
    throw new Error('Uso invalido: envie model e pelo menos um contador de tokens positivo');
  }

  const data = await getUsage(uid);
  if (!data.models[delta.model]) {
    data.models[delta.model] = emptyModelUsage();
  }
  const current = { ...emptyModelUsage(), ...data.models[delta.model] };
  current.inputTokens = (current.inputTokens || 0) + delta.inputTokens;
  current.outputTokens = (current.outputTokens || 0) + delta.outputTokens;
  current.cacheReadInputTokens =
    (current.cacheReadInputTokens || 0) + delta.cacheReadInputTokens;
  current.cacheCreationInputTokens =
    (current.cacheCreationInputTokens || 0) + delta.cacheCreationInputTokens;
  current.legacyTokens = (current.legacyTokens || 0) + delta.legacyTokens;
  current.tokens =
    current.inputTokens +
    current.outputTokens +
    current.cacheReadInputTokens +
    current.cacheCreationInputTokens +
    current.legacyTokens;
  current.lastUsed = usageDelta.timestamp || new Date().toISOString();
  data.models[delta.model] = current;
  await writeJSON(uid, 'usage.json', data);
  return data;
}
