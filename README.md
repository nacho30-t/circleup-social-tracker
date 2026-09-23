# Highlife v4 — real database version

This version removes the fake/simulated friend data.

## What changed

- Real Supabase email/password authentication.
- Optional Google sign-in.
- Improved login / registration screen.
- Real profiles stored in PostgreSQL.
- Real interactions stored in PostgreSQL instead of only in the browser.
- Friend requests by exact email.
- A friend is added only if that email belongs to an existing Highlife account.
- The other user must accept the request.
- Friend circles use the accepted friend's real Highlife interactions.
- Notes are NOT exposed when you view a friend's circle.
- The Iceberg is built only from real accepted friendship edges.
- Second-degree identities respect a privacy setting:
  - discoverable ON → display name can appear;
  - discoverable OFF → the connection is counted but shown as "Private connection".
- Previous local tracker interactions are imported once when possible.
- Old fake friends are intentionally NOT migrated.

## 1. Create a Supabase project

Create a project at Supabase.

In your project dashboard, open the SQL Editor, create a new query, paste the full contents of:

`supabase_schema.sql`

and run it once.

## 2. Configure the website

Open:

`config.js`

Replace:

`YOUR_SUPABASE_URL`

with your Project URL.

Replace:

`YOUR_SUPABASE_PUBLISHABLE_KEY`

with your Supabase publishable/anon key.

The browser key is intended for client-side use when Row Level Security is configured. NEVER use the `service_role` key in the website.

## 3. Authentication settings

In Supabase Authentication:

- Keep Email authentication enabled.
- If you want users to confirm their email, leave Email Confirmations enabled.
- Add your Vercel production URL as a Site URL / allowed redirect URL.
- Add your local development URL if you test locally.

### Optional Google sign-in

To make "Continue with Google" work, enable the Google provider in Supabase Authentication and configure the Google OAuth credentials requested by Supabase.

If you do not configure Google, email + password still works.

## 4. Update the existing Vercel site

Replace these files in the existing GitHub repository:

- `index.html`
- `styles.css`
- `app.js`

Add:

- `config.js`

`supabase_schema.sql` does not need to be served by the website; keep it in the repo if useful for the project documentation.

Commit the changes. Your current Vercel domain will remain the same.

## How friend requests work now

1. User A creates a Highlife account.
2. User B creates a separate Highlife account.
3. User A enters User B's exact account email in Friends.
4. Highlife checks the real database.
5. If no account exists, Highlife says so and does not create anything.
6. If the account exists, a pending request is stored.
7. User B logs in and sees the request.
8. User B accepts.
9. Only then can each user see the other's circle.
10. The Iceberg uses accepted friendship rows — it does not invent connections.

## Privacy

The database uses Supabase Row Level Security (RLS).

- Users can directly read and write only their own interactions.
- A friend's circle is exposed through a controlled database function that returns only date + category, not private notes.
- Second-degree connections are anonymous unless that user opted into discovery.
- The frontend never contains a Supabase `service_role` key.

## Important

Run `supabase_schema.sql` before publishing this version. Until `config.js` is filled in, the login screen will clearly show that the database is not connected.
