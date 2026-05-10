import { Redis } from '@upstash/redis';

/**
 * 一時診断エンドポイント — admin ログイン不調の切り分け用。
 * 値そのものは絶対に返さず、設定有無 / 長さ / 空白混入 / KV 到達のみ返す。
 * 切り分けが終わったら削除すること。
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const raw = process.env.MIYO_EDIT_PASSWORD || '';
  const trimmed = raw.trim();

  let kvReachable = false;
  let kvError = null;
  try {
    const kv = Redis.fromEnv();
    await kv.get('miyo:_debug_ping');
    kvReachable = true;
  } catch (e) {
    kvError = (e && e.message) ? e.message : String(e);
  }

  return res.status(200).json({
    passwordSet: trimmed.length > 0,
    passwordLength: trimmed.length,
    rawLength: raw.length,
    hasLeadingOrTrailingWhitespace: raw.length !== trimmed.length,
    kvReachable,
    kvError,
    upstashUrlSet:   !!process.env.UPSTASH_REDIS_REST_URL,
    upstashTokenSet: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    legacyKvUrlSet:   !!process.env.KV_REST_API_URL,
    legacyKvTokenSet: !!process.env.KV_REST_API_TOKEN,
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    nodeEnv: process.env.NODE_ENV || 'unknown',
    note: 'temporary diagnostic endpoint — delete api/debug.js after troubleshooting'
  });
}
