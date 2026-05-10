import { Redis } from '@upstash/redis';
const kv = Redis.fromEnv();

const KV_KEY = 'miyo:spots';
const MAX_ITEMS  = 50;
const ID_MAX     = 80;
const NAME_MAX   = 80;
const ADDR_MAX   = 200;
const STATION_MAX= 80;
const DESC_MAX   = 500;
const URL_MAX    = 500;

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
    const err = new Error('spots must be an array');
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
  input.forEach((s, i) => {
    if (!s || typeof s !== 'object') {
      const err = new Error('invalid item');
      err.code = 'INVALID_ITEM';
      throw err;
    }
    const id          = typeof s.id          === 'string' ? s.id.trim().slice(0, ID_MAX)             : '';
    const name        = typeof s.name        === 'string' ? s.name.trim().slice(0, NAME_MAX)         : '';
    const address     = typeof s.address     === 'string' ? s.address.trim().slice(0, ADDR_MAX)      : '';
    const station     = typeof s.station     === 'string' ? s.station.trim().slice(0, STATION_MAX)   : '';
    const image       = typeof s.image       === 'string' ? s.image.trim().slice(0, URL_MAX)         : '';
    const description = typeof s.description === 'string' ? s.description.trim().slice(0, DESC_MAX)  : '';
    const order       = Number.isFinite(s.order) ? Math.floor(s.order) : i;

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
    if (!isSafeUrl(image)) {
      const err = new Error('invalid image url');
      err.code = 'INVALID_URL';
      throw err;
    }

    out.push({ id, name, address, station, image, description, order });
  });

  out.sort((a, b) => a.order - b.order);
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const raw = await kv.get(KV_KEY);
      const spots = Array.isArray(raw)
        ? raw.filter(s => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.name === 'string')
        : [];
      return res.status(200).json({ spots });
    } catch (e) {
      return res.status(200).json({ spots: [] });
    }
  }

  if (req.method === 'PUT') {
    const expected = (process.env.MIYO_EDIT_PASSWORD || '').trim();
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

    const { password, spots } = body;
    const pwTrimmed = typeof password === 'string' ? password.trim() : '';
    if (!pwTrimmed || pwTrimmed !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    let normalized;
    try {
      normalized = normalize(spots);
    } catch (e) {
      return res.status(400).json({ error: e.code || 'invalid spots', message: e.message });
    }

    try {
      await kv.set(KV_KEY, normalized);
    } catch (e) {
      return res.status(500).json({ error: 'storage error' });
    }

    return res.status(200).json({ ok: true, count: normalized.length, spots: normalized });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method not allowed' });
}
