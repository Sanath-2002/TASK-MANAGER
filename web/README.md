# Taskboard Web (Vercel + Supabase)

Taskboard is a no-login task manager. Vercel serves the web app; Supabase provides the persistent database and creates a private guest identity in the background. No email, password, or sign-in screen is shown. Row Level Security isolates each browser's tasks, projects, and subtasks.

Features include project lists, quick task creation, notes, due dates, priority, subtasks, completion, search, Today/Upcoming/Overdue/To do/Completed views, task counts, and undo after deletion.

The guest identity is saved in this browser. Tasks persist in the database across visits, but they do not sync to another device. If browser storage is cleared, the guest identity is lost and its tasks cannot be recovered. This is the trade-off for having no email, password, or account recovery.

## Run locally

1. Create a Supabase project and keep its Project URL and publishable key handy.
2. In Supabase **Authentication → Sign In / Providers**, enable anonymous sign-ins.
3. Open the Supabase **SQL Editor**, paste `supabase-schema.sql`, and run it. It creates or upgrades the tables and owner-only policies while preserving existing tasks.
4. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key. A publishable key is designed to appear in browser code; never put a secret or service-role key here.
5. Install dependencies and start Vite:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). Add projects and tasks, open a task to set its due date/priority/notes and manage subtasks, try the sidebar views and search (`/` focuses search), then refresh to confirm changes remain.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repository and set **Root Directory** to `web`. The frontend is hosted by Vercel; the database is a managed service connected to it. You can provision Supabase through the Vercel Marketplace or create the Supabase project separately.
3. Select Vite. Use build command `npm run build` and output directory `dist` (Vercel usually detects both automatically).
4. In Vercel project settings, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Preview and Production, then redeploy.
5. In Supabase Authentication settings, enable anonymous sign-ins. No redirect URL is required for the current no-login flow.
6. Open the Vercel URL and try projects, task details, subtasks, due-date views, and search. You can inspect rows in Supabase Table Editor.

Vercel hosts the frontend and runs the deployment. A persistent database is still required; Vercel Marketplace can connect a database provider such as Supabase without adding a separate app server. The Supabase key exposed in the frontend is the publishable key. SQL policies, not a hidden frontend secret, protect each guest's data.

## Security and privacy

- The app calls `signInAnonymously()` in the background; no email or password is requested.
- Row Level Security permits a guest to access only rows with that guest's auth user ID.
- Never expose a Supabase secret/service-role key in a `VITE_` variable or browser bundle.
- Anonymous guests cannot recover their task list after clearing site data or switching devices. Adding optional account linking would make recovery possible later.
- For a public launch, add CAPTCHA/rate controls for anonymous sign-ins and review the Supabase project's quotas.
