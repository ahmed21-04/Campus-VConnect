# Campus Connect

A full college/school education platform: real login (with hashed passwords + sessions), a persistent database, 7 departments × 8 semesters of structured content, notes, previous year question papers, YouTube class links, an academic calendar, attendance, academic + cultural performance tracking, teacher remarks, college guidelines, and a build-your-own avatar.

## Run it

You need [Node.js](https://nodejs.org) installed (v18+).

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

The first time it runs, it creates `data/db.json` — a self-contained database file seeded with departments, semesters, subjects, and three demo accounts. Delete that file any time to reset everything back to the seed data.

## Demo logins

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Admin   | admin@campus.edu    | admin123    |
| Teacher | teacher@campus.edu  | teacher123  |
| Student | student@campus.edu  | student123  |

You can also register new student/teacher accounts from the login page.

## What's included

- **Auth** — real signup/login with bcrypt-hashed passwords and server-side sessions.
- **Welcome dashboard** — greeting, quick links, and a build-your-own SVG avatar (background, skin tone, hair, accessory).
- **7 departments** (Civil, Mechanical, ECE, EEE, Aeronautical, CSE, AI/ML) × **8 semesters** each. Semesters 1–3 come pre-loaded with realistic subjects; semesters 4–8 are ready for a teacher/admin to fill in from the subject page's "Manage" tab.
- **Per-subject page** — notes (title + link), previous year question papers (year + link), and a class link that opens straight to YouTube.
- **Academic calendar** — month view, staff can add events.
- **Attendance** — teachers mark present/absent per subject/date; students see their own records and overall percentage.
- **Academic performance** — teachers record exam marks per subject; students see their history.
- **Cultural performance** — teachers/admins log student achievements (competitions, events, etc.).
- **Teacher remarks** — free-text notes from faculty, visible to the student.
- **Guidelines / college info** — admin-editable policy and curriculum info page.
- **Role-based permissions** — students can only view their own records; only teachers/admins can add notes, PYQs, mark attendance, enter grades, etc.

## Project structure

```
server.js          Express app entry point
db.js              File-based database + seed data (departments/semesters/subjects/users)
middleware/auth.js Login + role guard middleware
routes/auth.js      Register / login / logout / avatar
routes/academics.js Departments, semesters, subjects, notes, PYQs, class links
routes/records.js   Attendance, performance, culturals, remarks, calendar, guidelines
public/             All frontend pages (plain HTML/CSS/JS, no build step)
data/db.json        Created on first run — your persistent data
```

## Natural next steps (not yet built)

- Real file uploads for notes/PYQs (currently they're links you paste in — e.g. a Google Drive share link).
- A visual timetable/scheduling view.
- Email notifications for new calendar events or remarks.
- Charts for attendance/performance trends over time.
- Password reset flow.
- Deploying it live (e.g. Render, Railway, or a college server) instead of running locally — happy to help with that whenever you're ready.
