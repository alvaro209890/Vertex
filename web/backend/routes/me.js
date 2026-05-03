import { Router } from 'express';
import { getProfile, ensureProfile, getUsage } from '../db/store.js';

export const meRouter = Router();

meRouter.get('/', async (req, res) => {
  try {
    const { uid, email } = req.user;
    const profile = await ensureProfile(uid, email);
    const usage = await getUsage(uid);
    res.json({ profile, usage });
  } catch (err) {
    console.error('Erro em GET /me:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
