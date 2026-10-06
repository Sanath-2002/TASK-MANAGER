# Taskboard Web (Vercel + Supabase)

This is the no-login, browser-only version of Taskboard. Vercel serves the static frontend. Supabase provides hosted Postgres and automatically creates a private guest identity in the background, so the user never sees a sign-in screen. Supabase Row Level Security makes every guest see and change only their own rows.

The guest identity is saved in this browser. Tasks persist in the database across visits, but they do not sync to another device. If browser storage is cleared, the guest identity is lost and its tasks cannot be recovered. This is the trade-off for having no email, password, or account recovery.

## Run locally

1. Create a Supabase project and keep its Project URL and publishable key handy.
2. In Supabase **Authentication → Sign In / Providers**, enable anonymous sign-ins.
3. Open the Supabase **SQL Editor**, paste `supabase-schema.sql`, and run it. This creates the task table and owner-only policies.
4. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key. A publishable key is designed to appear in browser code; never put a secret or service-role key here.
5. Install dependencies and start Vite:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). No login is needed. Add, edit, complete, and delete a task; search (`/` focuses search), use the sidebar filters, try Undo after deleting, and refresh to confirm the list remains.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repository and set **Root Directory** to `web`.
3. Select Vite. Use build command `npm run build` and output directory `dist` (Vercel usually detects both automatically).
4. In Vercel project settings, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Preview and Production, then redeploy.
5. Add the Vercel deployment URL to the allowed redirect URLs in Supabase Authentication settings if you later add auth redirects. Anonymous sign-in itself does not display or require a login page.
6. Open the Vercel URL and try the task list. You can inspect rows in Supabase Table Editor.

Vercel hosts the frontend; Supabase hosts the Postgres database. Vercel's Marketplace can connect database providers, including Supabase. The Supabase key exposed in the frontend is the publishable key. The SQL policies, not a hidden frontend secret, protect each guest's tasks.

## Security and privacy

- The app calls `signInAnonymously()` in the background; no email or password is requested.
- Row Level Security permits a guest to access only rows with that guest's auth user ID.
- Never expose a Supabase secret/service-role key in a `VITE_` variable or browser bundle.
- Anonymous guests cannot recover their task list after clearing site data or switching devices. Adding optional account linking would make recovery possible later.
- For a public launch, add CAPTCHA/rate controls for anonymous sign-ins and review the Supabase project's quotas.
