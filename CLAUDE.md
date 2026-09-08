# Calgary EMS Dashboard (ems-map)
**What it is:** Personal research dashboard: a dark Leaflet map of Calgary EMS/fire stations, hospitals, coverage rings, Voronoi response zones and a FOIP dispatch heatmap, plus Chart.js panels (City Open Data 2010-2020, AHS FOIP alerts/TOC hours/event volumes) and a dual-axis "Correlate" tool.
**Live at:** https://ems.brightening.ca (tunnel -> nginx :80; /etc/nginx/sites-enabled/ems-map serves root /var/www/ems-map/frontend and proxies /api/ -> localhost:3001) · API port 3001 · pm2 `ems-map-api` (status **stopped**) · code in /var/www/ems-map · repo git@github.com:dariohudon/ems-map.git (main, in sync)

## Stack
Frontend: static vanilla JS + Leaflet, Leaflet.heat, Turf.js, Chart.js, IBM Plex Mono (no build step). Backend: Node/Express 5 with axios, node-cron, dotenv, cors (backend/server.js). External: City of Calgary Socrata API (CALGARY_API_BASE) server-side; Nominatim geocoding from the browser. No database, no AI.

## Run and deploy
```
cd /var/www/ems-map/backend && npm install
pm2 start server.js --name ems-map-api --cwd /var/www/ems-map/backend && pm2 save   # no ecosystem file
pm2 restart ems-map-api
```
Frontend changes are live on save (nginx serves the files); nginx config changes need sudo + `sudo nginx -t && sudo systemctl reload nginx`. Env file: `backend/.env` with names PORT, CALGARY_API_BASE. Dir is dario:dario under root-owned /var/www.

## Data
- `backend/data/*.json` — cached Open Data (stations, fire_stations, calls, calls_by_type), rewritten on boot and by the in-process cron `0 */6 * * *`; last refreshed 2026-05-29.
- `backend/data/foip/*.json` — hand-transcribed AHS FOIP statistics (static, irreplaceable; keep). `data/*.pdf|xlsx` are the source FOIP disclosures, git-ignored — keep.
- Endpoints: /stations, /fire-stations, /calls, /stats?year=, /foip/*, /health. No crontab entries.

## Gotchas
- PORT CONFLICT: backend/.env binds 3001, but since 2026-09-05 the `ruview` Docker container publishes 127.0.0.1:3001 (its WebSocket). nginx /api/ therefore proxies to RuView today, and `pm2 start ems-map-api` would fail with EADDRINUSE. Fix = new port in backend/.env AND in the nginx proxy_pass (sudo), then restart.
- ems-map-api has been stopped since about 2026-05-29 (last log line); reason unknown. Meanwhile the page loads but every /api call fails, so markers and charts are empty.
- The nginx site is `default_server` on :80, so any unknown hostname reaching Leonard's port 80 gets this app.
- Refresh errors (EAI_AGAIN, 500/408 from data.calgary.ca) are routine; cached JSON keeps serving.
- Cruft in repo root: an empty file literally named `sudo`, and backend/server.js.backup.
- Chart panels are mutually exclusive (one open at a time); legend buttons are coloured via a per-layer `--c` CSS variable and must keep pointer-events enabled (regression fixed in 4364ff4).

## Conventions
Follow ~/.claude memory 'feedback-app-styling': square corners, Apple system font at standard sizes, 1380px desktop container with 32px gutters, visuals left / text right on desktop, no horizontal scroll.
Repo-specific: dark map default with Dark/Light/Neutral tile toggle; three-level chart-card hierarchy (source tag / title / subtitle) with 2px left accent; IBM Plex Mono uppercase glass buttons — this predates the styling memory, so check with Dario before restyling. Map toggles must never move the viewport (memory feedback-map-ux).
