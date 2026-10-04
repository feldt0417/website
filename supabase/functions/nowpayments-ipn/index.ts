// Supabase Edge Function: nowpayments-ipn
// NOWPayments calls this on every payment status change. It checks the signature,
// re-reads the payment from NOWPayments, and on "finished" activates the plan and
// creates the license key (once per order, however often it is called).
// Secrets needed: NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET.
// JWT verification must be OFF for this function: NOWPayments can't log in.

import { createClient } from "npm:@supabase/supabase-js@2";

const NP_API = (Deno.env.get("NOWPAYMENTS_API_URL") ?? "https://api.nowpayments.io/v1").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRACKED = new Set(["waiting", "confirming", "confirmed", "sending", "partially_paid", "failed", "refunded", "expired"]);

const reply = (status: number, text = "ok") => new Response(text, { status, headers: { "Content-Type": "text/plain" } });

function serviceKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      const key = parsed.default ?? Object.values(parsed)[0];
      if (key) return key;
    } catch { /* fall through to the legacy key */ }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("No service key available to the function");
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

// Official SDK canonical form: keys sorted at every depth, arrays kept as arrays.
function sortDeep(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v !== null && typeof v === "object") {
    const out: { [k: string]: Json } = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}

// Docs sample canonical form: same, but arrays become {"0":..,"1":..}.
// deno-lint-ignore no-explicit-any
function sortDocs(v: any): any {
  return Object.keys(v).sort().reduce((r: Record<string, unknown>, k) => {
    r[k] = v[k] && typeof v[k] === "object" ? sortDocs(v[k]) : v[k];
    return r;
  }, {});
}

const enc = new TextEncoder();
async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret.trim()), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Every accepted form needs the IPN secret, so accepting any of them is safe.
async function signatureValid(raw: string, body: Json, sig: string, secret: string): Promise<boolean> {
  const given = sig.trim().toLowerCase();
  if (!/^[0-9a-f]{128}$/.test(given)) return false;
  const candidates = [JSON.stringify(sortDeep(body)), JSON.stringify(sortDocs(body)), raw];
  let ok = false;
  for (const c of candidates) ok = sameHex(await hmacHex(secret, c), given) || ok;
  return ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, "method not allowed");

  const apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
  const ipnSecret = Deno.env.get("NOWPAYMENTS_IPN_SECRET");
  if (!apiKey || !ipnSecret) return reply(500, "not configured");

  const raw = await req.text();
  let body: Json;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, "bad json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, "bad body");

  if (!(await signatureValid(raw, body, req.headers.get("x-nowpayments-sig") ?? "", ipnSecret))) {
    return reply(401, "invalid signature");
  }

  const admin = createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

  const orderId = String(body.order_id ?? "");
  const paymentId = String(body.payment_id ?? "");
  const order = UUID.test(orderId)
    ? (await admin.from("orders").select("id, status, price_usd, invoice_id").eq("id", orderId).maybeSingle()).data
    : null;

  await admin.from("payment_events").insert({
    order_id: order?.id ?? null,
    payment_id: paymentId || null,
    status: String(body.payment_status ?? ""),
    payload: body,
  });

  if (!order) return reply(200, "unknown order");
  if (order.status === "paid") return reply(200, "already paid");
  if (!/^\d+$/.test(paymentId)) return reply(200, "no payment id");

  // Don't trust the notification's contents: ask NOWPayments directly.
  let pay: Record<string, unknown>;
  try {
    const res = await fetch(`${NP_API}/payment/${paymentId}`, { headers: { "x-api-key": apiKey, Accept: "application/json" } });
    if (!res.ok) return reply(502, "payment lookup failed"); // non-2xx makes NOWPayments retry later
    pay = await res.json();
  } catch {
    return reply(502, "payment lookup failed");
  }

  const status = String(pay.payment_status ?? "");
  const markReview = async (note: string) => {
    await admin
      .from("orders")
      .update({ status: "review", payment_id: paymentId, note, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .neq("status", "paid");
    return reply(200, "needs review");
  };

  if (String(pay.order_id ?? "") !== order.id) return markReview("payment belongs to a different order");
  if (order.invoice_id && pay.invoice_id != null && String(pay.invoice_id) !== order.invoice_id) {
    return markReview("payment came from a different invoice");
  }
  if (pay.parent_payment_id != null && pay.parent_payment_id !== "" && pay.parent_payment_id !== 0) {
    return markReview(`repeat deposit linked to payment ${String(pay.parent_payment_id)}`);
  }
  if (String(pay.price_currency ?? "").toLowerCase() !== "usd" || Number(pay.price_amount) + 0.005 < Number(order.price_usd)) {
    return markReview(`price mismatch: ${String(pay.price_amount)} ${String(pay.price_currency)}`);
  }

  if (status === "finished") {
    const { error } = await admin.rpc("fulfill_order", { p_order: order.id, p_payment_id: paymentId });
    if (error) return reply(500, "fulfilment failed"); // retried by NOWPayments
    return reply(200, "fulfilled");
  }

  if (TRACKED.has(status)) {
    await admin
      .from("orders")
      .update({ status, payment_id: paymentId, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .neq("status", "paid");
  }
  return reply(200, "recorded");
});
