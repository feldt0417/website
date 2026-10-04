// Supabase Edge Function: create-checkout
// Called by the panel when a logged-in customer clicks Pay. Creates an order and a
// NOWPayments invoice, and returns the hosted payment page URL.
// Secrets needed: NOWPAYMENTS_API_KEY. Optional: PANEL_URL.

import { createClient } from "npm:@supabase/supabase-js@2";

const NP_API = (Deno.env.get("NOWPAYMENTS_API_URL") ?? "https://api.nowpayments.io/v1").replace(/\/$/, "");
const PANEL_URL = Deno.env.get("PANEL_URL") ?? "https://feldt0417.github.io/website/panel.html";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Same values supabase-js 2.117 publishes in its /cors export; the browser blocks the
// call if any header the client sends is missing here.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Works with both the legacy service_role key and the newer sb_secret_ keys.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
  if (!apiKey) return json({ error: "Checkout isn't set up yet." }, 500);

  const admin = createClient(SUPABASE_URL, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // JWT verification is off for this function (Supabase's advice with the new keys),
  // so the caller is checked here: getUser asks Supabase Auth to validate the token.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.startsWith("sb_")) return json({ error: "Log in first." }, 401);
  let user: { id: string; is_anonymous?: boolean } | null = null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (!error) user = data?.user ?? null;
  } catch { /* malformed token */ }
  if (!user || user.is_anonymous) return json({ error: "Your session expired. Log in again." }, 401);

  let plan = "";
  try {
    plan = String((await req.json())?.plan ?? "");
  } catch { /* empty body */ }

  // Prices, the hourly limit and the lifetime check all live in the database.
  const { data: order, error: orderError } = await admin.rpc("create_order", { p_user: user.id, p_plan: plan });
  if (orderError || !order?.id) {
    const reason = orderError?.message ?? "";
    if (reason.includes("unknown_plan")) return json({ error: "That plan doesn't exist." }, 400);
    if (reason.includes("lifetime_owned")) return json({ error: "You already have lifetime access." }, 409);
    if (reason.includes("rate_limited")) return json({ error: "Too many checkouts in the last hour. Try again later." }, 429);
    return json({ error: "Couldn't start the checkout. Try again." }, 500);
  }

  let invoice: { id?: unknown; invoice_url?: unknown; code?: unknown; message?: unknown } | null = null;
  let status = 0;
  try {
    const res = await fetch(`${NP_API}/invoice`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        price_amount: Number(order.price_usd),
        price_currency: "usd",
        order_id: order.id,
        order_description: `REVENANT ${order.name}`,
        ipn_callback_url: `${SUPABASE_URL}/functions/v1/nowpayments-ipn`,
        success_url: `${PANEL_URL}?paid=${order.id}`,
        cancel_url: `${PANEL_URL}?cancelled=1`,
      }),
    });
    status = res.status;
    invoice = await res.json().catch(() => null);
    if (!res.ok) throw new Error("invoice request failed");
  } catch {
    await admin
      .from("orders")
      .update({ status: "failed", note: `invoice error ${status} ${String(invoice?.code ?? invoice?.message ?? "")}`.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return json({ error: "The payment service didn't respond. Try again in a minute." }, 502);
  }

  const url = String(invoice?.invoice_url ?? "");
  let trusted = false;
  try {
    const host = new URL(url).hostname;
    trusted = host === "nowpayments.io" || host.endsWith(".nowpayments.io");
  } catch { /* not a URL */ }
  if (!trusted) {
    await admin.from("orders").update({ status: "failed", note: "invoice had no payment URL" }).eq("id", order.id);
    return json({ error: "The payment service returned an unexpected answer. Try again." }, 502);
  }

  await admin
    .from("orders")
    .update({ invoice_id: String(invoice?.id ?? ""), updated_at: new Date().toISOString() })
    .eq("id", order.id);

  return json({ url, order_id: order.id });
});
