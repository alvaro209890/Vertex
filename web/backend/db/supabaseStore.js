import { randomUUID } from 'node:crypto';
import { normalizeModel } from '../lib/pricing.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_USAGE_TABLE = process.env.SUPABASE_USAGE_TABLE || 'consumption';

function enabled() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY)
    && process.env.SUPABASE_USAGE_ENABLED !== 'false';
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function rowToEvent(row) {
  const promptCacheHitTokens = Number(row.prompt_cache_hit_tokens || 0);
  const promptCacheMissTokens = Number(row.prompt_cache_miss_tokens || 0);
  const completionTokens = Number(row.completion_tokens || 0);
  return {
    timestamp: row.created_at,
    requestId: row.request_id || null,
    model: normalizeModel(row.model),
    inputTokens: promptCacheMissTokens,
    outputTokens: completionTokens,
    cacheReadInputTokens: promptCacheHitTokens,
    cacheCreationInputTokens: 0,
    promptCacheHitTokens,
    promptCacheMissTokens,
    completionTokens,
    legacyTokens: 0,
    tokens: Number(row.total_tokens || 0),
    costUsd: Number(row.cost_usd || 0),
    costBrl: Number(row.cost_brl || 0),
    source: row.source || 'vertex-proxy',
  };
}

export function isSupabaseUsageEnabled() {
  return enabled();
}

export async function listConsumptionEvents(uid) {
  if (!enabled()) return null;
  const params = new URLSearchParams({
    select: '*',
    user_id: `eq.${uid}`,
    order: 'created_at.asc',
  });
  return supabaseFetch(`${SUPABASE_USAGE_TABLE}?${params.toString()}`);
}

export async function upsertConsumptionEvent(uid, email, event) {
  if (!enabled()) return null;
  const requestId = event.requestId || randomUUID();
  const existingParams = new URLSearchParams({
    select: '*',
    user_id: `eq.${uid}`,
    request_id: `eq.${requestId}`,
    limit: '1',
  });
  const existingRows = await supabaseFetch(
    `${SUPABASE_USAGE_TABLE}?${existingParams.toString()}`
  );
  const existing = Array.isArray(existingRows) ? existingRows[0] : null;

  const promptCacheHitTokens =
    Number(existing?.prompt_cache_hit_tokens || 0) + event.promptCacheHitTokens;
  const promptCacheMissTokens =
    Number(existing?.prompt_cache_miss_tokens || 0) + event.promptCacheMissTokens;
  const completionTokens =
    Number(existing?.completion_tokens || 0) + event.completionTokens;
  const costUsd = Number((Number(existing?.cost_usd || 0) + event.costUsd).toFixed(8));
  const costBrl = Number((Number(existing?.cost_brl || 0) + event.costBrl).toFixed(4));

  const row = {
    user_id: uid,
    email: email || null,
    request_id: requestId,
    model: event.model,
    prompt_cache_hit_tokens: promptCacheHitTokens,
    prompt_cache_miss_tokens: promptCacheMissTokens,
    completion_tokens: completionTokens,
    cost_usd: costUsd,
    cost_brl: costBrl,
    usd_to_brl: event.usdToBrl,
    source: event.source,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const params = new URLSearchParams({ id: `eq.${existing.id}` });
    return supabaseFetch(`${SUPABASE_USAGE_TABLE}?${params.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
  }

  row.created_at = event.timestamp;
  return supabaseFetch(SUPABASE_USAGE_TABLE, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
}

export async function resetConsumptionEvents() {
  if (!enabled()) return null;
  return supabaseFetch(`${SUPABASE_USAGE_TABLE}?id=not.is.null`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

export function usageFromConsumptionRows(rows) {
  const usage = { models: {}, history: [], version: 3, source: 'supabase' };
  for (const row of rows || []) {
    const event = rowToEvent(row);
    usage.history.push(event);
    if (!usage.models[event.model]) {
      usage.models[event.model] = {
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        promptCacheHitTokens: 0,
        promptCacheMissTokens: 0,
        completionTokens: 0,
        legacyTokens: 0,
        lastUsed: null,
      };
    }
    const current = usage.models[event.model];
    current.inputTokens += event.inputTokens;
    current.outputTokens += event.outputTokens;
    current.cacheReadInputTokens += event.cacheReadInputTokens;
    current.promptCacheHitTokens += event.promptCacheHitTokens;
    current.promptCacheMissTokens += event.promptCacheMissTokens;
    current.completionTokens += event.completionTokens;
    current.tokens += event.tokens;
    current.lastUsed = event.timestamp;
  }
  usage.updatedAt = usage.history.at(-1)?.timestamp || null;
  return usage;
}
