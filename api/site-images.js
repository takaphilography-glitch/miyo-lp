import { kv } from '@vercel/kv';

const KV_KEY = 'miyo:site-images';
const URL_MAX = 500;
const SLOTS = ['hero', 'profile'];

function isSafeUrl(u) {
  if (!u) return true;
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function emptySlot() {
  return { image: '', updatedAt: '' };
}

function readSlot(input) {
  const s = input && typeof input === 'object' ? input : {};
  const image = typeof s.image === 'string' ? s.image.trim().slice(0, URL_MAX) : '';
  const updatedAt = typeof s.updatedAt === 'string' ? s.updatedAt.slice(0, 40) : '';
  return { image, updatedAt };
}

function readStored(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    hero:    readSlot(r.hero),
    profile: readSlot(r.profile)
  };
}

function normalizeForWrite(input, current) {
  if (!input || typeof input !== 'object') {
    const err = new Error('siteImages must be an object');
    err.code = 'INVALID_FORMAT';
    throw err;
  }

  const now = new Date().toISOString();
  const out = {};

  for (const slot of SLOTS) {
    const incoming = input[slot] && typeof input[slot] === 'object' ? input[slot] : {};
    const image = typeof incoming.image === 'string' ? incoming.image.trim().slice(0, URL_MAX) : '';

    if (!isSafeUrl(image)) {
      const err = new Error('invalid image url for ' + slot);
      err.code = 'INVALID_URL';
      throw err;
    }

    const prev = current[slot] || emptySlot();
    const changed = image !== prev.image;
    out[slot] = {
      image,
      updatedAt: changed ? now : (prev.updatedAt || '')
    };
  }

  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const raw = await kv.get(KV_KEY);
      return res.status(200).json({ siteImages: readStored(raw) });
    } catch (e) {
      return res.status(200).json({ siteImages: { hero: emptySlot(), profile: emptySlot() } });
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

    const { password, siteImages } = body;
    if (typeof password !== 'string' || password !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    let current;
    try {
      current = readStored(await kv.get(KV_KEY));
    } catch (e) {
      current = { hero: emptySlot(), profile: emptySlot() };
    }

    let normalized;
    try {
      normalized = normalizeForWrite(siteImages, current);
    } catch (e) {
      return res.status(400).json({ error: e.code || 'invalid siteImages', message: e.message });
    }

    try {
      await kv.set(KV_KEY, normalized);
    } catch (e) {
      return res.status(500).json({ error: 'storage error' });
    }

    return res.status(200).json({ ok: true, siteImages: normalized });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method not allowed' });
}
