# CFE Share Space

A place for Zooniverse researchers and staff to share, discuss, and discover **Custom Front End (CFE)**
resources. Public read; all participation (create/edit/comment/elevate) requires Zooniverse sign-in and
authorization. The whole site is a small CMS: every page is a unified `content` row (type + place in a
hierarchy, stored in sqlite) edited through one markdown editor and managed from an admin console.

## Stack

- **Frontend:** Vite + Preact + TypeScript + Tailwind v4 (`@preact/signals` for auth state)
- **Backend:** Express + **`node:sqlite`** (built-in — no native deps; FTS5 trigram for search)
- **Auth:** Zooniverse Doorkeeper **Authorization Code grant (OOB)** — secret stays backend-only
- **Tests:** Puppeteer end-to-end (`node --test`), one suite per phase, headful + screenshots

## Run

```bash
npm install
cp .env.example .env     # fill in the Zooniverse OAuth app (CFE WIP) values
npm run dev              # Vite on :5173 (proxies /api → Express on :8787)
# or production-style (one server serves built SPA + API):
npm start                # build + node server on :8787
```

## Auth (Authorization Code, redirect flow)

Standard redirect round-trip; the browser never sees the secret:

1. Click **Sign in with Zooniverse** → `/api/auth/login` 302-redirects to Zooniverse's authorize page.
2. You sign in + approve on Zooniverse.
3. Zooniverse redirects to **`/api/auth/callback?code=…`** → the backend exchanges code+secret at
   `/oauth/token`, fetches `/api/me`, resolves your role, sets an httpOnly session cookie, and redirects home.

**Required once:** register the callback URL (`ZOO_REDIRECT_URI`) on the Zooniverse OAuth app
("CFE WIP") — exactly `http://localhost:8787/api/auth/callback` for local review. Doorkeeper rejects
any unregistered redirect URI. Multiple callback URLs can be listed (newline-separated). To verify the
live flow end-to-end: `node scripts/probe-oauth.js`.

Roles: `public` (read) · `contributor` (create threads/replies/CFEs) · `admin` (everything + content
manager + user management). Seed admins via `SEED_ADMINS` in `.env` (comma-separated Zooniverse logins).

## Content model (one table)

`content { id, type, title, slug, body_markdown, parent_id, position, status, metadata(JSON) }`.
Types: `section`, `page`, `cfe`, `category`, `thread`, `reply`, `announcement`, `featured`,
`external_link`. `parent_id` + `position` form the tree that drives nav, section pages, and
thread→reply nesting. Type-specific data lives in `metadata` (e.g. CFE `{github_url, image(base64), tagline, tags}`).
Images are stored as base64 **inside sqlite** (single-file DB). Search indexes title + body + metadata
text (never the base64 image) into an FTS5 **trigram** table for case-insensitive substring matching.

## Tests

```bash
npm run test:e2e                                   # all phases (serial; includes a live OAuth sign-in)
HEADFUL=1 node --test e2e/phase4-catalog.test.js   # watch one phase in a real browser
```

Screenshots land in `e2e/screenshots/`. The live OAuth test uses `ZOO_USERNAME`/`ZOO_PASSWORD`.

| Suite | Covers |
|---|---|
| phase0-layout | shell, nav, centered/breakpoint layout, `/api/health` |
| phase1-auth | role gating (403 trust boundary) + **real Zooniverse OOB sign-in** |
| phase3-admin | content tree manager (create/edit/reorder/renest) + user management |
| phase4-catalog | CFE catalog built via admin UI: base64 image, repo opens new tab, responsive grid |
| phase5-forum | categories/threads/replies, recent-activity sort, code-reference blocks |
| phase6-news-featured | announcements + elevating a thread to a featured topic |
| phase7-resources | Resources section + pages + external API-docs link (help.zooniverse.org) |
| phase8-search | FTS5 trigram partial match across content + metadata; result navigation |
