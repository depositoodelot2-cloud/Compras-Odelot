import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Database Structure
interface DatabaseSchema {
  lists: any[];
  products: any[];
  suppliers: any[];
  quotes: any[];
  users: any[];
  catalog: any[];
}

const INITIAL_DB: DatabaseSchema = {
  lists: [],
  products: [],
  suppliers: [],
  quotes: [],
  users: [],
  catalog: [],
};

// In-Memory Database initialized from file or default
let dbState: DatabaseSchema = { ...INITIAL_DB };

if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    dbState = { ...INITIAL_DB, ...JSON.parse(raw) };
  } catch (err) {
    console.warn('Error reading database.json, using defaults:', err);
  }
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
}

function persistDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write database.json:', err);
  }
}

app.use(express.json({ limit: '10mb' }));

// API Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/data', (_req: Request, res: Response) => {
  res.json(dbState);
});

// Users management endpoints
app.get('/api/users', (_req: Request, res: Response) => {
  res.json(dbState.users || []);
});

app.post('/api/auth/register-profile', (req: Request, res: Response) => {
  const profile = req.body;
  if (!profile || !profile.id) {
    return res.status(400).json({ error: 'Perfil inválido' });
  }

  const users = dbState.users || [];
  const idx = users.findIndex((u: any) => u.id === profile.id || (u.email && profile.email && u.email.toLowerCase() === profile.email.toLowerCase()));
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...profile };
  } else {
    users.unshift(profile);
  }
  dbState.users = users;
  persistDb();
  res.json({ success: true, profile });
});

// Sync collection updates
app.post('/api/sync', (req: Request, res: Response) => {
  const { collectionName, item, action, id } = req.body;
  if (!collectionName || !(collectionName in dbState)) {
    return res.status(400).json({ error: 'Coleção inválida' });
  }

  const list = dbState[collectionName as keyof DatabaseSchema] as any[];

  if (action === 'delete') {
    dbState[collectionName as keyof DatabaseSchema] = list.filter((x: any) => x.id !== (id || item?.id));
  } else if (item && item.id) {
    const idx = list.findIndex((x: any) => x.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
  }

  persistDb();
  res.json({ success: true, count: dbState[collectionName as keyof DatabaseSchema].length });
});

// Clear cache and reset products endpoint
app.post('/api/clear-cache', (req: Request, res: Response) => {
  const { target } = req.body || {};
  if (target === 'all') {
    dbState.products = [];
    dbState.quotes = [];
    dbState.catalog = [];
  } else {
    // default: clear products and quotes
    dbState.products = [];
    dbState.quotes = [];
  }
  persistDb();
  res.json({
    success: true,
    message: 'Cache e produtos limpos com sucesso.',
    counts: {
      products: dbState.products.length,
      quotes: dbState.quotes.length,
    },
  });
});

// Synchronize active portal data so external links always resolve
app.post('/api/sync-portal-data', (req: Request, res: Response) => {
  const { supplier, list, products, quote } = req.body || {};
  if (supplier && supplier.id) {
    const idx = dbState.suppliers.findIndex((s: any) => s.id === supplier.id || s.id?.toLowerCase() === supplier.id?.toLowerCase());
    if (idx >= 0) dbState.suppliers[idx] = { ...dbState.suppliers[idx], ...supplier };
    else dbState.suppliers.unshift(supplier);
  }
  if (list && list.id) {
    const idx = dbState.lists.findIndex((l: any) => l.id === list.id || l.id?.toLowerCase() === list.id?.toLowerCase());
    if (idx >= 0) dbState.lists[idx] = { ...dbState.lists[idx], ...list };
    else dbState.lists.unshift(list);
  }
  if (products && Array.isArray(products)) {
    products.forEach((p: any) => {
      const idx = dbState.products.findIndex((prod: any) => prod.id === p.id);
      if (idx >= 0) dbState.products[idx] = { ...dbState.products[idx], ...p };
      else dbState.products.push(p);
    });
  }
  if (quote && quote.listaId && quote.fornecedorId) {
    const idx = dbState.quotes.findIndex(
      (q: any) =>
        (q.listaId === quote.listaId || q.listaId?.toLowerCase() === quote.listaId?.toLowerCase()) &&
        (q.fornecedorId === quote.fornecedorId || q.fornecedorId?.toLowerCase() === quote.fornecedorId?.toLowerCase())
    );
    if (idx >= 0) dbState.quotes[idx] = { ...dbState.quotes[idx], ...quote };
    else dbState.quotes.unshift(quote);
  }
  persistDb();
  res.json({
    success: true,
    supplierId: supplier?.id,
    listId: list?.id,
    productsCount: Array.isArray(products) ? products.length : 0,
  });
});

// Portal Quote direct lookup for suppliers
app.get('/api/portal-quote', (req: Request, res: Response) => {
  const supplierId = (req.query.supplierId as string || '').trim();
  const listId = (req.query.listId as string || '').trim();
  const token = (req.query.token as string || '').trim();

  if (!supplierId || !listId) {
    return res.status(400).json({ error: 'supplierId e listId são obrigatórios' });
  }

  // Reload database.json if current state is empty to capture any direct writes
  if (fs.existsSync(DB_FILE) && dbState.suppliers.length === 0) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const diskDb = JSON.parse(raw);
      if (diskDb && Array.isArray(diskDb.suppliers)) {
        dbState = { ...dbState, ...diskDb };
      }
    } catch {}
  }

  let supplier = dbState.suppliers.find(
    (s: any) => s.id === supplierId || s.id?.toLowerCase() === supplierId.toLowerCase()
  );
  if (!supplier && token) {
    supplier = dbState.suppliers.find((s: any) => s.tokenAcesso === token);
  }

  const list = dbState.lists.find(
    (l: any) => l.id === listId || l.id?.toLowerCase() === listId.toLowerCase()
  );
  const products = dbState.products.filter(
    (p: any) => p.listaId === listId || p.listaId?.toLowerCase() === listId.toLowerCase()
  );
  const quote = dbState.quotes.find(
    (q: any) =>
      (q.listaId === listId || q.listaId?.toLowerCase() === listId.toLowerCase()) &&
      (q.fornecedorId === supplierId || q.fornecedorId?.toLowerCase() === supplierId.toLowerCase())
  ) || null;

  if (!supplier || !list) {
    return res.status(404).json({
      error: 'Cotação não encontrada',
      hasSupplier: !!supplier,
      hasList: !!list,
      allSuppliers: dbState.suppliers.map((s: any) => ({ id: s.id, nome: s.nome })),
      allLists: dbState.lists.map((l: any) => ({ id: l.id, nome: l.nome, fabrica: l.fabrica })),
    });
  }

  res.json({
    supplier,
    list,
    products,
    quote,
  });
});

// Save Quote directly from supplier portal
app.post('/api/save-quote', (req: Request, res: Response) => {
  const quote = req.body;
  if (!quote || !quote.listaId || !quote.fornecedorId) {
    return res.status(400).json({ error: 'Dados da cotação incompletos' });
  }

  const quotes = dbState.quotes;
  const idx = quotes.findIndex((q: any) => q.id === quote.id);
  if (idx >= 0) {
    quotes[idx] = quote;
  } else {
    quotes.unshift(quote);
  }

  persistDb();
  res.json({ success: true, quote });
});

// Vite or Static files handler
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
});
