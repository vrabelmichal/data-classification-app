# Galaxy Classification Web App 🌀

A web app for viewing and classifying galaxy images with a simple, responsive UI built using React, Vite and Convex as the backend. This project demonstrates a full-stack image classification workflow, including ingestion of galaxy image/data, configurable image display options, user sequences for classification, and administrative tools for management.

## Key features ✅
- Browse galaxy catalogs and preview image thumbnails
- Classify galaxies using a clear UI and multiple image contrast views
- Admin panels for maintenance (reset data, rebuild indices, etc.)
- Image provider system – local development server or Cloudflare R2 integration
- Data ingestion tooling for parquet files and mock data generation
- Built-in support for user sequences and skipped items for classification flow control

## Tech stack 🔧
- Frontend: React (TypeScript), Vite, Tailwind CSS
- Backend: Convex (serverless backend and database)
- Local image server (Express/Node) for dev; Cloudflare R2 for production images
- Data/tools: Python scripts for ingesting Parquet data

---

## Repository layout 📁

Top-level folders and what they contain:
- `src/` — Frontend React app and UI components
- `convex/` — Convex backend functions, routing, and schema
	- `convex/galaxies/` — Galaxy-related helper functions, queries, mutations and aggregates
- `scripts/` — Utility scripts for data ingestion, local dev servers and helpers
- `docs/` — Documentation and design notes (image config, backend refactor, quickstarts)
- `static/` — Static assets and config examples (e.g. `/static/config/images.json.example`)
- `local/` — Local-only utilities (local mock runners, test utilities)

---

## Getting started — Local development 🛠️

Prerequisites:
- Node.js (recommended: 18+)
- npm (or pnpm)
- Python (for data ingestion scripts)
- Convex CLI for backend dev and deployments (install via npm: `npm i -g convex`)

Quick start:

1. Install dependencies
```bash
npm install
```

2. Copy env file and set local development mode
```bash
cp .env.example .env
# Edit .env and set VITE_IMAGE_PROVIDER_MODE=local (or r2 for production)
```

3. Start the app for development (frontend + Convex backend)
```bash
npm run dev
# Or: npm run dev:all to also run the local image server
```

Want just the frontend, backend or local image server?
```bash
# Frontend only
npm run dev:frontend

# Backend (Convex) only
npm run dev:backend

# Dev all with hosts (frontend host 0.0.0.0, backend, and images)
npm run dev:all:hosts

# Local image server only
npm run dev:images
```

Open `http://localhost:5173` (default Vite port) to access the app, and Convex dev will run with the local backend.

---

## Environment configuration ⚙️
Environment variables are available in `.env.example` and include options for local image serving vs R2 integration. Some important variables:
- `VITE_IMAGE_PROVIDER_MODE` — `local` or `r2`
- `VITE_LOCAL_DATA_DIR` — directory for local images in dev mode
- `VITE_R2_PUBLIC_BASE` and `VITE_R2_BUCKET` — Cloudflare R2 settings for production

### Full list of common environment variables and their purpose
The following variables are used in various parts of the frontend, backend, and scripts in this repo. Keep secrets out of source control and use environment variable stores, Convex secrets, or a `.env.local` that is ignored by git.

- `VITE_IMAGE_PROVIDER_MODE` — `local` or `r2`. Controls whether images are served from a local image server (dev) or Cloudflare R2 (production). Defaults to `local`.
- `VITE_LOCAL_DATA_DIR` — Path to the local images folder used when `VITE_IMAGE_PROVIDER_MODE=local`. Default: `./.data`.
- `VITE_LOCAL_SERVER_BASE` — Base URL where the local image server is hosted. Default: `http://localhost:5178`.
- `IMAGE_SERVER_PORT` — Port used by the local image server (optional, script fallback: 5178).
- `VITE_R2_PUBLIC_BASE` — Public base URL for Cloudflare R2 CDN (when using `r2` mode).
- `VITE_R2_BUCKET` — R2 bucket name (when using `r2` mode).
- `VITE_CONVEX_URL` — Convex deployment client URL (eg. `https://<deployment>.convex.cloud`). Used by frontend and some scripts.
- `VITE_CONVEX_HTTP_ACTIONS_URL` — Convex HTTP Actions URL (`https://<deployment>.convex.site`) used by ingestion scripts and server-to-server action calls.
- `CONVEX_URL` — Alternate env var name used by some scripts; if present it is preferred over `VITE_CONVEX_URL`.
- `CONVEX_DEPLOY_KEY` — Convex deploy key for `npx convex dev` and deployments.
- `CONVEX_DEPLOYMENT` — Default convex deployment name used by `npx convex dev`.
- `CONVEX_SITE_URL` — The host domain used by Convex Auth (auth provider config) — often the same as the deployment `*.convex.site` or a custom domain.
- `CONVEX_CLOUD_URL` — Cloud (HTTP) URL used by server-side helpers (e.g. password reset flow). Commonly the same as `VITE_CONVEX_URL` but may be set explicitly for server-side fetches.
- `SITE_URL` — The public site URL used to build links (e.g., password reset links). Default: `http://localhost:5173`.
- `AUTH_RESEND_KEY` — (SECRET) API key for the Resend email provider. Required to send password reset emails using `convex/ResendOTPPasswordReset.ts`. Do not commit this value — use a secure env store.
- `INGEST_TOKEN` — Shared token used to protect ingestion endpoints (e.g. `convex/galaxies/batch_ingest.ts`). Set this to something only the ingesting client knows.

### Example `.env.local` (dev)
Create a `.env.local` at project root for local development and add keys that you want to keep private on your machine. Don't commit `.env.local`.

```env
# Convex
CONVEX_DEPLOY_KEY=project:owner:project|<secret key>
CONVEX_DEPLOYMENT=dev:brilliant-fox-578
VITE_CONVEX_URL=https://brilliant-fox-578.convex.cloud
VITE_CONVEX_HTTP_ACTIONS_URL=https://brilliant-fox-578.convex.site

# Image provider
VITE_IMAGE_PROVIDER_MODE=local
VITE_LOCAL_DATA_DIR=./.data
VITE_LOCAL_SERVER_BASE=http://localhost:5178

# Email provider (Resend) - required to send password reset emails
AUTH_RESEND_KEY=re_XXXXXXXXXXXXXXXXXXXX

# Protected ingestion endpoint token
INGEST_TOKEN=YOUR_INGEST_TOKEN

# Optional: public site URL
SITE_URL=http://localhost:5173
```

### Security & secrets 🔒
- Do NOT commit secrets (API keys, tokens) to git. Add them to an ignored `.env.local` or CI/hosting environment variables.
- For production, use a secure secrets manager or your hosting provider's environment variables (e.g. Vercel, Netlify, Cloudflare Workers, Convex secrets).
- `AUTH_RESEND_KEY` should be restricted to the Convex backend (server environment) — do NOT expose it to the browser.

---

## Data ingestion and loading 🚚
Use the Python scripts in `scripts/` to load galaxy data from Parquet files into the Convex DB. Examples:

```bash
# Install Python dependencies
pip install -r scripts/requirements.txt

# Generate sample data (for testing)
python scripts/generate_sample_parquet.py --count 100

# Load galaxies from a parquet file into Convex
python scripts/ingest_galaxies_from_file.py path/to/galaxies.parquet
```

See `scripts/README.md` for more details and options, including bulk ingestion HTTP endpoints.

---

## Image provider — local dev or R2 📷
This project includes a flexible image provider system. For local development, the `local` provider serves images from a local `.data/` folder via `scripts/local-image-server.mjs`. For production, configure Cloudflare R2 using environment variables (see `.env.example`).

For full image provider docs and configuration examples, see `docs/IMAGES.md` and `src/images`.

---

## Backend (Convex) & HTTP API 🔁
- Convex backend code lives in `convex/` and split into logical areas (`galaxies`, `auth`, `system_settings`, etc.).
- Convex server routes (HTTP functions) are defined in `convex/router.ts` and `convex/http.ts` where user-facing ingestion endpoints and debug routes are exposed.

Use the Convex Dev environment with:
```bash
npm run dev:backend
```

### Mailing & Password reset (Resend) ✉️
The app includes a password reset implementation that can send OTP/reset emails using the Resend service. The mailing-related code lives in `convex/ResendOTPPasswordReset.ts`. To enable this in both development and production:

1. Get an API key from Resend (or another email provider) and set it in your environment as `AUTH_RESEND_KEY`.
2. Ensure `SITE_URL` is set to the public site URL used in email links (or fallback to `http://localhost:5173` in dev).
3. Optionally set `CONVEX_CLOUD_URL` or `VITE_CONVEX_URL` so the server-side function can query `emailSettings:getSystemSettingsForEmail` for the `emailFrom` address.
4. Ensure `AUTH_RESEND_KEY` is only available to your server/backend (Convex secret or hosting env) and **not** publicly exposed in the front-end.

Note: `convex/ResendOTPPasswordReset.ts` currently has a fallback implementation using a `fetch` call to `https://api.resend.com/emails` which will work with `AUTH_RESEND_KEY`. The code comments mention previous or optional ways to use `resend` npm package if you prefer the SDK.

---

## Admin tools & maintenance 🔐
Admin panels are available under `src/components/admin/` and include debugging utilities such as:
- Rebuild galaxy indices and aggregates
- Delete all galaxy data
- Fill missing fields, reset statistics and run maintenance scripts

These use Convex backend functions under `convex/galaxies/maintenance.ts` and other helpers.

---

## Testing & linting 🧪
Run TypeScript checks and build for a quick sanity check:
```bash
npm run lint
```

To build the frontend for production:
```bash
npm run build
```

---

## Deployment 🚀
For Convex deployment, check the Convex docs and `convex/convex.config.ts` settings. If you are using Cloudflare R2 for images, ensure the R2 bucket and CDN settings are configured and `VITE_IMAGE_PROVIDER_MODE=r2` is set before building/hosting.

Useful links:
- Convex docs: https://docs.convex.dev/

---

## Contributing 🤝
Contributions are welcome. Please follow standard Pull Request conventions and keep changes small/targeted. If you want to contribute to backend changes, keep in mind Convex TypeScript server types (`convex/_generated/*`) are generated; update those by running the Convex CLI or as part of the build process.

---

## Where to look next
- `docs/` — Project-specific docs and architecture notes
- `convex/` — Backend functions and schema
- `src/components/` — React UI components and pages
- `scripts/` — Data ingestion scripts

---

## License
Check `LICENSE` in the repo root or ask the repository owner for licensing details.

---

If you want, I can also add quick start edit templates (e.g., `.env.local`/`.env`) or expand the admin/maintenance documentation further. 💡
