# Tasks

A responsive personal workspace for Tasks, Notes, Important Links, and Calendar. It supports multiple private accounts, display names, email/password authentication, and light/dark themes.

## Local setup

Requirements: Node.js, Git, a Supabase project, and a Render account.

```bash
npm install
```

Copy `.env.example` to `.env` and enter the project values from Supabase:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Never put a Supabase `service_role` key in this frontend project.

## Database

For a new Supabase project, run the complete `supabase/schema.sql` file in **SQL Editor**.

For a project that previously used the single-account version, run only `supabase/multi_user_migration.sql` once. The migration keeps all existing data and changes Row Level Security so every signed-in user can access only rows whose `user_id` matches their own account.

## Enable account registration

In Supabase Dashboard:

1. Open **Authentication > Providers > Email**.
2. Enable email sign-ups.
3. Keep **Confirm email** enabled.
4. Under **Authentication > URL Configuration**, set the production Site URL and add both the production URL and `http://localhost:5173` to the allowed redirect URLs.

Anyone who has the website link can request an account. Email confirmation helps ensure that each person owns the address used to register.

New users choose a display name during registration. Existing users can click their account name in the sidebar or the account button in the top bar to set or change it. Display names are stored in Supabase Auth user metadata, so no additional database migration is required.

The first sign-in also opens a responsive getting-started guide. Completion is stored as `onboarding_version` in Supabase Auth user metadata, and users can reopen the guide from the Help button at any time. This feature does not require a database migration.

## Run and verify

```bash
npm run dev
npm run build
```

Test with two different accounts and confirm that a task created by one account is not visible to the other.

## Deploy on Render

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Rewrite rule: `/*` to `/index.html`

The previous `VITE_ALLOWED_EMAIL` variable is no longer used and may be removed from Render and `.env`.

## Rename the repository and Render service

The application name shown in the interface and browser is **Tasks**. The GitHub repository may be renamed to `tasks`. After renaming it, update the local remote URL:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/tasks.git
```

The Render service may also be renamed. If `tasks.onrender.com` is unavailable, use a unique service name such as `tasks-workspace` and then update Supabase's Site URL and redirect URLs to the new address.

## Calendar notifications

Calendar notifications work while the website is open and browser notification permission has been granted. Notifications while the site is closed require a future Web Push and server-side scheduler implementation.
