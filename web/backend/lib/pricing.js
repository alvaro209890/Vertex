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
  const promptCacheHitTokens = numberOrZero(
    raw?.promptCacheHitTokens ?? raw?.prompt_cache_hit_tokens
  );
  const promptCacheMissTokens = numberOrZero(
    raw?.promptCacheMissTokens ?? raw?.prompt_cache_miss_tokens
  );
  const completionTokens = numberOrZero(
    raw?.completionTokens ?? raw?.completion_tokens
  );
  const inputTokens = numberOrZero(raw?.inputTokens ?? raw?.input_tokens);
  const outputTokens = numberOrZero(raw?.outputTokens ?? raw?.output_tokens) || completionTokens;
  const cacheReadInputTokens = numberOrZero(
    raw?.cacheReadInputTokens ?? raw?.cache_read_input_tokens
  ) || promptCacheHitTokens;
  const cacheCreationInputTokens = numberOrZero(
    raw?.cacheCreationInputTokens ?? raw?.cache_creation_input_tokens
  );
  const cacheMissInputTokens =
    promptCacheMissTokens || inputTokens + cacheCreationInputTokens;
  const legacyTokens = numberOrZero(raw?.tokens);
  const preciseTokens =
    cacheMissInputTokens + outputTokens + cacheReadInputTokens;

  return {
    model,
    inputTokens: cacheMissInputTokens,
    outputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens: 0,
    promptCacheHitTokens: cacheReadInputTokens,
    promptCacheMissTokens: cacheMissInputTokens,
    completionTokens: outputTokens,
    legacyTokens: preciseTokens > 0 ? 0 : legacyTokens,
    totalTokens: preciseTokens > 0 ? preciseTokens : legacyTokens,
    requestId: raw?.requestId ?? raw?.request_id ?? null,
  };
}

export function emptyModelUsage() {
  return {
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

export function normalizeStoredModelUsage(modelUsage) {
  const usage = { ...emptyModelUsage(), ...(modelUsage || {}) };
  usage.inputTokens = numberOrZero(usage.inputTokens);
  usage.outputTokens = numberOrZero(usage.outputTokens);
  usage.cacheReadInputTokens = numberOrZero(usage.cacheReadInputTokens);
  usage.cacheCreationInputTokens = numberOrZero(usage.cacheCreationInputTokens);
  usage.promptCacheHitTokens = numberOrZero(
    usage.promptCacheHitTokens || usage.cacheReadInputTokens
  );
  usage.promptCacheMissTokens = numberOrZero(
    usage.promptCacheMissTokens || usage.inputTokens + usage.cacheCreationInputTokens
  );
  usage.completionTokens = numberOrZero(usage.completionTokens || usage.outputTokens);
  usage.legacyTokens = numberOrZero(usage.legacyTokens);

  const preciseTokens =
    usage.promptCacheMissTokens + usage.promptCacheHitTokens + usage.completionTokens;

  if (preciseTokens === 0 && !usage.legacyTokens && usage.tokens) {
    usage.legacyTokens = numberOrZero(usage.tokens);
  }

  usage.tokens = preciseTokens + usage.legacyTokens;
  return usage;
}

export function calculateModelCost(model, modelUsage, usdToBrl) {
  const usage = normalizeStoredModelUsage(modelUsage);
  const price = getModelPrice(model);
  const cacheMissInputTokens = usage.promptCacheMissTokens;

  const preciseUsd =
    (cacheMissInputTokens / MILLION) * price.inputCacheMiss +
    (usage.promptCacheHitTokens / MILLION) * price.inputCacheHit +
    (usage.completionTokens / MILLION) * price.output;

  const legacyRate = (price.inputCacheMiss + price.output) / 2;
  const legacyUsd = (usage.legacyTokens / MILLION) * legacyRate;
  const costUsd = preciseUsd + legacyUsd;

  return {
    tokens: usage.tokens,
    inputTokens: usage.promptCacheMissTokens,
    outputTokens: usage.completionTokens,
    cacheReadInputTokens: usage.promptCacheHitTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    promptCacheHitTokens: usage.promptCacheHitTokens,
    promptCacheMissTokens: usage.promptCacheMissTokens,
    completionTokens: usage.completionTokens,
    legacyTokens: usage.legacyTokens,
    costUsd: Number(costUsd.toFixed(8)),
    costBrl: Number((costUsd * usdToBrl).toFixed(4)),
    estimatedFromLegacy: usage.legacyTokens > 0,
  };
}

function toValidDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function bucketStartIso(date, unit) {
  const bucket = new Date(date);
  if (unit === 'day') {
    bucket.setHours(0, 0, 0, 0);
  } else {
    bucket.setMinutes(0, 0, 0);
  }
  return bucket.toISOString();
}

function bucketLabel(iso, options) {
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(iso));
}

function emptyBucket(iso, options) {
  return {
    bucket: iso,
    label: bucketLabel(iso, options),
    tokens: 0,
    costUsd: 0,
    costBrl: 0,
    requests: 0,
  };
}

function eventFromModelTotal(row) {
  return {
    timestamp: row.lastUsed,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cacheReadInputTokens: row.cacheReadInputTokens,
    cacheCreationInputTokens: row.cacheCreationInputTokens,
    promptCacheHitTokens: row.promptCacheHitTokens,
    promptCacheMissTokens: row.promptCacheMissTokens,
    completionTokens: row.completionTokens,
    legacyTokens: row.legacyTokens,
    tokens: row.tokens,
    estimatedFromModelTotal: true,
    source: 'model-total-fallback',
  };
}

function normalizeUsageEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const timestamp = toValidDate(raw.timestamp);
  if (!timestamp) return null;

  const model = normalizeModel(raw.model);
  const usage = normalizeStoredModelUsage(raw);
  if (usage.tokens <= 0) return null;

  return {
    timestamp: timestamp.toISOString(),
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    promptCacheHitTokens: usage.promptCacheHitTokens,
    promptCacheMissTokens: usage.promptCacheMissTokens,
    completionTokens: usage.completionTokens,
    legacyTokens: usage.legacyTokens,
    tokens: usage.tokens,
    estimatedFromModelTotal: Boolean(raw.estimatedFromModelTotal),
    source: raw.source || 'vertex-proxy',
  };
}

function addToBucket(bucket, event, usdToBrl) {
  const cost = calculateModelCost(event.model, event, usdToBrl);
  bucket.tokens += cost.tokens;
  bucket.costUsd += cost.costUsd;
  bucket.costBrl += cost.costBrl;
  bucket.requests += 1;
}

function buildRangeBuckets(now, count, unit, options) {
  const end = new Date(now);
  if (unit === 'day') {
    end.setHours(0, 0, 0, 0);
  } else {
    end.setMinutes(0, 0, 0);
  }

  return Array.from({ length: count }, (_, index) => {
    const bucket = new Date(end);
    if (unit === 'day') {
      bucket.setDate(end.getDate() - (count - 1 - index));
    } else {
      bucket.setHours(end.getHours() - (count - 1 - index));
    }
    const iso = bucket.toISOString();
    return emptyBucket(iso, options);
  });
}

function finalizeBuckets(buckets) {
  return buckets.map((bucket) => ({
    ...bucket,
    costUsd: Number(bucket.costUsd.toFixed(8)),
    costBrl: Number(bucket.costBrl.toFixed(4)),
  }));
}

function buildTimeAnalytics(events, usdToBrl, now = new Date()) {
  const hourly = buildRangeBuckets(now, 24, 'hour', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const daily = buildRangeBuckets(now, 14, 'day', {
    day: '2-digit',
    month: '2-digit',
  });

  const hourlyByBucket = new Map(hourly.map((bucket) => [bucket.bucket, bucket]));
  const dailyByBucket = new Map(daily.map((bucket) => [bucket.bucket, bucket]));

  for (const event of events) {
    const date = new Date(event.timestamp);
    const hourKey = bucketStartIso(date, 'hour');
    const dayKey = bucketStartIso(date, 'day');
    if (hourlyByBucket.has(hourKey)) {
      addToBucket(hourlyByBucket.get(hourKey), event, usdToBrl);
    }
    if (dailyByBucket.has(dayKey)) {
      addToBucket(dailyByBucket.get(dayKey), event, usdToBrl);
    }
  }

  const finalizedHourly = finalizeBuckets(hourly);
  const finalizedDaily = finalizeBuckets(daily);
  const peakHour = finalizedHourly.reduce(
    (max, bucket) => (bucket.tokens > max.tokens ? bucket : max),
    finalizedHourly[0] || null
  );

  return {
    hourly: finalizedHourly,
    daily: finalizedDaily,
    peakHour,
    recent: events
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 10)
      .map((event) => {
        const cost = calculateModelCost(event.model, event, usdToBrl);
        return {
          ...event,
          costUsd: cost.costUsd,
          costBrl: cost.costBrl,
        };
      }),
  };
}

export function summarizeUsage(usage, usdToBrl, options = {}) {
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
      lastUsed: data?.lastUsed || null,
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

  const storedEvents = Array.isArray(usage?.history) ? usage.history : [];
  let events = storedEvents.map(normalizeUsageEvent).filter(Boolean);
  const hasRealHistory = events.length > 0;
  if (!hasRealHistory) {
    events = rows.map(eventFromModelTotal).map(normalizeUsageEvent).filter(Boolean);
  }
  const now = options.now ? toValidDate(options.now) || new Date() : new Date();
  const analytics = buildTimeAnalytics(events, usdToBrl, now);

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
      requests: events.length,
      cacheSavings: {
        savingsUsd: Number(
          (
            (totalCacheReadInputTokens / MILLION)
            * (MODEL_PRICES_PER_MILLION[DEFAULT_MODEL].inputCacheMiss
              - MODEL_PRICES_PER_MILLION[DEFAULT_MODEL].inputCacheHit)
          ).toFixed(8)
        ),
        savingsBrl: Number(
          (
            (totalCacheReadInputTokens / MILLION)
            * (MODEL_PRICES_PER_MILLION[DEFAULT_MODEL].inputCacheMiss
              - MODEL_PRICES_PER_MILLION[DEFAULT_MODEL].inputCacheHit)
            * usdToBrl
          ).toFixed(4)
        ),
      },
    },
    analytics: {
      ...analytics,
      hasRealHistory,
      historyEventCount: events.length,
      tokenTypes: [
        { key: 'inputTokens', label: 'Cache miss', value: totalInputTokens },
        { key: 'outputTokens', label: 'Saida', value: totalOutputTokens },
        { key: 'cacheReadInputTokens', label: 'Cache hit', value: totalCacheReadInputTokens },
        {
          key: 'cacheCreationInputTokens',
          label: 'Cache miss',
          value: totalCacheCreationInputTokens,
        },
        { key: 'legacyTokens', label: 'Legado', value: totalLegacyTokens },
      ],
    },
    pricingSource: PRICING_SOURCE,
  };
}
