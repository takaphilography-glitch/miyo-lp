import { kv } from '@vercel/kv';

const KV_KEY = 'miyo:spots';
const SPOTS_COUNT = 5;

const DEFAULT_SPOTS = [
  { name: '', url: '', image: '' },
  { name: '', url: '', image: '' },
  { name: '', url: '', image: '' },
  { name: '', url: '', image: '' },
  { name: '', url: '', image: '' }
];

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
  const out = [];
  for (let i = 0; i < SPOTS_COUNT; i++) {
    const s = (Array.isArray(input) && input[i]) || {};
    const name  = typeof s.name  === 'string' ? s.name.trim().slice(0, 80)  : '';
    const url   = typeof s.url   === 'string' ? s.url.trim().slice(0, 500)  : '';
    const image = typeof s.image === 'string' ? s.image.trim().slice(0, 500) : '';
    if (!isSafeUrl(url) || !isSafeUrl(image)) {
      const err = new Error('invalid url');
      err.code = 'INVALID_URL';
      throw err;
    }
    out.push({ name, url, image });
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const raw = await kv.get(KV_KEY);
      const spots = normalize(raw || DEFAULT_SPOTS);
      return res.status(200).json({ spots });
    } catch (e) {
      return res.status(200).json({ spots: DEFAULT_SPOTS });
    }
  }

  if (req.method === 'POST') {
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

    const { password, spots } = body;
    if (typeof password !== 'string' || password !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    let normalized;
    try {
      normalized = normalize(spots);
    } catch (e) {
      return res.status(400).json({ error: e.code || 'invalid spots' });
    }

    try {
      await kv.set(KV_KEY, normalized);
    } catch (e) {
      return res.status(500).json({ error: 'storage error' });
    }

    return res.status(200).json({ ok: true, spots: normalized });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
