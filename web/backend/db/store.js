import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  calculateModelCost,
  emptyModelUsage,
  normalizeUsageDelta,
  parseUsdToBrl,
} from '../lib/pricing.js';
import {
  isSupabaseUsageEnabled,
  listConsumptionEvents,
  resetConsumptionEvents,
  upsertConsumptionEvent,
  usageFromConsumptionRows,
} from './supabaseStore.js';

const DB_PATH = process.env.DB_PATH || '/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/vertex';
const MAX_USAGE_HISTORY_EVENTS = 5000;

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
  if (isSupabaseUsageEnabled()) {
    const rows = await listConsumptionEvents(uid);
    return usageFromConsumptionRows(rows);
  }
  const data = await readJSON(uid, 'usage.json');
  return data || { models: {} };
}

function usageTimestamp(rawTimestamp) {
  const date = rawTimestamp ? new Date(rawTimestamp) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

export async function recordUsage(uid, usageDelta, email = '') {
  const delta = normalizeUsageDelta(usageDelta);
  if (!delta.model || delta.totalTokens <= 0) {
    throw new Error('Uso invalido: envie model e pelo menos um contador de tokens positivo');
  }

  const timestamp = usageTimestamp(usageDelta.timestamp);
  const usdToBrl = parseUsdToBrl(process.env.USD_TO_BRL);
  const eventCost = calculateModelCost(delta.model, {
    inputTokens: delta.inputTokens,
    outputTokens: delta.outputTokens,
    cacheReadInputTokens: delta.cacheReadInputTokens,
    cacheCreationInputTokens: delta.cacheCreationInputTokens,
    promptCacheHitTokens: delta.promptCacheHitTokens,
    promptCacheMissTokens: delta.promptCacheMissTokens,
    completionTokens: delta.completionTokens,
    legacyTokens: delta.legacyTokens,
  }, usdToBrl);
  const event = {
    timestamp,
    requestId: delta.requestId,
    model: delta.model,
    inputTokens: delta.inputTokens,
    outputTokens: delta.outputTokens,
    cacheReadInputTokens: delta.cacheReadInputTokens,
    cacheCreationInputTokens: delta.cacheCreationInputTokens,
    promptCacheHitTokens: delta.promptCacheHitTokens,
    promptCacheMissTokens: delta.promptCacheMissTokens,
    completionTokens: delta.completionTokens,
    legacyTokens: delta.legacyTokens,
    tokens: delta.totalTokens,
    costUsd: eventCost.costUsd,
    costBrl: eventCost.costBrl,
    usdToBrl,
    source: usageDelta.source || 'vertex-proxy',
  };

  if (isSupabaseUsageEnabled()) {
    await upsertConsumptionEvent(uid, email, event);
    const rows = await listConsumptionEvents(uid);
    return usageFromConsumptionRows(rows);
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
  current.promptCacheHitTokens =
    (current.promptCacheHitTokens || 0) + delta.promptCacheHitTokens;
  current.promptCacheMissTokens =
    (current.promptCacheMissTokens || 0) + delta.promptCacheMissTokens;
  current.completionTokens =
    (current.completionTokens || 0) + delta.completionTokens;
  current.legacyTokens = (current.legacyTokens || 0) + delta.legacyTokens;
  current.tokens =
    current.promptCacheMissTokens +
    current.promptCacheHitTokens +
    current.completionTokens +
    current.legacyTokens;
  current.lastUsed = timestamp;
  data.models[delta.model] = current;
  data.history = Array.isArray(data.history) ? data.history : [];
  const existingIndex = event.requestId
    ? data.history.findIndex((item) => item?.requestId === event.requestId)
    : -1;
  if (existingIndex >= 0) {
    const existing = data.history[existingIndex];
    const merged = {
      ...existing,
      timestamp,
      inputTokens: (existing.inputTokens || 0) + event.inputTokens,
      outputTokens: (existing.outputTokens || 0) + event.outputTokens,
      cacheReadInputTokens:
        (existing.cacheReadInputTokens || 0) + event.cacheReadInputTokens,
      cacheCreationInputTokens:
        (existing.cacheCreationInputTokens || 0) + event.cacheCreationInputTokens,
      promptCacheHitTokens:
        (existing.promptCacheHitTokens || 0) + event.promptCacheHitTokens,
      promptCacheMissTokens:
        (existing.promptCacheMissTokens || 0) + event.promptCacheMissTokens,
      completionTokens: (existing.completionTokens || 0) + event.completionTokens,
      legacyTokens: (existing.legacyTokens || 0) + event.legacyTokens,
      tokens: (existing.tokens || 0) + event.tokens,
      costUsd: Number(((existing.costUsd || 0) + event.costUsd).toFixed(8)),
      costBrl: Number(((existing.costBrl || 0) + event.costBrl).toFixed(4)),
      source: event.source,
    };
    data.history[existingIndex] = merged;
  } else {
    data.history.push(event);
  }
  if (data.history.length > MAX_USAGE_HISTORY_EVENTS) {
    data.history = data.history.slice(-MAX_USAGE_HISTORY_EVENTS);
  }
  data.updatedAt = timestamp;
  data.version = 3;
  await writeJSON(uid, 'usage.json', data);
  return data;
}

export async function resetAllUsage() {
  if (isSupabaseUsageEnabled()) {
    await resetConsumptionEvents();
  }
  if (!existsSync(DB_PATH)) return 0;
  const dirs = await readdir(DB_PATH, { withFileTypes: true });
  let count = 0;
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    await writeJSON(dir.name, 'usage.json', {
      models: {},
      history: [],
      updatedAt: new Date().toISOString(),
      version: 3,
    });
    count += 1;
  }
  return count;
}
