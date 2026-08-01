<div align="center">

# 🏡 Roovia

**A full-stack property booking platform** (inspired by Airbnb) — guests browse and book stays, hosts manage listings and payouts, admins moderate the platform.

Built to demonstrate real backend engineering, not just CRUD: payment integration, concurrency-safe bookings, session security, load testing, and honest documentation of what's built vs. what's aspirational.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Tests](https://img.shields.io/badge/tests-20%2F20%20passing-brightgreen)
![E2E](https://img.shields.io/badge/E2E-5%2F5%20passing-brightgreen)
![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

</div>

> **Status:** Actively developed, single-environment deployment on purpose — see [Known Limitations](#-known-limitations--honest-notes) for why, and what a production setup would look like.

---

## ⚡ At a Glance

| | |
|---|---|
| 🧪 **Unit & Integration Tests** | 20/20 passing (Jest + Supertest + `mongodb-memory-server`) |
| 🎭 **End-to-End Tests** | 5/5 passing (Playwright) |
| 🔁 **CI** | GitHub Actions, runs on every push to `main` |
| 📈 **Load Tested** | k6, ramped to 150 concurrent users — 0% failure rate |
| 🔒 **Concurrency-safe bookings** | Unique DB constraint + reconciliation logic — no double-booking races |
| 💳 **Real payments** | Razorpay integration with signature verification & webhooks |

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Project Structure](#-project-structure--maintenance-scripts)
- [Known Limitations / Honest Notes](#-known-limitations--honest-notes)
- [License](#-license)

---

## ✨ Features

### 🧳 Guests
- Search and browse listings with photo galleries (Cloudinary-hosted)
- Book stays with real payment processing via **Razorpay** (order creation, signature verification, webhook handling)
- Automatic seasonal/date-range pricing shown at checkout
- Cancellations with policy-based refund calculation (flexible / moderate / strict tiers)
- Reviews, favorites, in-app notifications, newsletter subscription
- Google OAuth login alongside standard email/password signup
- Email/OTP-based two-factor authentication on login

### 🏠 Hosts
- List and manage properties (multi-photo upload, amenities, house rules)
- Seasonal pricing rules (date-range price overrides)
- **Smart pricing suggestions** — a rule-based (not ML) day-of-week + local-demand pricing model built on this host's own booking history and comparable listings in the same city. Suggestions are reviewed and applied manually — nothing is auto-priced.
- Block/unblock dates, iCal import/export (sync with Airbnb/Booking.com)
- Dashboard analytics (occupancy, revenue, booking trends)
- Payout tracking with downloadable PDF statements

### 🛡️ Admins
- User management, **ban/unban** (enforced on the *next request* of an already-active session, not just at login)
- Listing & review moderation, booking oversight
- Payout processing, full audit log, commission configuration
- Support ticket / issue tracking system

### ⚙️ Platform-Level
- CSRF protection, security headers (Helmet), rate limiting on auth/OTP endpoints
- MongoDB-backed session store — safe for multi-instance/serverless deployment
- Address geocoding + Indian pincode verification on listing creation

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express 5 |
| Database | MongoDB (Atlas) via Mongoose |
| Views | EJS (server-rendered) |
| Auth | Passport.js (Google OAuth 2.0) + session-based email/password + OTP 2FA |
| Sessions | `express-session` + `connect-mongodb-session` |
| Payments | Razorpay (orders, signature verification, webhooks) |
| Image hosting | Cloudinary (uploads held in memory via Multer, never touch local disk) |
| PDF generation | PDFKit (payout statements) |
| Calendar sync | `ical-generator` / `node-ical` |
| Email | Nodemailer |
| Security | Helmet, CSURF, express-rate-limit, bcryptjs |
| Testing | Jest, Supertest, `mongodb-memory-server`, Playwright, k6 |

---

## 🏗️ Architecture

Classic server-rendered MVC, no SPA framework on the frontend:

```
routes/        → maps HTTP verbs+paths to controller functions
controllers/   → request handling, business logic orchestration
models/        → Mongoose schemas (User, Home, Booking, Review, Issue, Notification, ...)
utils/         → pricing, smart pricing, payouts, geocoding, cancellation policy, audit logging
middlewares/   → upload handling (Multer/memory storage), rate limiters
views/         → EJS templates, organized by feature area (auth, host, admin, store...)
public/        → static assets, per-page CSS
scripts/       → one-off/maintenance scripts run via `node scripts/<name>.js`
```

> Guests and hosts share one `User` model with a `role` field — no separate database or schema per role. Admin access is a separate, more privileged flow with its own login and audit trail.

---

## 🚀 Getting Started

**Prerequisites:** Node.js 18+, a MongoDB Atlas cluster (free M0 tier is sufficient), a Razorpay account (test mode for dev), a Cloudinary account, and a Google Cloud OAuth client for Google sign-in.

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/roovia.git
cd roovia

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# then fill in .env — see table below

# 4. (Optional) create your first admin user
node scripts/createAdmin.js

# 5. Run the app
npm start
```

Runs on `http://localhost:3000` by default (or whatever `PORT` you set). `npm start` runs `nodemon app.js` — auto-restarts on file changes.

---

## 🔑 Environment Variables

None of these are committed — `.env` is gitignored. Copy `.env.example` and fill in your own values.

<details>
<summary><strong>Click to expand full variable reference</strong></summary>

| Variable | Purpose |
|---|---|
| `PORT` | Port the server listens on |
| `MONGODB_URI` | Full Atlas connection string — **must include the database name in the path** (e.g. `.../roovia?...`), or the driver silently falls back to a database called `test` |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `NODE_ENV` | `development` or `production` — gates secure-cookie behavior |
| `EMAIL_USER` / `EMAIL_PASSWORD` | SMTP credentials for Nodemailer (booking confirmations, OTPs, notifications) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth app credentials |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay API credentials — use **test mode** keys for local dev |
| `APP_URL` | Base URL of the deployed app (absolute links in emails, OAuth callback, etc.) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary credentials for photo uploads |

</details>

---

## 🧪 Testing & Quality Assurance

Testing here targets where correctness actually matters: pricing math, cancellation refund logic, and the booking-availability path that guards against double-booking.

### Unit & Integration Tests — ✅ 20/20 passing

DB-backed tests use `mongodb-memory-server` — a real, disposable in-memory MongoDB instance, not a mock — so booking/availability logic runs against actual Mongo query behavior.

| Suite | Tests | Covers |
|---|---|---|
| `cancellationPolicy.test.js` | 9 | Flexible/moderate/strict refund tiers, boundary conditions, unrecognized-policy fallback |
| `pricing.test.js` | 6 | Base vs. seasonal pricing, exclusive range-end handling, multi-night totals straddling a seasonal boundary |
| `booking.test.js` (integration) | 5 | `GET /bookings/check-availability` — clean availability, blocked by an overlapping paid booking, unblocked when that booking is cancelled, and input validation |

```bash
npm test
```

### End-to-End Tests — ✅ 5/5 passing

Playwright, run against a real running instance (`npm start`) pointed at a dedicated test database — never mocks, never production.

- Homepage loads and renders the expected title
- Search redirects to `/homeList` and renders results or a clean empty state (not a 500)
- Listing navigation reaches the detail page with a working reserve button
- Login correctly rejects invalid credentials
- Login succeeds with a seeded test account

> **Deliberately not automated:** the Razorpay payment step. Driving a real payment through Razorpay's hosted checkout via Playwright needs their test-card flow and is brittle to automate — E2E coverage stops at "reached checkout," and payment-confirmation logic is verified separately via a signed mock webhook payload posted to `/bookings/webhook`. A scope decision, not a gap.

```bash
npm run test:e2e
```

### Continuous Integration — GitHub Actions

Every push to `main` runs the suite automatically. Actual history, not a cherry-picked clean record:

| Run | Commit | Result |
|---|---|---|
| #1 — Added the CI yml file | `d827f59` | ❌ Failed |
| #2 — Checking the ci.yml | `7033d68` | ❌ Failed |
| #3 — Added test codes | `c1a2e76` | ❌ Failed *(missing fixture data)* |
| #4 — Added dummy test results | `8bff7da` | ✅ Passed |
| #5 — Added the load testing for k6 | `e47ffc2` | ✅ Passed |

The first three failed because the pipeline had no seed/fixture data to run against yet — not a code defect. Fixed in run #4, green since.

### 📈 Load Testing — k6

Run manually against a local instance (k6 needs a live server, so this isn't part of CI): a ramping-VU scenario climbing **20 → 50 → 100 → 150** concurrent users over 4 minutes, hitting the homepage, listing search, and availability-check endpoints.

| Metric | Result |
|---|---|
| Request failure rate | **0%** across 6,762 requests, at every load level |
| `p(95)` latency | Rose to ~4s at 150 VUs (target was <800ms) |
| Root cause | **Database tier, not app code** — `htop` showed Node at ~1% CPU throughout; MongoDB Atlas's own metrics confirmed the primary node's opcounters spiking in matching bursts |

The app never crashed or errored under load — it degraded gracefully, and the bottleneck was independently confirmed (via both local resource monitoring and Atlas's own dashboard) to be the free-tier database, not the application layer.

```bash
k6 run load/roovia-load-test.js
```

---

## 📁 Project Structure & Maintenance Scripts

<details>
<summary><strong>Click to expand folder structure</strong></summary>

```
Roovia/
├── app.js                 # entry point: middleware chain, session config, cron, mongoose.connect
├── config/                 # Passport strategy setup
├── controllers/             # one file per feature area
├── middlewares/             # upload (Multer), rate limiting
├── models/                  # Mongoose schemas
├── routes/                  # Express routers
├── scripts/                 # maintenance/one-off scripts
├── utils/                   # business logic helpers (pricing, payouts, cancellation policy, etc.)
├── views/                   # EJS templates
└── public/                  # static assets
```

</details>

<details>
<summary><strong>Click to expand maintenance scripts</strong></summary>

Run with `node scripts/<file>.js` (each loads `.env` itself):

| Script | Purpose |
|---|---|
| `createAdmin.js` | Creates the first admin user directly in the database (no signup form for admins) |
| `assignHostIds.js` | Backfills sequential host IDs on existing `User` documents that predate that field |
| `geocodeExistingHomes.js` | Runs geocoding against listings created before address→coordinates lookup was added |
| `migratePhotos.js` | One-time migration of listing photos to their current storage format |

</details>

---

## ⚠️ Known Limitations / Honest Notes

Written deliberately, not omitted by accident — these are things I know about, not things I missed:

- **Single environment, on purpose (for now).** One MongoDB Atlas project/cluster/database shared between local development and the deployed instance, rather than separate dev/prod projects. With no real user base yet, there's no live data to protect from an in-progress bug. In production, this becomes two Atlas projects (`roovia-dev` / `roovia-prod`), each with its own cluster, database user, and Razorpay key set, wired through environment-scoped variables on the hosting platform.
- **The hourly cron (`setInterval` in `app.js`)** marks completed bookings and processes due payouts, written for a long-running process. Fine on a traditional always-on host; would need to become a scheduled job on a serverless target, where `setInterval` isn't guaranteed to keep running between invocations.
- **Smart pricing is a heuristic, not ML** — a day-of-week factor (learned from real bookings once a city has enough history, otherwise a default table) multiplied by a local-demand factor (comparable-listing occupancy). Deliberate: there isn't yet enough labeled search/conversion data for ML to learn anything meaningful, and a transparent heuristic is more useful to a host than an opaque prediction at this stage.
- **Under sustained load (~150 concurrent users), latency degrades** (p95 → ~4s) even though the app never errors — confirmed via both local and Atlas-side monitoring to be the free-tier database, not application code. Acceptable for a portfolio deployment; production would move to a dedicated Atlas tier before this became a real concern.
- **`mysql2` is an unused dependency** left over from an earlier direction — MongoDB/Mongoose is the only database in use. Flagged rather than silently left; will be removed.
- **Damage deposit/insurance language exists in the Terms & Conditions but isn't backend-enforced yet** — no `Home` schema field or checkout-time deposit hold currently exists for higher-value stays. The legal copy describes intended behavior ahead of the feature.

---

## 📄 License

ISC — see `package.json`.

---

<div align="center">

Built by [Shubhayan Bhattacharjee](https://github.com/<your-username>)

</div>
