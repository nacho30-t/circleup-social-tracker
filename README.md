# highlife — Social Habit Tracker

A visual social-habit tracker where every meaningful interaction becomes a highlighter stroke.

## Improvements in this version

- Rebranded from CircleUp to **highlife**.
- Four interaction slots per day.
- Organic highlighter-style strokes instead of progress bars.
- Different highlighter colors for Social, New person, Professional and Event.
- Animated left-to-right marker sweep when an interaction is added.
- Small `+1 highlighted` feedback animation.
- Today's day is subtly enlarged and highlighted.
- Cleaner day cards with less border/shadow.
- The center now shows today's progress (`0/4`) and the monthly interaction count.
- Simplified monthly snapshot with three primary metrics and two compact metrics.
- Dynamic daily social challenge.
- English month/date formatting for visual consistency.
- Existing demo data is preserved because the original localStorage keys are retained.

## Files

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

## Update your existing Vercel site

Upload/replace `index.html`, `styles.css`, and `app.js` in your existing GitHub repository and commit the changes. Vercel will redeploy automatically while keeping the same project URL.

## Demo authentication note

The current prototype stores login credentials and interaction data in the browser using `localStorage`. This is suitable for a classroom prototype, not for a real public authentication system. Use a real backend/authentication provider before collecting actual user accounts.
