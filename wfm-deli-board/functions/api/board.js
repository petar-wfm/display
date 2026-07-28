/* ============================================================
   /api/board  —  Cloudflare Pages Function
   ============================================================
   Stores the deli board's menu / promos / settings as one JSON
   record in a Cloudflare KV namespace, so every screen (and the
   admin.html management page) reads and writes the SAME file on
   the server instead of each browser's own local storage.

   Setup (one time, in the Cloudflare dashboard):
   1. Workers & Pages → KV → Create a namespace, e.g. "wfm-deli-board".
   2. Open this Pages project → Settings → Functions → KV namespace
      bindings → Add binding:
        Variable name:  BOARD_KV
        KV namespace:   (the one you just created)
   3. Settings → Environment variables → add a SECRET named
      ADMIN_PASSWORD with whatever password staff should use to
      save changes from admin.html. (GET requests — i.e. the board
      just reading the menu — don't need a password; only saving
      changes does.)
   4. Redeploy. The board will start out empty until someone opens
      admin.html, makes a change, and saves — until then every
      screen just falls back to the built-in menu from data.js.
   ============================================================ */

const KEY = 'board';

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-password',
  };
}
function json(obj, status = 200){
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

export async function onRequestOptions(){
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet({ env }){
  if (!env.BOARD_KV) {
    return json({ error: 'not_configured', message: 'BOARD_KV namespace is not bound to this Pages project yet.' }, 500);
  }
  const raw = await env.BOARD_KV.get(KEY);
  if (!raw) return json({ data: null, updatedAt: null });
  try{
    return json(JSON.parse(raw));
  }catch(e){
    return json({ data: null, updatedAt: null });
  }
}

export async function onRequestPost({ request, env }){
  if (!env.BOARD_KV) {
    return json({ error: 'not_configured', message: 'BOARD_KV namespace is not bound to this Pages project yet.' }, 500);
  }
  if (!env.ADMIN_PASSWORD) {
    return json({ error: 'not_configured', message: 'ADMIN_PASSWORD environment variable is not set for this Pages project.' }, 500);
  }
  const supplied = request.headers.get('x-admin-password') || '';
  if (supplied !== env.ADMIN_PASSWORD) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body;
  try{
    body = await request.json();
  }catch(e){
    return json({ error: 'bad_json' }, 400);
  }
  if (!body || !Array.isArray(body.categories) || !Array.isArray(body.promos) || !body.settings) {
    return json({ error: 'invalid_payload', message: 'Expected an object with categories[], promos[], and settings.' }, 400);
  }

  const record = { data: body, updatedAt: new Date().toISOString() };
  await env.BOARD_KV.put(KEY, JSON.stringify(record));
  return json({ ok: true, updatedAt: record.updatedAt });
}
