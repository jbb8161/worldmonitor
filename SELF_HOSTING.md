# 🌍 Self-Hosting World Monitor

Run the full World Monitor stack locally with Docker/Podman.

## 📋 Prerequisites

- **Docker** or **Podman** (rootless works fine)
- **Docker Compose** or **podman-compose** (`pip install podman-compose` or `uvx podman-compose`)
- **Node.js 22+** (for running seed scripts on the host)

## 🚀 Quick Start

```bash
# 1. Clone and enter the repo
git clone https://github.com/koala73/worldmonitor.git
cd worldmonitor
npm install

# 2. Generate the REQUIRED secrets. Without these the stack will not start
#    (see the "Required Environment Variables" table below).
echo "RELAY_SHARED_SECRET=$(openssl rand -hex 32)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -hex 32)"      >> .env
echo "REDIS_TOKEN=$(openssl rand -hex 32)"         >> .env

# 3. Start the stack
docker compose up -d        # or: uvx podman-compose up -d

# 4. Seed data into Redis
./scripts/run-seeders.sh

# 5. Open the dashboard
open http://localhost:3000
```

The dashboard works out of the box with public data sources (earthquakes, weather, conflicts, etc.). API keys unlock additional data feeds.

## 🔐 Required Environment Variables

These must be set before `docker compose up -d`, or one of the containers will exit on boot.

| Variable | Purpose | How to generate |
| --- | --- | --- |
| `RELAY_SHARED_SECRET` | Authenticates every non-public request the dashboard makes to the AIS relay. The relay refuses to start without it. | `openssl rand -hex 32` |
| `REDIS_PASSWORD` | Redis AUTH password (`--requirepass`). The Redis container refuses to start without it; the REST proxy uses it in its upstream connection string. | `openssl rand -hex 32` |
| `REDIS_TOKEN` | Bearer token the REST proxy (`redis-rest`) requires on every request, and the value the app sends as `UPSTASH_REDIS_REST_TOKEN`. The proxy and app containers refuse to start without it. | `openssl rand -hex 32` |

> Earlier releases shipped `wm-local-token` as a default for the REST token. That default has been removed (#3804) — the proxy was only reachable from `127.0.0.1:8079` so external exposure required a hostile `docker-compose.override.yml`, but any user who flipped that binding to `0.0.0.0` was instantly authenticated by a publicly documented string. Fresh installs and existing clones both need to set `REDIS_TOKEN` and `REDIS_PASSWORD` in `.env` from this release onward.

> Need to bring the relay up without auth for local debugging? Set `I_UNDERSTAND_THIS_DISABLES_AUTH=true` (the deprecated `ALLOW_UNAUTHENTICATED_RELAY=true` is still accepted). The relay will log a loud `[SECURITY]` warning at boot and every 5 minutes, and every non-public route will be reachable by anyone who can hit the port — **never use this on an internet-reachable host.**

## 🔑 API Keys

Create a `docker-compose.override.yml` to inject your keys. This file is **gitignored** — your secrets stay local.

```yaml
services:
  worldmonitor:
    environment:
      # 🤖 LLM — pick one or both (used for intelligence assessments)
      GROQ_API_KEY: ""            # https://console.groq.com (free, 14.4K req/day)
      OPENROUTER_API_KEY: ""      # https://openrouter.ai (free, 50 req/day)

      # 📊 Markets & Economics
      FINNHUB_API_KEY: ""         # https://finnhub.io (free tier)
      FRED_API_KEY: ""            # https://fred.stlouisfed.org/docs/api/api_key.html (free)
      EIA_API_KEY: ""             # https://www.eia.gov/opendata/ (free)

      # ⚔️ Conflict & Unrest
      ACLED_EMAIL: ""             # https://acleddata.com (free for researchers)
      ACLED_PASSWORD: ""          # OAuth flow — tokens auto-refresh (preferred over ACLED_ACCESS_TOKEN)
      ACLED_ACCESS_TOKEN: ""      # Alternative: static token (expires every 24h)

      # 🛰️ Earth Observation
      NASA_FIRMS_API_KEY: ""      # REQUIRED for seed-fire-detections.mjs — https://firms.modaps.eosdis.nasa.gov (free)

      # ✈️ Aviation
      AVIATIONSTACK_API: ""       # https://aviationstack.com (free tier)
      TRAVELPAYOUTS_API_TOKEN: "" # https://travelpayouts.com (flight price search — optional)
      # 🚢 Maritime
      AISSTREAM_API_KEY: ""       # https://aisstream.io (free)

      # 🌐 Internet Outages (paid)
      CLOUDFLARE_API_TOKEN: ""    # https://dash.cloudflare.com (requires Radar access)

      # 🔌 Self-hosted LLM (optional — any OpenAI-compatible endpoint)
      LLM_API_URL: ""             # e.g. http://localhost:11434/v1/chat/completions
      LLM_API_KEY: ""
      LLM_MODEL: ""

  ais-relay:
    environment:
      AISSTREAM_API_KEY: ""       # same key as above — relay needs it too
```

### 💰 Free vs Paid

| Status | Keys |
|--------|------|
| 🟢 No key needed | Earthquakes, weather, natural events, UNHCR displacement, prediction markets, stablecoins, crypto, spending, climate anomalies, submarine cables, BIS data, cyber threats |
| 🟢 Free signup | GROQ, FRED, EIA, NASA FIRMS, AISSTREAM, Finnhub, AviationStack, ACLED, OpenRouter |
| 🟡 Free (limited) | OpenSky (higher rate limits with account) |
| 🔴 Paid | Cloudflare Radar (internet outages) |

## 🌱 Seeding Data

The seed scripts fetch upstream data and write it to Redis. They run **on the host** (not inside the container) and need the Redis REST proxy to be running.

```bash
# Run all seeders (auto-sources API keys from docker-compose.override.yml)
./scripts/run-seeders.sh
```

**⚠️ Important:** Redis data persists across container restarts via the `redis-data` volume, but is lost on `docker compose down -v`. Re-run the seeders if you remove volumes or see stale data.

To automate, add a cron job:

```bash
# Re-seed every 30 minutes
*/30 * * * * cd /path/to/worldmonitor && ./scripts/run-seeders.sh >> /tmp/wm-seeders.log 2>&1
```

**Per-seeder timeout (`SEED_TIMEOUT`):** standalone seeders are each wrapped in a
wall-clock cap so one hung upstream can't starve the rest of the run. It defaults
to `1800` (30 min); override with `SEED_TIMEOUT=<seconds>`, or `SEED_TIMEOUT=0` to
disable. Bundle seeders (`seed-bundle-*.mjs`) are exempt — they already bound each
section internally. Requires the `timeout` command (GNU coreutils); if it's absent
the cap is silently skipped.

### 🔧 Manual seeder invocation

If you prefer to run seeders individually:

```bash
# Source .env so REDIS_TOKEN (and any API keys it holds) become available.
# Quick-start puts REDIS_TOKEN in .env, not in your shell — without this,
# the next line fails-loud with "REDIS_TOKEN: parameter null or not set".
set -a; . ./.env; set +a

export UPSTASH_REDIS_REST_URL=http://localhost:8079
export UPSTASH_REDIS_REST_TOKEN="${REDIS_TOKEN:?set REDIS_TOKEN in .env first}"
node scripts/seed-earthquakes.mjs
node scripts/seed-military-flights.mjs
# ... etc
```

`./scripts/run-seeders.sh` auto-sources `REDIS_TOKEN` from `.env`, so the wrapper is the simpler path. Use the manual form only when iterating on a single seeder.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│                 localhost:3000               │
│                   (nginx)                    │
├──────────────┬──────────────────────────────┤
│ Static Files │      /api/* proxy            │
│  (Vite SPA)  │         │                    │
│              │    Node.js API (:46123)       │
│              │    50+ route handlers         │
│              │         │                     │
│              │    Redis REST proxy (:8079)   │
│              │         │                     │
│              │      Redis (:6379)            │
└──────────────┴──────────────────────────────┘
         AIS Relay (WebSocket → AISStream)
```

| Container | Purpose | Port |
|-----------|---------|------|
| `worldmonitor` | nginx + Node.js API (supervisord) | 3000 → 8080 |
| `worldmonitor-redis` | Data store | 6379 (internal) |
| `worldmonitor-redis-rest` | Upstash-compatible REST proxy | 8079 |
| `worldmonitor-ais-relay` | Live vessel tracking WebSocket | 3004 (internal) |

> **`redis-rest` command allowlist**: the bundled proxy (`docker/redis-rest-proxy.mjs`) only
> forwards a fixed allowlist of Redis commands and rejects `EVAL`/`EVALSHA`/`SCRIPT` (no Lua
> scripting). Two consequences for a self-hosted stack:
>
> - `@upstash/ratelimit`'s Lua-based sliding-window limiter (`server/_shared/rate-limit.ts`,
>   `api/_rate-limit.js`) can't run against it. Both automatically detect the rejection once and
>   fall back to a non-Lua fixed-window limiter (`INCR` + `EXPIRE NX`) for the rest of the
>   process — rate limiting still enforces, just with fixed- instead of sliding-window semantics.
> - `scripts/ais-relay.cjs`'s own in-container seed loops (`UPSTASH_ENABLED`) also require
>   `UPSTASH_REDIS_REST_URL` to start with `https://` by default, which the plain-HTTP proxy
>   never satisfies. Set `UPSTASH_ALLOW_INSECURE_HTTP=true` on the `ais-relay` service (already
>   wired for `redis-rest` in `docker-compose.yml`) to opt into using the proxy from
>   inside the relay container.

## 🔨 Building from Source

```bash
# Frontend only (for development)
npx vite build

# Full Docker image
docker build -t worldmonitor:latest -f Dockerfile .

# Rebuild and restart
docker compose down && docker compose up -d
./scripts/run-seeders.sh
```

### ⚠️ Build Notes

- The Docker image uses **Node.js 22 Alpine** for both builder and runtime stages
- Blog site build is skipped in Docker (separate dependencies)
- The runtime stage needs `gettext` (Alpine package) for `envsubst` in the nginx config
- Docker nginx mirrors Vercel's `script-src` policy and does not allow `'unsafe-inline'`; hash-pin any custom inline scripts before adding them to a self-hosted build.
- If you hit `npm ci` sync errors in Docker, regenerate the lockfile with the container's npm version:
  ```bash
  docker run --rm -v "$(pwd)":/app -w /app node:24-alpine npm install --package-lock-only
  ```

### 🔀 Building a specific variant (e.g. AUSPEX)

Set `VITE_VARIANT` before building to get a variant-specific dashboard
(branding, panels, feeds) instead of the default `full` build:

```bash
VITE_VARIANT=auspex npx vite build
# or for local dev:
npm run dev:auspex
```

`auspex` (cybersecurity/fintech/fraud intelligence) is self-hosted only —
it isn't part of the worldmonitor.app multi-tenant deployment, so there's
no subdomain routing to configure for it.

**Known gap:** the server-side news digest (`server/worldmonitor/news/v1/`)
doesn't have `auspex` wired into its variant list yet, so the digest is
permanently empty for this variant rather than occasionally down. The
codebase compensates by defaulting the `newsPerFeedFallback` runtime
feature to ON for `auspex` specifically (every other variant keeps it OFF
by default) so news panels — including the four fraud panels — fetch
their feeds directly instead of showing "Digest unavailable" forever.
This is a code default in `src/services/runtime-config.ts`, not something
you need to set via environment variable. If you build out proper
server-side digest support for `auspex` later, per-feed fallback can be
turned back off for it from the dashboard's Settings, or by changing that
default in code.

### ☁️ Deploying a variant to Vercel (e.g. AUSPEX)

To deploy a specific variant (rather than the Docker self-host path above)
to your own Vercel project:

1. **Set `VITE_VARIANT`** in Vercel → Project → Settings → Environment
   Variables, e.g. `VITE_VARIANT=auspex`. Vite reads this directly from the
   environment at build time regardless of which build command runs it.
2. **Build command:** the default Vercel build command runs `npm run build`,
   which does **not** set `VITE_VARIANT` itself and runs a different set of
   steps than the variant scripts (`build:blog`, `build:crawlable-corpus`,
   `build:content-corpus` — marketing/SEO content for the main
   worldmonitor.app site, not needed for a standalone variant deploy). For
   AUSPEX specifically, override the Vercel **Build Command** to
   `npm run build:auspex` instead — it runs the OpenAPI + agent-skills
   generation steps the API surface depends on, and reads `VITE_VARIANT`
   from the same environment variable set in step 1.
3. **No `vercel.json` changes needed.** The `functions`/rewrite config in
   `vercel.json` is shared across every variant; nothing in it references
   `auspex` or the production subdomains (tech/finance/commodity/happy/
   energy) in a way that would conflict with or need adjusting for a
   standalone AUSPEX deployment — see `src/config/auspex-meta.ts` for why
   AUSPEX's branding metadata is deliberately kept out of the
   `variant-meta.ts` file that the production-subdomain contract test
   (`tests/deploy-config.test.mjs`) cross-checks.
4. **`scripts/vercel-ignore.sh`** (Vercel's "Ignored Build Step") skips
   builds on `main` when a push touches nothing under `src/`, `api/`,
   `server/`, `vite.config.ts`, `vercel.json`, `middleware.ts`, etc. — this
   only matters if you're pushing to `main` on the same Vercel project as
   another variant; a fresh branch/project with web-relevant changes always
   builds.

Verified locally: `npm run build:auspex` succeeds end to end (security
scan, OpenAPI generation, agent-skills build, typecheck, `vite build`) and
produces a `dist/dashboard.html` with the correct AUSPEX `<title>`.

### 🔒 Password-protecting a preview deployment (passfort)

Before sharing a preview URL for review, gate the whole site behind a
password using [passfort](https://github.com/tommyv1987/passfort)
(`@tommyvez/passfort` — works on Vercel's free Hobby plan, no paid
Password Protection add-on needed).

**Why not `npx passfort init`:** its scaffolding CLI only knows how to write
a Next.js `middleware.ts`/`proxy.ts` (it checks for a `next` dependency in
`package.json` and refuses otherwise) — this project is Vite, not Next.js.
Instead, this repo's `middleware.ts` imports `handlePasswordProtect`
directly from `@tommyvez/passfort`'s framework-agnostic core (plain Web
`Request`/`Response`, no Next.js types), which is what the Next.js adapter
itself delegates to under the hood. This is already wired in — self-hosters
don't need to run any passfort command; only the environment variables
below need setting.

**Required environment variables** (set in Vercel → Project → Settings →
Environment Variables — never commit real values):

| Variable | Required | Description |
| --- | --- | --- |
| `PASSFORT_SECRET` | Yes, to enable the gate | Min 16 chars, signs the session cookie. Generate: `openssl rand -base64 24` |
| `PASSFORT_PASSWORD` | Yes\* | Plain-text password (quick start) |
| `PASSFORT_HASH` | Yes\* | PBKDF2 hash instead of a plain password — generate with `npx passfort hash "your-password"` |
| `PASSFORT_ENABLED` | No | Set to `false` to disable the gate without removing the middleware code; redeploy to flip it back |

\*Use either `PASSFORT_PASSWORD` or `PASSFORT_HASH`, not both.

**Env var names are case-sensitive and must match exactly.** A common typo
is entering these as `PASSPORT_*` on the Vercel dashboard instead of
`PASSFORT_*` — Vercel accepts the misnamed variable without complaint,
and since none of `PASSFORT_SECRET`/`PASSFORT_PASSWORD`/`PASSFORT_HASH`
are actually set, the gate silently falls back to its no-op behavior
(see below) rather than erroring. The site deploys and looks fine, it's
just left completely unprotected. Double-check the exact variable names
in the Vercel dashboard against this table if the gate doesn't seem to
be prompting for a password after deploy.

**Scope:** the gate covers every page route (`/`, `/dashboard`, deep links)
but deliberately **excludes `/api/*` entirely** — the RSS proxy, MCP
endpoint, health checks, and every other API route stay reachable without a
password. This matters for two reasons: the dashboard's own client-side
`fetch()` calls to `/api/*` need to keep working even for an authenticated
visitor (they *do* carry the session cookie automatically once you're past
the login form, but excluding `/api/*` is simpler and also covers
unauthenticated callers), and external integrations, uptime monitors, and
MCP clients can't submit a password at all.

When none of `PASSFORT_SECRET`/`PASSFORT_PASSWORD`/`PASSFORT_HASH` are set,
the gate is a no-op — every other variant's deployment is unaffected by
this being wired into `middleware.ts` for everyone.

Verified locally (`tests/middleware-password-gate.test.mts`): an
unauthenticated request to `/` or any deep link gets a 401 with the
password form; a wrong password re-shows the form; the correct password
sets a signed session cookie and redirects; a valid session cookie passes
subsequent requests through; a forged/invalid cookie is rejected; and
`/api/rss-proxy`, `/api/health`, `/api/version`, `/api/news/v1/*`, and
`/api/mcp` all pass through with no session and no password, even with the
gate fully configured.

### 🤖 Getting real AI content angles on the Briefing view

The Briefing's suggested content angle per story reuses the same
`summarize-article` RPC and Ollama → OpenRouter → Groq → browser-T5
provider chain the rest of the app uses. Since `auspex` has no
Clerk/Convex billing account to speak of, the RPC's premium check is
bypassed automatically for `auspex` requests *when your
deployment has neither `CLERK_SECRET_KEY` nor a configured Convex
entitlement backend (`CONVEX_SITE_URL` + `CONVEX_SERVER_SHARED_SECRET`) set*
— true for essentially every self-hosted `auspex` install. That only
removes the auth requirement; a provider still needs real credentials
behind it, or every angle falls back to the on-device browser T5 model
(functional, but much weaker than a real LLM):

- **Docker/self-hosted with your own LLM:** set `OLLAMA_API_URL` (see
  [Self-Hosted LLM](#self-hosted-llm) below) — reachable because the
  sidecar sets `LOCAL_API_MODE`, which lifts the localhost-only allowlist
  `getProviderCredentials()` otherwise enforces for the `ollama` provider.
- **Deployed on Vercel (no Docker sidecar):** `OLLAMA_API_URL` is only
  ever allowed to point at `localhost`/`127.0.0.1`/`host.docker.internal`
  outside a Docker/desktop deployment (`server/_shared/llm.ts`'s
  `OLLAMA_HOST_ALLOWLIST`) — a Vercel function cannot reach an Ollama
  instance running on your own machine or network through that
  allowlist, so `ollama` will always be skipped there regardless of the
  premium-gate fix. Set **`GROQ_API_KEY`** as a Vercel project
  environment variable instead (read directly via `process.env.GROQ_API_KEY`
  in `server/_shared/llm.ts`) — recommended over `OPENROUTER_API_KEY` for
  this specific use case: Groq's free tier needs no credit card and
  comfortably covers occasional angle generation for a small team, and
  short content-angle summaries don't need access to closed frontier
  models. `OPENROUTER_API_KEY` also works (tried first, ahead of Groq, in
  the client's provider order) if you'd rather route through OpenRouter,
  but Groq alone is enough for `generateSummary()`/the Briefing's angle
  generator to produce a real synthesized angle instead of falling
  through to browser T5.

  Angle generation is Redis-cached server-side for 24h keyed on the
  cluster's headline set (`CACHE_TTL_SECONDS` in
  `server/worldmonitor/news/v1/_shared.ts`), shared across every caller
  hitting the same deployment — so multiple teammates opening the
  Briefing the same day reuse the same cached angle rather than each
  triggering a fresh Groq call, keeping usage well inside the free tier.
  **This caching only exists if `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` are also set** (documented under "Cross-User
  Cache" in `.env.example`) — without them, `cachedFetchJsonWithMeta()`
  in `server/_shared/redis.ts` treats every read as a miss and every
  write as a silent no-op (no error, just zero caching), so every angle
  on every page load becomes a fresh Groq call. Create a free database at
  [upstash.com](https://upstash.com/) (or via Vercel's Upstash
  marketplace integration, which populates the same two vars) and set
  those two env vars in the Vercel project before relying on the
  free-tier-is-enough reasoning above.

## 🌐 Connecting to External Infrastructure

### Shared Redis (optional)

If you run other stacks that share a Redis instance, connect via an external network:

```yaml
# docker-compose.override.yml
services:
  redis:
    networks:
      - infra_default

networks:
  infra_default:
    external: true
```

### Self-Hosted LLM

Any OpenAI-compatible endpoint works (Ollama, vLLM, llama.cpp server, etc.):

```yaml
# docker-compose.override.yml
services:
  worldmonitor:
    environment:
      LLM_API_URL: "http://your-host:8000/v1/chat/completions"
      LLM_API_KEY: "your-key"
      LLM_MODEL: "your-model-name"
    extra_hosts:
      - "your-host:192.168.1.100"  # if not DNS-resolvable
```

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| 📡 `0/55 OK` on health check | Seeders haven't run — `./scripts/run-seeders.sh` |
| 🔴 nginx won't start | Check `podman logs worldmonitor` — likely missing `gettext` package |
| 🔑 Seeders say "Missing UPSTASH_REDIS_REST_URL" | Stack isn't running, or run via `./scripts/run-seeders.sh` (auto-sets env vars) |
| 📦 `npm ci` fails in Docker build | Lockfile mismatch — regenerate with `docker run --rm -v $(pwd):/app -w /app node:24-alpine npm install --package-lock-only` |
| 🚢 No vessel data | Set `AISSTREAM_API_KEY` in both `worldmonitor` and `ais-relay` services |
| 🔥 No wildfire data | Set `NASA_FIRMS_API_KEY` |
| 🌐 No outage data | Requires `CLOUDFLARE_API_TOKEN` (paid Radar access) |
