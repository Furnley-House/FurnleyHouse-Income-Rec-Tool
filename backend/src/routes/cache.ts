import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';

export const cacheRouter = Router();

// ============ Payments ============

cacheRouter.get('/payments', async (_req: Request, res: Response) => {
  const data = await prisma.cachedPayment.findMany({ orderBy: { cachedAt: 'desc' } });
  res.json(data);
});

cacheRouter.put('/payments/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await prisma.cachedPayment.update({ where: { id }, data: req.body });
  res.json(data);
});

cacheRouter.post('/payments/bulk', async (req: Request, res: Response) => {
  // Upsert many payments (used during Zoho download)
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
});

cacheRouter.delete('/payments', async (_req: Request, res: Response) => {
  await prisma.cachedPayment.deleteMany();
  res.json({ success: true });
});

// ============ Line Items ============

cacheRouter.get('/line-items', async (req: Request, res: Response) => {
  const { paymentId } = req.query;
  const where = paymentId ? { paymentId: String(paymentId) } : {};
  const data = await prisma.cachedLineItem.findMany({ where, orderBy: { cachedAt: 'desc' } });
  res.json(data);
});

cacheRouter.put('/line-items/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await prisma.cachedLineItem.update({ where: { id }, data: req.body });
  res.json(data);
});

cacheRouter.post('/line-items/bulk', async (req: Request, res: Response) => {
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
});

cacheRouter.delete('/line-items', async (_req: Request, res: Response) => {
  await prisma.cachedLineItem.deleteMany();
  res.json({ success: true });
});

// ============ Expectations ============

cacheRouter.get('/expectations', async (_req: Request, res: Response) => {
  const data = await prisma.cachedExpectation.findMany({ orderBy: { cachedAt: 'desc' } });
  res.json(data);
});

cacheRouter.put('/expectations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await prisma.cachedExpectation.update({ where: { id }, data: req.body });
  res.json(data);
});

cacheRouter.post('/expectations/bulk', async (req: Request, res: Response) => {
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
});

cacheRouter.delete('/expectations', async (_req: Request, res: Response) => {
  await prisma.cachedExpectation.deleteMany();
  res.json({ success: true });
});

// ============ Pending Matches ============

cacheRouter.get('/pending-matches', async (_req: Request, res: Response) => {
  const data = await prisma.pendingMatch.findMany({ orderBy: { matchedAt: 'desc' } });
  res.json(data);
});

cacheRouter.post('/pending-matches', async (req: Request, res: Response) => {
  const data = await prisma.pendingMatch.create({ data: req.body });
  res.json(data);
});

cacheRouter.post('/pending-matches/bulk', async (req: Request, res: Response) => {
  const { matches } = req.body;
  const results = await Promise.all(
    matches.map((m: any) =>
      prisma.pendingMatch.upsert({
        where: { id: m.id },
        update: m,
        create: m,
      })
    )
  );
  res.json({ count: results.length });
});

cacheRouter.put('/pending-matches/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await prisma.pendingMatch.update({ where: { id }, data: req.body });
  res.json(data);
});

cacheRouter.delete('/pending-matches', async (req: Request, res: Response) => {
  const { syncedOnly } = req.query;
  if (syncedOnly === 'true') {
    await prisma.pendingMatch.deleteMany({ where: { syncedToZoho: true } });
  } else {
    await prisma.pendingMatch.deleteMany();
  }
  res.json({ success: true });
});

// ============ Sync Status ============

cacheRouter.get('/sync-status', async (_req: Request, res: Response) => {
  let status = await prisma.syncStatus.findUnique({ where: { id: 'current' } });
  if (!status) {
    status = await prisma.syncStatus.create({ data: { id: 'current' } });
  }
  res.json(status);
});

cacheRouter.put('/sync-status', async (req: Request, res: Response) => {
  const data = await prisma.syncStatus.upsert({
    where: { id: 'current' },
    update: req.body,
    create: { id: 'current', ...req.body },
  });
  res.json(data);
});
