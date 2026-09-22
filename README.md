# CircleUp — Social Habit Tracker

A responsive front-end prototype for a daily social habit tracker.

## What it does

- Register / log in with email + password.
- Shows the current month in a circular tracker.
- Only the current day can be checked in.
- Lets the user classify a social interaction as:
  - Social
  - Professional
  - New person
  - Event
- Optional short note.
- Shows monthly stats and recent activity.
- Stores the prototype data locally in the browser with `localStorage`.

## Important: demo authentication

This prototype stores the password locally in plain text **only so the project can run without a backend**.
Do not use this mechanism in a real public website.

For a production version, replace the demo authentication with Supabase Auth, Firebase Auth or another secure authentication provider, and store check-ins in a database.

## How to open it

Option 1:
Open `index.html` directly in your browser.

Option 2:
Run a local server from this folder:

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000`

## Files

- `index.html` — page structure
- `styles.css` — visual design and responsive layout
- `app.js` — registration, login, daily check-in, circular tracker and local storage
