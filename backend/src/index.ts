//backend/src/index.ts

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { zohoRouter } from './routes/zoho';
import { csvMappingRouter } from './routes/csvMapping';
import { cacheRouter } from './routes/cache';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
app.use(cors({ origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*' ? '*' : allowedOrigins }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/zoho', zohoRouter);
app.use('/api/csv-mapping', csvMappingRouter);
app.use('/api/cache', cacheRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
