//backend/src/routes/cache.ts

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';

export const cacheRouter = Router();

// Global error wrapper — prevents unhandled Prisma errors from crashing the process
function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      const msg = err?.message || 'Database error';
      console.error('[cache] Error:', msg);
      res.status(500).json({ error: msg });
    }
  };
}

// ============ Payments ============

cacheRouter.get('/payments', wrap(async (_req, res) => {
  const data = await prisma.cachedPayment.findMany({ orderBy: { cachedAt: 'desc' } });
  res.json(data);
}));

cacheRouter.put('/payments/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const data = await prisma.cachedPayment.update({ where: { id }, data: req.body });
  res.json(data);
}));

cacheRouter.post('/payments/bulk', wrap(async (req, res) => {
  const { payments } = req.body;
  const results = await Promise.all(
    payments.map((p: any) =>
      prisma.cachedPayment.upsert({
        where: { id: p.id },
        update: p,
        create: p,
      })
    )
  );
  res.json({ count: results.length });
}));

cacheRouter.delete('/payments', wrap(async (_req, res) => {
  await prisma.cachedPayment.deleteMany();
  res.json({ success: true });
}));

// ============ Line Items ============

cacheRouter.get('/line-items', wrap(async (req, res) => {
  const { paymentId } = req.query;
  const where = paymentId ? { paymentId: String(paymentId) } : {};
  const data = await prisma.cachedLineItem.findMany({ where, orderBy: { cachedAt: 'desc' } });
  res.json(data);
}));

cacheRouter.put('/line-items/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const data = await prisma.cachedLineItem.update({ where: { id }, data: req.body });
  res.json(data);
}));

cacheRouter.post('/line-items/bulk', wrap(async (req, res) => {
  const { lineItems } = req.body;
  const results = await Promise.all(
    lineItems.map((li: any) =>
      prisma.cachedLineItem.upsert({
        where: { id: li.id },
        update: li,
        create: li,
      })
    )
  );
  res.json({ count: results.length });
}));

cacheRouter.delete('/line-items', wrap(async (_req, res) => {
  await prisma.cachedLineItem.deleteMany();
  res.json({ success: true });
}));

// ============ Expectations ============

cacheRouter.get('/expectations', wrap(async (_req, res) => {
  const data = await prisma.cachedExpectation.findMany({ orderBy: { cachedAt: 'desc' } });
  res.json(data);
}));

cacheRouter.put('/expectations/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const data = await prisma.cachedExpectation.update({ where: { id }, data: req.body });
  res.json(data);
}));

cacheRouter.post('/expectations/bulk', wrap(async (req, res) => {
  const { expectations } = req.body;
  const results = await Promise.all(
    expectations.map((e: any) =>
      prisma.cachedExpectation.upsert({
        where: { id: e.id },
        update: e,
        create: e,
      })
    )
  );
  res.json({ count: results.length });
}));

cacheRouter.delete('/expectations', wrap(async (_req, res) => {
  await prisma.cachedExpectation.deleteMany();
  res.json({ success: true });
}));

// ============ Pending Matches ============

cacheRouter.get('/pending-matches', wrap(async (_req, res) => {
  const data = await prisma.pendingMatch.findMany({ orderBy: { matchedAt: 'desc' } });
  res.json(data);
}));

cacheRouter.post('/pending-matches', wrap(async (req, res) => {
  const data = await prisma.pendingMatch.create({ data: req.body });
  res.json(data);
}));

cacheRouter.post('/pending-matches/bulk', wrap(async (req, res) => {
  const { matches } = req.body;
  const result = await prisma.pendingMatch.createMany({
    data: matches,
    skipDuplicates: true,
  });
  res.json({ count: result.count });
}));

cacheRouter.put('/pending-matches/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const data = await prisma.pendingMatch.update({ where: { id }, data: req.body });
  res.json(data);
}));

cacheRouter.delete('/pending-matches', wrap(async (req, res) => {
  const { syncedOnly } = req.query;
  if (syncedOnly === 'true') {
    await prisma.pendingMatch.deleteMany({ where: { syncedToZoho: true } });
  } else {
    await prisma.pendingMatch.deleteMany();
  }
  res.json({ success: true });
}));

// ============ Sync Status ============

cacheRouter.get('/sync-status', wrap(async (_req, res) => {
  let status = await prisma.syncStatus.findUnique({ where: { id: 'current' } });
  if (!status) {
    status = await prisma.syncStatus.create({ data: { id: 'current' } });
  }
  res.json(status);
}));

cacheRouter.put('/sync-status', wrap(async (req, res) => {
  const data = await prisma.syncStatus.upsert({
    where: { id: 'current' },
    update: req.body,
    create: { id: 'current', ...req.body },
  });
  res.json(data);
}));
