const origins = new Set(['https://alex20030220-gif.github.io', 'http://127.0.0.1:9020', 'http://localhost:9020']);
const projectUrl = Deno.env.get('SUPABASE_URL') ?? '';
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const serverKey = secretKeys.default ?? Object.values(secretKeys)[0] ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const encoder = new TextEncoder();

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://alex20030220-gif.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '3600', 'X-Content-Type-Options': 'nosniff'
  };
  const reply = (status: number, data: unknown, extra = {}) => new Response(JSON.stringify(data), {status, headers: {...headers, ...extra}});
  if (origin && !origins.has(origin)) return reply(403, {error: 'This website is not allowed to submit this form.'});
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (req.method !== 'POST') return reply(405, {error: 'Please submit the contact form.'}, {Allow: 'POST, OPTIONS'});
  if (!req.headers.get('content-type')?.includes('application/json')) return reply(415, {error: 'Please use the contact form on the website.'});
  if (Number(req.headers.get('content-length') ?? 0) > 32768) return reply(413, {error: 'Please keep your message within 5,000 characters.'});
  try {
    const raw = await req.text();
    if (encoder.encode(raw).length > 32768) return reply(413, {error: 'Please keep your message within 5,000 characters.'});
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, {error: 'The form could not be read. Please try again.'}); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, {error: 'Please complete the contact form.'});
    if (typeof body.website === 'string' && body.website.trim()) return reply(200, {ok: true});
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const message = typeof body.request === 'string' ? body.request.trim() : '';
    const errors: Record<string, string> = {};
    if (name.length < 2 || name.length > 120) errors.name = 'Please enter your name (2–120 characters).';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address.';
    if (phone && (phone.length < 7 || phone.length > 40 || !/^[+()\d\s.\-xext]+$/i.test(phone) || (phone.match(/\d/g) ?? []).length < 5)) errors.phone = 'Please include a valid phone number and country code, or leave this blank.';
    if (message.length < 20 || message.length > 5000) errors.request = 'Please tell me a little more (20–5,000 characters).';
    if (body.consent !== true) errors.consent = 'Please agree to the use of your details so I can respond.';
    if (Object.keys(errors).length) return reply(422, {error: 'Please check the highlighted fields.', errors});
    if (typeof body.submission_id !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(body.submission_id)) return reply(400, {error: 'Please refresh the page and try again.'});
    if (!projectUrl || !serverKey) return reply(503, {error: 'The form is temporarily unavailable. Please email yung-hsin.lee@ehl.ch.'});
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${serverKey}:${new Date().toISOString().slice(0, 10)}:${ip}`));
    const clientHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const saved = await fetch(`${projectUrl}/rest/v1/rpc/submit_portfolio_contact`, {
      method: 'POST', headers: {'Content-Type': 'application/json', apikey: serverKey, ...(serverKey.startsWith('sb_secret_') ? {} : {Authorization: `Bearer ${serverKey}`})},
      body: JSON.stringify({p_submission_id: body.submission_id, p_name: name, p_email: email, p_phone: phone, p_request: message, p_client_hash: clientHash}),
      signal: AbortSignal.timeout(12000)
    });
    if (!saved.ok) {
      const failure = await saved.json().catch(() => ({}));
      if (failure.message === 'rate_limited') return reply(429, {error: 'A few messages have already been sent. Please try again in 15 minutes, or email me directly.'}, {'Retry-After': '900'});
      console.error('Contact storage failed', saved.status, failure.code ?? 'unknown');
      return reply(503, {error: 'Your message could not be saved. Please try again, or email yung-hsin.lee@ehl.ch.'});
    }
    return reply(200, {ok: true, reference: body.submission_id});
  } catch {
    console.error('Contact request failed');
    return reply(503, {error: 'The connection was interrupted. Please try again, or email yung-hsin.lee@ehl.ch.'});
  }
});
