import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';

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
  }
  return profile;
}

// --- Usage ---

export async function getUsage(uid) {
  const data = await readJSON(uid, 'usage.json');
  return data || { models: {} };
}

export async function recordUsage(uid, { model, tokens, timestamp }) {
  const data = await getUsage(uid);
  if (!data.models[model]) {
    data.models[model] = { tokens: 0, lastUsed: null };
  }
  data.models[model].tokens += tokens;
  data.models[model].lastUsed = timestamp || new Date().toISOString();
  await writeJSON(uid, 'usage.json', data);
  return data;
}
