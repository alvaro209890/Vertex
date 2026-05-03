import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import { meRouter } from './routes/me.js';
import { usageRouter } from './routes/usage.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors());
app.use(express.json());

// Health check (sem auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'vertex-api' });
});

// Rotas protegidas
app.use('/me', authMiddleware, meRouter);
app.use('/usage', authMiddleware, usageRouter);

app.listen(PORT, () => {
  console.log(`Vertex API rodando em http://127.0.0.1:${PORT}`);
});
