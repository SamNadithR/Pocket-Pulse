import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Vary": "Origin",
};
const hits = new Map<string, number[]>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const now = Date.now();
    const recent = (hits.get(user.id) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= 8) return json({ error: "Too many requests. Wait a minute." }, 429);
    hits.set(user.id, [...recent, now]);

    const { question } = await req.json();
    if (typeof question !== "string" || !question.trim() || question.length > 500)
      return json({ error: "Question must be 1-500 characters" }, 400);

    // Context is read server-side with the user's own JWT, so RLS applies.
    const [w, t, g, s] = await Promise.all([
      sb.from("wallets").select("name,currency,balance"),
      sb.from("transactions").select("type,amount,category,occurred_at").order("occurred_at", { ascending: false }).limit(60),
      sb.from("targets").select("name,goal_amount,saved_amount,deadline"),
      sb.from("user_settings").select("usd_lkr_rate").maybeSingle(),
    ]);
    const context = { wallets: w.data, recent_transactions: t.data, targets: g.data,
      usd_lkr_planning_rate: s.data?.usd_lkr_rate ?? 328.5,
      fixed_monthly_baseline_lkr: { rent: 9000, food_transport: 30000, mobile: 3000, loan: 20000, total: 62000 } };

    const prompt = `You are PocketPulse Advisor, a friendly money helper for young people and delivery riders in Sri Lanka. Use only the data below; never invent records. If data is missing, say so. Give short, practical answers with the calculation shown. You are not a licensed financial advisor.\n\nDATA:\n${JSON.stringify(context)}\n\nQUESTION: ${question}`;
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      { method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!r.ok) return json({ error: "AI service unavailable" }, 502);
    const out = await r.json();
    return json({ answer: out.candidates?.[0]?.content?.parts?.[0]?.text ?? "No answer returned." });
  } catch (_e) {
    return json({ error: "Server error" }, 500);
  }
});
