import { kv } from '@vercel/kv';

const KV_KEY = 'miyo:costumes';
const VALID_CATEGORIES = ['kimono', 'cosplay', 'dress', 'casual', 'other'];
const MAX_ITEMS = 500;
const ID_MAX = 80;
const NAME_MAX = 80;
const URL_MAX = 500;

function isSafeUrl(u) {
  if (!u) return true;
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function normalize(input) {
  if (!Array.isArray(input)) {
    const err = new Error('costumes must be an array');
    err.code = 'INVALID_FORMAT';
    throw err;
  }
  if (input.length > MAX_ITEMS) {
    const err = new Error('too many items');
    err.code = 'TOO_MANY';
    throw err;
  }

  const out = [];
  const seenIds = new Set();
  for (const c of input) {
    if (!c || typeof c !== 'object') {
      const err = new Error('invalid item');
      err.code = 'INVALID_ITEM';
      throw err;
    }
    const id       = typeof c.id       === 'string' ? c.id.trim().slice(0, ID_MAX)        : '';
    const name     = typeof c.name     === 'string' ? c.name.trim().slice(0, NAME_MAX)    : '';
    const category = typeof c.category === 'string' ? c.category.trim()                   : '';
    const image    = typeof c.image    === 'string' ? c.image.trim().slice(0, URL_MAX)    : '';

    if (!id) {
      const err = new Error('id required');
      err.code = 'INVALID_ID';
      throw err;
    }
    if (seenIds.has(id)) {
      const err = new Error('duplicate id');
      err.code = 'DUPLICATE_ID';
      throw err;
    }
    seenIds.add(id);

    if (!name) {
      const err = new Error('name required');
      err.code = 'INVALID_NAME';
      throw err;
    }
    if (!VALID_CATEGORIES.includes(category)) {
      const err = new Error('invalid category');
      err.code = 'INVALID_CATEGORY';
      throw err;
    }
    if (!isSafeUrl(image)) {
      const err = new Error('invalid image url');
      err.code = 'INVALID_URL';
      throw err;
    }

    out.push({ id, name, category, image });
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const raw = await kv.get(KV_KEY);
      const costumes = Array.isArray(raw) ? raw : [];
      return res.status(200).json({ costumes });
    } catch (e) {
      return res.status(200).json({ costumes: [] });
    }
  }

  if (req.method === 'PUT') {
    const expected = process.env.MIYO_EDIT_PASSWORD;
    if (!expected) {
      return res.status(500).json({ error: 'password not configured' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = null; }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'invalid body' });
    }

    const { password, costumes } = body;
    if (typeof password !== 'string' || password !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    let normalized;
    try {
      normalized = normalize(costumes);
    } catch (e) {
      return res.status(400).json({ error: e.code || 'invalid costumes', message: e.message });
    }

    try {
      await kv.set(KV_KEY, normalized);
    } catch (e) {
      return res.status(500).json({ error: 'storage error' });
    }

    return res.status(200).json({ ok: true, count: normalized.length, costumes: normalized });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method not allowed' });
}
