import { Router } from 'express';
import { getUsage, recordUsage, ensureProfile } from '../db/store.js';

export const usageRouter = Router();

// Tabela de precos DeepSeek (USD por 1M tokens)
// Modelos disponiveis: apenas v4-flash e v4-pro
const MODEL_PRICES = {
  'deepseek/deepseek-v4-flash': { input: 0.15, output: 0.60 },
  'deepseek/deepseek-v4-pro': { input: 0.40, output: 1.50 },
};

function averagePrice(model) {
  const p = MODEL_PRICES[model];
  if (!p) return 1.0; // preco padrao para modelos nao listados
  return (p.input + p.output) / 2 / 1_000_000; // preco por token
}

// POST /usage - registrar uso
usageRouter.post('/', async (req, res) => {
  try {
    const { uid, email } = req.user;
    const { model, tokens, timestamp } = req.body;

    if (!model || typeof tokens !== 'number') {
      return res.status(400).json({ error: 'Campos obrigatorios: model (string), tokens (number)' });
    }

    await ensureProfile(uid, email);
    const updated = await recordUsage(uid, { model, tokens, timestamp });
    res.json({ status: 'ok', updated });
  } catch (err) {
    console.error('Erro em POST /usage:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /usage/summary - resumo com custos
usageRouter.get('/summary', async (req, res) => {
  try {
    const { uid } = req.user;
    const usage = await getUsage(uid);
    const usdToBrl = parseFloat(process.env.USD_TO_BRL || '5.0');

    const models = usage.models || {};
    let totalTokens = 0;
    let totalUsd = 0;

    const rows = Object.entries(models).map(([model, data]) => {
      const tokens = data.tokens || 0;
      const usd = tokens * averagePrice(model);
      totalTokens += tokens;
      totalUsd += usd;
      return {
        model,
        tokens,
        costUsd: parseFloat(usd.toFixed(6)),
        costBrl: parseFloat((usd * usdToBrl).toFixed(2)),
      };
    });

    res.json({
      rows,
      totals: {
        tokens: totalTokens,
        costUsd: parseFloat(totalUsd.toFixed(6)),
        costBrl: parseFloat((totalUsd * usdToBrl).toFixed(2)),
      },
      exchangeRate: usdToBrl,
    });
  } catch (err) {
    console.error('Erro em GET /usage/summary:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
