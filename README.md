# CircleUp — Social Habit Tracker

A responsive front-end prototype for tracking multiple social interactions per day.

## Current prototype features

- Register / log in with email + password.
- Circular current-month tracker.
- **Four interaction slots per day** instead of one daily checkbox.
- Each new interaction fills one slot with an **animated highlighter swipe**.
- Interaction categories:
  - Social
  - Professional
  - New person
  - Event
- Optional short note for each interaction.
- Monthly totals, social-day count, streak and recent interactions.
- Existing data from the first version is kept compatible: an older one-interaction day becomes the first slot for that day.
- Data is stored locally in the browser with `localStorage`.

## Change the number of daily slots

Open `app.js` and change:

```js
const MAX_INTERACTIONS_PER_DAY = 4;
```

For example, use `5` for five interaction slots per day.

## Important: demo authentication

This prototype stores passwords locally in plain text **only so the project can run without a backend**.
Do not use this mechanism for a real public site.

For the real project, connect authentication and data storage to Supabase, Firebase or another secure backend.

## Updating the live Vercel website

If this project is connected to GitHub and Vercel:

1. Replace `index.html`, `styles.css`, `app.js` and `README.md` in the same GitHub repository.
2. Commit the changes to the branch connected to Vercel.
3. Vercel will automatically redeploy the same project.
4. Your existing `.vercel.app` domain stays the same.
