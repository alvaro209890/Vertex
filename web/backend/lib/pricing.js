const MILLION = 1_000_000;

export const PRICING_SOURCE =
  'DeepSeek API Docs, checked 2026-05-04: https://api-docs.deepseek.com/quick_start/pricing';

export const MODEL_ALIASES = {
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'deepseek-chat': 'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-chat': 'deepseek/deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-reasoner': 'deepseek/deepseek-v4-flash',
  'deepseek-v4-pro': 'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-v4-pro': 'deepseek/deepseek-v4-pro',
};

export const MODEL_PRICES_PER_MILLION = {
  'deepseek/deepseek-v4-flash': {
    inputCacheHit: 0.0028,
    inputCacheMiss: 0.14,
    output: 0.28,
  },
  'deepseek/deepseek-v4-pro': {
    inputCacheHit: 0.003625,
    inputCacheMiss: 0.435,
    output: 0.87,
    promoUntil: '2026-05-31T15:59:00Z',
    regular: {
      inputCacheHit: 0.0145,
      inputCacheMiss: 1.74,
      output: 3.48,
    },
  },
};

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function normalizeModel(model) {
  const raw = String(model || '').trim();
  return MODEL_ALIASES[raw] || raw || DEFAULT_MODEL;
}

export function getModelPrice(model) {
  const normalized = normalizeModel(model);
  return MODEL_PRICES_PER_MILLION[normalized] || MODEL_PRICES_PER_MILLION[DEFAULT_MODEL];
}

export function parseUsdToBrl(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5.0;
}

export function normalizeUsageDelta(raw) {
  const model = normalizeModel(raw?.model);
  const inputTokens = numberOrZero(raw?.inputTokens ?? raw?.input_tokens);
  const outputTokens = numberOrZero(raw?.outputTokens ?? raw?.output_tokens);
  const cacheReadInputTokens = numberOrZero(
    raw?.cacheReadInputTokens ?? raw?.cache_read_input_tokens
  );
  const cacheCreationInputTokens = numberOrZero(
    raw?.cacheCreationInputTokens ?? raw?.cache_creation_input_tokens
  );
  const legacyTokens = numberOrZero(raw?.tokens);
  const preciseTokens =
    inputTokens + outputTokens + cacheReadInputTokens + cacheCreationInputTokens;

  return {
    model,
    inputTokens,
    outputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    legacyTokens: preciseTokens > 0 ? 0 : legacyTokens,
    totalTokens: preciseTokens > 0 ? preciseTokens : legacyTokens,
  };
}

export function emptyModelUsage() {
  return {
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    legacyTokens: 0,
    lastUsed: null,
  };
}

export function normalizeStoredModelUsage(modelUsage) {
  const usage = { ...emptyModelUsage(), ...(modelUsage || {}) };
  usage.inputTokens = numberOrZero(usage.inputTokens);
  usage.outputTokens = numberOrZero(usage.outputTokens);
  usage.cacheReadInputTokens = numberOrZero(usage.cacheReadInputTokens);
  usage.cacheCreationInputTokens = numberOrZero(usage.cacheCreationInputTokens);
  usage.legacyTokens = numberOrZero(usage.legacyTokens);

  const preciseTokens =
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens;

  if (preciseTokens === 0 && !usage.legacyTokens && usage.tokens) {
    usage.legacyTokens = numberOrZero(usage.tokens);
  }

  usage.tokens = preciseTokens + usage.legacyTokens;
  return usage;
}

export function calculateModelCost(model, modelUsage, usdToBrl) {
  const usage = normalizeStoredModelUsage(modelUsage);
  const price = getModelPrice(model);
  const cacheMissInputTokens = usage.inputTokens + usage.cacheCreationInputTokens;

  const preciseUsd =
    (cacheMissInputTokens / MILLION) * price.inputCacheMiss +
    (usage.cacheReadInputTokens / MILLION) * price.inputCacheHit +
    (usage.outputTokens / MILLION) * price.output;

  const legacyRate = (price.inputCacheMiss + price.output) / 2;
  const legacyUsd = (usage.legacyTokens / MILLION) * legacyRate;
  const costUsd = preciseUsd + legacyUsd;

  return {
    tokens: usage.tokens,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    legacyTokens: usage.legacyTokens,
    costUsd: Number(costUsd.toFixed(8)),
    costBrl: Number((costUsd * usdToBrl).toFixed(4)),
    estimatedFromLegacy: usage.legacyTokens > 0,
  };
}

export function summarizeUsage(usage, usdToBrl) {
  const models = usage?.models || {};
  let totalTokens = 0;
  let totalUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadInputTokens = 0;
  let totalCacheCreationInputTokens = 0;
  let totalLegacyTokens = 0;

  const rows = Object.entries(models).map(([model, data]) => {
    const row = {
      model: normalizeModel(model),
      ...calculateModelCost(model, data, usdToBrl),
    };
    totalTokens += row.tokens;
    totalUsd += row.costUsd;
    totalInputTokens += row.inputTokens;
    totalOutputTokens += row.outputTokens;
    totalCacheReadInputTokens += row.cacheReadInputTokens;
    totalCacheCreationInputTokens += row.cacheCreationInputTokens;
    totalLegacyTokens += row.legacyTokens;
    return row;
  });

  rows.sort((a, b) => b.tokens - a.tokens || a.model.localeCompare(b.model));

  return {
    rows,
    totals: {
      tokens: totalTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadInputTokens: totalCacheReadInputTokens,
      cacheCreationInputTokens: totalCacheCreationInputTokens,
      legacyTokens: totalLegacyTokens,
      costUsd: Number(totalUsd.toFixed(8)),
      costBrl: Number((totalUsd * usdToBrl).toFixed(4)),
    },
    pricingSource: PRICING_SOURCE,
  };
}
