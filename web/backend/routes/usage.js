import { Router } from 'express';
import { getUsage, recordUsage, ensureProfile } from '../db/store.js';
import { isSupabaseUsageEnabled } from '../db/supabaseStore.js';
import { parseUsdToBrl, summarizeUsage } from '../lib/pricing.js';

export const usageRouter = Router();

// POST /usage - registrar uso
usageRouter.post('/', async (req, res) => {
  try {
    const { uid, email } = req.user;
    const { model } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Campo obrigatorio: model' });
    }

    await ensureProfile(uid, email);
    const updated = await recordUsage(uid, req.body, email);
    res.json({ status: 'ok', updated });
  } catch (err) {
    console.error('Erro em POST /usage:', err);
    if (err.message?.startsWith('Uso invalido')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /usage/summary - resumo com custos
usageRouter.get('/summary', async (req, res) => {
  try {
    const { uid } = req.user;
    const usage = await getUsage(uid);
    const usdToBrl = parseUsdToBrl(process.env.USD_TO_BRL);
    res.json({
      ...summarizeUsage(usage, usdToBrl),
      exchangeRate: usdToBrl,
      realtime: {
        provider: isSupabaseUsageEnabled() ? 'supabase' : 'polling',
      },
    });
  } catch (err) {
    console.error('Erro em GET /usage/summary:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
