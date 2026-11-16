# PocketPulse setup

## Included
- `index.html`: mobile-first single-page application (vanilla HTML/CSS/JS), Chart.js reports, local demo mode, Supabase email/password auth and cloud CRUD.
- `supabase/schema.sql`: tables and per-user Row Level Security policies.
- `supabase/functions/financial-advisor/index.ts`: authenticated Gemini proxy. The Gemini API key stays server-side.

## 1. Run locally
Open `index.html` in a modern browser. With no Supabase credentials it runs in local demo mode; data is stored in that browser's localStorage only. Demo mode is not multi-device sync and has no real authentication.

## 2. Configure Supabase cloud auth and persistence
1. Create a Supabase project.
2. In SQL Editor, run `supabase/schema.sql`.
3. In Authentication → Providers, enable Email. Configure email confirmation and your allowed redirect URLs.
4. Copy the Project URL and anon/public key from Project Settings → API.
5. In `index.html`, replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`.
6. Host the static app over HTTPS (for example, Cloudflare Pages, Netlify, or Vercel). Never use the Supabase `service_role` key in browser code.
7. Sign up, confirm email if required, then log in. RLS restricts rows to the authenticated user's `auth.uid()`.

## 3. Gemini advisor
1. Install the Supabase CLI and link your project.
2. Set the server secret: `supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY`.
3. Deploy: `supabase functions deploy financial-advisor`.
4. The app calls the function with the signed-in user's access token. The function verifies the user before forwarding a compact finance context to Gemini.

## Important production hardening before real-money use
This is a functional starter, not a completed audited financial product. Before launch:
- Replace client-side wallet balance updates with a Postgres transaction/RPC or trigger that atomically records the transaction and updates the wallet. Add idempotency keys and prevent duplicate submissions.
- Add edit flows, pagination, export/backup, account deletion, password reset, rate limiting, audit logging and monitoring.
- Validate all inputs server-side; configure restrictive CORS to your production domain; add CSP/security headers and dependency pinning.
- The displayed USD/LKR rate is a manually maintained planning rate defaulting to 328.50. It is **not** a live bank board rate. Update it from a trusted source and show its timestamp before relying on it.
- Fixed expenses total Rs 62,000/month and are shown as a baseline in reports. They are not automatically debited; enter actual expense transactions to reflect cash flow.
- The daily target amount is recalculated from remaining target amount and calendar days remaining. If the deadline has passed, the remaining amount is shown as due immediately.
- The starter's client UI is intentionally compact; have the database and app security reviewed before storing sensitive financial records.

## Data model
All personal tables include `user_id` and have RLS enabled. Do not disable RLS. Wallets/transactions/targets are separate so they can be queried per account. The default wallet examples can be created manually using Add wallet.
