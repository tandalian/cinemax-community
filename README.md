# Cinemax Community

A responsive React and Supabase movie community platform with public pages, member dashboards, admin pages, chat, invitations, notifications, and secure media integration.

## Run locally

```bash
npm install
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Run `supabase/migrations/202611190001_initial_schema.sql`, then
   `supabase/migrations/202611240001_community_features.sql` in the Supabase SQL editor
   (or apply both with the Supabase CLI).
5. Enable Email authentication in Supabase.
6. Configure storage CORS and file constraints for the created buckets.

The community migration adds member invitations, direct conversations, online-presence
reads, and per-member message likes. Invitation links are single-use and attach the
new account to the inviter; direct chat and likes are restricted by database policies
to authenticated conversation members. Presence is refreshed while a member is
signed in and is displayed as offline if its heartbeat is older than 90 seconds.

The app works in demo mode without Supabase. Persistent accounts and data require the environment variables above.

## Database

The migration creates profiles, roles, invitations, movies, categories, downloads, conversations, messages, notifications, announcements, activity, reports, presence, favorites, indexes, triggers, storage buckets, and RLS policies.

## Security

- Use only the Supabase anonymous/publishable key in frontend code.
- Keep service-role keys on a secure server.
- Store private movie and chat files in private buckets.
- Authorize movie downloads on the server before issuing signed URLs.
- Validate MIME types and maximum file sizes.
- Enforce invitation limits in server-side functions or Edge Functions.
- Never allow a normal user to assign the admin role.
- Only distribute movies that the platform administrator has the legal right to distribute.

## Production

Run `npm run build` and deploy the `dist` directory to a static host with an SPA rewrite to `index.html`. Configure the production domain in Supabase redirect URLs.
