import express from 'express';
import cors from 'cors';
import { authRouter } from './api/auth.js';
import { dataRouter } from './api/data.js';
import { aiRouter } from './api/ai.js';

const app = express();
const PORT = process.env.PORT || 6061;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api/ai', aiRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`SyncMind backend running on port ${PORT}`);
});
