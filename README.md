# CFE Share Space

A place for Zooniverse researchers and staff to share, discuss, and discover **Custom Front End (CFE)**
resources. Public read; all participation (create/edit/comment/elevate) requires Zooniverse sign-in and
authorization. The whole site is a small CMS: every page is a unified `content` row (type + place in a
hierarchy, stored in sqlite) edited through one markdown editor and managed from an admin console.

## Stack

- **Frontend:** Vite + Preact + TypeScript + Tailwind v4 (`@preact/signals` for auth state)
- **Backend:** Express + **`node:sqlite`** (built-in — no native deps; FTS5 trigram for search)
- **Auth:** Zooniverse Doorkeeper **Authorization Code grant (redirect flow)**; secret stays backend-only
- **Tests:** Puppeteer end-to-end (`node --test`), one suite per feature, headful + screenshots

## Run

```bash
npm install
cp .env.example .env     # fill in the Zooniverse OAuth app (CFE WIP) values
npm run dev              # Vite (HMR) on :3000, proxies /api to Express on :8787
# or production-style (one server serves built SPA + API):
npm start                # build + node server on :8787
```

Ports are fixed so the OAuth callback URLs stay stable: dev runs on **:3000**, prod on **:8787**.
Override with `vite --port <n>` (dev) or `PORT=<n>` (prod).

## Auth (Authorization Code, redirect flow)

Standard redirect round-trip; the browser never sees the secret:

1. Click **Sign in with Zooniverse** → `/api/auth/login` 302-redirects to Zooniverse's authorize page.
2. You sign in + approve on Zooniverse.
3. Zooniverse redirects to **`/api/auth/callback?code=…`** → the backend exchanges code+secret at
   `/oauth/token`, fetches `/api/me`, resolves your role, sets an httpOnly session cookie, and redirects home.

**Required once:** register the callback URL (`ZOO_REDIRECT_URI`) on the Zooniverse OAuth app
("CFE WIP"). Doorkeeper rejects any unregistered redirect URI, so register both ports (newline-separated):
`http://localhost:3000/api/auth/callback` (dev) and `http://localhost:8787/api/auth/callback` (prod), and
set `ZOO_REDIRECT_URI` in `.env` to match the one you're running. To verify the live flow end-to-end:
`node scripts/probe-oauth.js`.

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
npm run test:e2e                              # all suites (serial; includes a live OAuth sign-in)
HEADFUL=1 node --test e2e/cfe-crud.test.js    # watch one suite in a real browser
```

Screenshots land in `e2e/screenshots/`. The live OAuth test uses `ZOO_USERNAME`/`ZOO_PASSWORD`.

| Suite | Covers |
|---|---|
| layout | shell, nav, centered/breakpoint layout, `/api/health` |
| auth | role gating (403 trust boundary) + **real Zooniverse sign-in** |
| auth-return | sign-in returns to the originating page |
| admin | user administration (role changes, add user by login) |
| open-contribution | any signed-in user can contribute; no whitelist |
| discussion-gate | Discussion is sign-in-only; everything else stays public |
| cfe-crud | CFE create/edit/delete, authorization, Reviewed/All toggle, responsive card |
| news-crud / featured-crud / discussion-crud / resources-crud | per-section content management |
| volunteer-callout | landing callout linking to the Zooniverse CFE page |
| resources-nav | Resources dropdown navigation |
| nav-active | top-nav highlights the current page |
| theme | theme tokens applied + page screenshots |
| search | FTS5 trigram partial match across content + metadata; result navigation |
