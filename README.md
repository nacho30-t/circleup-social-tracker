# Highlife — Social Circle + Network Iceberg

This version expands Highlife from a personal habit tracker into a social-network prototype.

## New in this version

- Persistent left sidebar with the **Highlife** brand.
- **My Circle**: current monthly circular tracker with 4 interaction slots per day.
- **Friends**: add people by Gmail/email and open their circle.
- **Iceberg**: visual network showing:
  - You
  - Direct friends
  - Friends-of-friends / second-degree connections
  - An iceberg that becomes larger as the visible network grows
- **History**: browse months and years.
- **How it works**: didactic explanation of the product concept.
- Automatic date rollover: when the day/month/year changes, the current tracker updates automatically.
- Previous Highlife interaction data remains available because the existing localStorage keys are preserved.

## Important prototype limitation

This is still a static browser prototype.

- Your own interactions are stored in `localStorage`.
- Friends added by email are stored in `localStorage`.
- Friend activity and friends-of-friends are **simulated deterministically from the email address** so the social product can be demonstrated without a backend.
- It does **not** read Gmail contacts or another person's real Highlife account.

For real multi-user behaviour, the next production step is a backend such as Supabase:
1. Supabase Auth for real accounts.
2. `friendships` table with invite / accepted state.
3. Row-level security so people only see circles they are allowed to see.
4. `interactions` table for persistent history across devices.
5. Optional Google OAuth / Google People API if you want to import Gmail contacts with explicit user permission.

## Deploying over your existing Vercel domain

Replace the files in the existing GitHub repository with:

- `index.html`
- `styles.css`
- `app.js`

Commit the changes. Vercel will redeploy the same project and keep the existing domain.
