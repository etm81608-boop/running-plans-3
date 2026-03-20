# Team Running Plans

A web app for coaches to create, store, and distribute running plans to their cross country and track teams. Built with React + Firebase, deployed free via GitHub Pages.

---

## Features

- **Roster management** — store runner profiles with grade, event, contact info, years running, and personal records
- **Training groups** — organize runners (Varsity, JV, Distance, Sprints, etc.) for easy bulk assignment
- **Workout library** — build a library of reusable workouts with warm-up, main set, cool-down, target pace, and notes
- **Master calendar** — color-coded month and list view of all scheduled workouts
- **Assign workouts** — assign to all runners, a group, or individuals on a specific date
- **Share links** — every assignment gets a public URL runners can open on any device (no login required)
- **Email delivery** — send workout links directly to runners via email

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- A [GitHub account](https://github.com/) with a repository for this project
- A free [Firebase](https://firebase.google.com/) account
- A free [EmailJS](https://www.emailjs.com/) account (only needed if you want email delivery)

---

## Setup

### 1. Clone / upload to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 2. Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com/) and create a new project.
2. In your project, click **Build > Firestore Database** and create a database (start in **production mode**).
3. Click **Build > Authentication**, enable the **Email/Password** sign-in provider.
4. Create your coach account: in Authentication > Users, click **Add User** and enter your email + password.
5. Go to **Project Settings > Your Apps**, click the `</>` web icon, register an app, and copy the config values.

**Apply Firestore security rules:**
In the Firebase console, go to Firestore > Rules, paste the contents of `firestore.rules`, and click **Publish**.

**Required Firestore indexes:**
The app uses a compound query on the `assignments` collection. You may be prompted in the browser console to create an index — just click the link that appears and Firebase will create it automatically.

### 3. Set up EmailJS (optional, for email delivery)

1. Sign up at [emailjs.com](https://www.emailjs.com/) (free tier: 200 emails/month).
2. Connect a service (e.g. Gmail): **Email Services > Add New Service**.
3. Create a template: **Email Templates > Create New Template**. Use these variables in your template:

   | Variable | Meaning |
   |---|---|
   | `{{runner_name}}` | Athlete's name |
   | `{{workout_date}}` | Date of the workout |
   | `{{workout_title}}` | Workout name |
   | `{{workout_type}}` | Workout type |
   | `{{workout_details}}` | Overview/description |
   | `{{workout_notes}}` | Coach's notes |
   | `{{workout_link}}` | Shareable URL |
   | `{{coach_name}}` | Your name |

   **Suggested template body:**
   ```
   Hi {{runner_name}},

   Here's your workout for {{workout_date}}:

   {{workout_title}} ({{workout_type}})

   {{workout_details}}

   {{workout_notes}}

   View your full workout here:
   {{workout_link}}

   — {{coach_name}}
   ```

4. Copy your **Service ID**, **Template ID**, and **Public Key** from the EmailJS dashboard.

### 4. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...

VITE_COACH_NAME=Coach Eric
VITE_APP_URL=https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME
```

> **Never commit your `.env` file.** It is listed in `.gitignore`.

### 5. Update the repo name in vite.config.js

Open `vite.config.js` and change `'/running-plans/'` to `'/YOUR_REPO_NAME/'`:

```js
export default defineConfig({
  base: '/your-actual-repo-name/',
  ...
})
```

Also update `index.html` — change the favicon path to match:
```html
<link rel="icon" href="/your-actual-repo-name/favicon.svg" />
```

---

## Development

```bash
npm install
npm run dev
```

The app will open at `http://localhost:5173`.

---

## Deploying to GitHub Pages

```bash
npm run deploy
```

This builds the app and pushes it to the `gh-pages` branch. Then:

1. In your GitHub repo, go to **Settings > Pages**.
2. Set **Source** to `gh-pages` branch, `/ (root)` folder.
3. Your app will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

> You need to add your GitHub token or SSH key for `gh-pages` to push. If prompted, use your GitHub credentials.

**For environment variables on GitHub Pages:** Since `.env` is not committed, you need to either:
- Use [GitHub Secrets + Actions](https://docs.github.com/en/actions/security-guides/encrypted-secrets) to build and deploy via CI/CD (recommended for production), or
- Build locally and deploy with `npm run deploy` (simpler, works fine for personal use).

---

## App Structure

```
src/
├── contexts/AuthContext.jsx    # Firebase auth (login/logout)
├── firebase/config.js          # Firebase initialization
├── hooks/useCollection.js      # Firestore real-time data hook
├── utils/
│   ├── constants.js            # Events, workout types, colors
│   └── emailService.js         # EmailJS integration
├── components/
│   ├── Layout.jsx              # Page shell
│   ├── Sidebar.jsx             # Navigation
│   ├── Modal.jsx               # Reusable modal dialog
│   └── Toast.jsx               # Notification toasts
└── pages/
    ├── Login.jsx               # Coach sign-in
    ├── Dashboard.jsx           # Overview & upcoming workouts
    ├── Roster.jsx              # Runner management
    ├── Groups.jsx              # Training groups
    ├── Workouts.jsx            # Workout library (create/edit/delete)
    ├── AssignWorkout.jsx       # Assign workouts to runners
    ├── CalendarPage.jsx        # Master calendar (FullCalendar)
    └── PublicWorkout.jsx       # Public workout view (no login needed)
```

---

## Customization

- **Team colors:** Edit `tailwind.config.js` — change the `brand` color values to your school colors.
- **Events list:** Edit `src/utils/constants.js` — add or remove events from the `EVENTS` array.
- **Workout types:** Edit `WORKOUT_TYPES` in `constants.js`.
- **Coach name:** Set `VITE_COACH_NAME` in your `.env`.
