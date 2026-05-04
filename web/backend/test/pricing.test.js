import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateModelCost,
  normalizeModel,
  normalizeUsageDelta,
  summarizeUsage,
} from '../lib/pricing.js';

test('normalizes DeepSeek V4 aliases', () => {
  assert.equal(normalizeModel('deepseek-v4-flash'), 'deepseek/deepseek-v4-flash');
  assert.equal(normalizeModel('deepseek/deepseek-v4-pro'), 'deepseek/deepseek-v4-pro');
});

test('calculates DeepSeek V4 Flash cost with separated token counters', () => {
  const cost = calculateModelCost(
    'deepseek/deepseek-v4-flash',
    {
      inputTokens: 1_000_000,
      cacheCreationInputTokens: 1_000_000,
      cacheReadInputTokens: 1_000_000,
      outputTokens: 1_000_000,
    },
    5
  );

  assert.equal(cost.tokens, 4_000_000);
  assert.equal(cost.costUsd, 0.5628);
  assert.equal(cost.costBrl, 2.814);
});

test('calculates DeepSeek V4 Pro promo cost', () => {
  const cost = calculateModelCost(
    'deepseek/deepseek-v4-pro',
    {
      inputTokens: 1_000_000,
      cacheReadInputTokens: 1_000_000,
      outputTokens: 1_000_000,
    },
    5
  );

  assert.equal(cost.costUsd, 1.308625);
  assert.equal(cost.costBrl, 6.5431);
});

test('accepts legacy total tokens but marks cost as estimated', () => {
  const cost = calculateModelCost('deepseek/deepseek-v4-flash', { tokens: 1_000_000 }, 5);

  assert.equal(cost.tokens, 1_000_000);
  assert.equal(cost.estimatedFromLegacy, true);
  assert.equal(cost.costUsd, 0.21);
});

test('summarizes usage totals', () => {
  const summary = summarizeUsage(
    {
      models: {
        'deepseek-v4-flash': {
          inputTokens: 100,
          outputTokens: 50,
          lastUsed: '2026-05-04T12:10:00.000Z',
        },
      },
    },
    5,
    { now: '2026-05-04T12:30:00.000Z' }
  );

  assert.equal(summary.rows[0].model, 'deepseek/deepseek-v4-flash');
  assert.equal(summary.totals.tokens, 150);
  assert.equal(summary.totals.inputTokens, 100);
  assert.equal(summary.totals.outputTokens, 50);
  assert.equal(summary.analytics.hasRealHistory, false);
  assert.equal(summary.analytics.hourly.at(-1).tokens, 150);
});

test('normalizes incoming usage deltas', () => {
  assert.deepEqual(normalizeUsageDelta({
    model: 'deepseek-v4-flash',
    input_tokens: 10,
    output_tokens: 4,
    tokens: 1000,
  }), {
    model: 'deepseek/deepseek-v4-flash',
    inputTokens: 10,
    outputTokens: 4,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 10,
    completionTokens: 4,
    legacyTokens: 0,
    totalTokens: 14,
    requestId: null,
  });
});

test('normalizes exact DeepSeek usage fields', () => {
  assert.deepEqual(normalizeUsageDelta({
    model: 'deepseek-v4-flash',
    prompt_cache_hit_tokens: 3,
    prompt_cache_miss_tokens: 11,
    completion_tokens: 5,
    request_id: 'req_1',
  }), {
    model: 'deepseek/deepseek-v4-flash',
    inputTokens: 11,
    outputTokens: 5,
    cacheReadInputTokens: 3,
    cacheCreationInputTokens: 0,
    promptCacheHitTokens: 3,
    promptCacheMissTokens: 11,
    completionTokens: 5,
    legacyTokens: 0,
    totalTokens: 19,
    requestId: 'req_1',
  });
});

test('summarizes real hourly usage history', () => {
  const summary = summarizeUsage(
    {
      models: {
        'deepseek-v4-flash': {
          inputTokens: 10,
          outputTokens: 4,
          lastUsed: '2026-05-04T12:10:00.000Z',
        },
      },
      history: [
        {
          timestamp: '2026-05-04T11:15:00.000Z',
          model: 'deepseek-v4-flash',
          inputTokens: 10,
          outputTokens: 5,
        },
        {
          timestamp: '2026-05-04T12:10:00.000Z',
          model: 'deepseek-v4-flash',
          cacheReadInputTokens: 20,
          outputTokens: 4,
        },
      ],
    },
    5,
    { now: '2026-05-04T12:30:00.000Z' }
  );

  const lastTwo = summary.analytics.hourly.slice(-2).map((bucket) => bucket.tokens);
  assert.deepEqual(lastTwo, [15, 24]);
  assert.equal(summary.analytics.hasRealHistory, true);
  assert.equal(summary.analytics.recent[0].tokens, 24);
  assert.equal(summary.totals.requests, 2);
});
