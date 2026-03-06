# KensTeam Infrastructure Audit

**Last Updated:** March 5, 2026
**Owner:** Ken (homebase@kensteam.com)
**Mac:** Kens-Mac-Studio

---

## Quick Access Reference

| What | How |
|------|-----|
| **SSH to Droplet** | `ssh root@165.22.45.158` |
| **Droplet Console** | DigitalOcean dashboard > Droplet > Console |
| **Droplet IP** | 165.22.45.158 |
| **GitHub org** | github.com/kensteam |
| **Cloudflare dashboard** | dash.cloudflare.com |
| **Heroku dashboard** | dashboard.heroku.com (app: autogenv2) |
| **Local code** | `~/Company digital tools/` |
| **Wrangler deploy** | `cd ~/Company digital tools/[project] && npx wrangler deploy` |
| **Heroku deploy** | `cd ~/Company digital tools/glsim && git push` (auto-deploys) |

---

## Platform Overview

| Platform | Purpose | Access |
|----------|---------|--------|
| **GitHub** | Source code repos (org: `kensteam`) | github.com/kensteam |
| **GitHub Desktop** | Local Git GUI on Mac | App on Mac |
| **Cloudflare** | Workers (APIs) + Pages (frontends) + R2 (storage) | dash.cloudflare.com |
| **Heroku** | Node.js app hosting (glsim backend) | dashboard.heroku.com |
| **DigitalOcean** | Ubuntu droplet — runs 11 sites | cloud.digitalocean.com |
| **Mac Local** | Source code in `~/Company digital tools/` | Finder / Terminal / Claude Code |

---

## DigitalOcean Droplet

| Detail | Value |
|--------|-------|
| **Name** | ubuntu-s-2vcpu-4gb-nyc3-01 |
| **Specs** | 2 vCPU, 4 GB RAM, 80 GB Disk |
| **Region** | NYC3 |
| **OS** | Ubuntu 25.10 x64 |
| **Public IPv4** | 165.22.45.158 |
| **Private IP** | 10.108.0.3 |
| **SSH access** | `ssh root@165.22.45.158` |
| **Status** | ON, CPU ~5-10% |
| **Process manager** | PM2 (installed March 5, 2026) + Docker for TrendSpotter |
| **PM2 config** | /root/ecosystem.config.js |
| **Web server** | Nginx (SSL on 443, HTTP on 80) |
| **Disk usage** | 8.6% of 76.45 GB |
| **Memory usage** | 32% |

### Services Running on the Droplet (managed by PM2)

| PM2 Name | Port | Droplet Path | Script | Domain |
|----------|------|-------------|--------|--------|
| gooderlabs-site | 5060 | /opt/gooderlabs-site | app.py | gooderlabs.com + kensteam.com |
| lifestyle-generator | 5050 | /opt/lifestyle-generator | app.py | lifestyle.gooderlabs.com |
| tshirt-lister | 5055 | /opt/tshirt-lister-v2 | app.py | lister.gooderlabs.com |
| ticket-api | 5061 | /root/ticket-api | ticket_api.py | tickets.gooderlabs.com |
| listing-optimizer | 5070 | /opt/gooder-tools/listing-optimizer | app.py | listing-optimizer.gooderlabs.com |
| design-pipeline | 5056 | /opt/design-pipeline | app.py (venv) | pipeline.gooderlabs.com |

### Other Services on the Droplet

| Port | Process | Domain |
|------|---------|--------|
| 8000 | Docker container | trends.gooderlabs.com (TrendSpotter) |
| 80/443 | Nginx | All domains (reverse proxy + SSL) |
| 22 | SSH | `ssh root@165.22.45.158` |

### PM2 Quick Commands

| Command | What it does |
|---------|-------------|
| `pm2 list` | See all services and status |
| `pm2 restart gooderlabs-site` | Restart a specific service |
| `pm2 restart all` | Restart everything |
| `pm2 logs gooderlabs-site` | View logs for a service |
| `pm2 logs` | View all logs |
| `pm2 monit` | Live monitoring dashboard |
| `pm2 save` | Save current process list (run after changes) |

### Static Sites on the Droplet (served directly by Nginx)

| Domain | Root Directory |
|--------|---------------|
| **vault.gooderlabs.com** | /var/www/product-vault/dist |
| **shield.gooderlabs.com** | /var/www/trademark-shield/dist |
| **big-liquidation.com** | /var/www/big-liquidation.com |

### Droplet Issues

- ~~pipeline.gooderlabs.com is DOWN~~ **FIXED March 5, 2026** — design-pipeline added to PM2 with venv interpreter.
- ~~No PM2 installed~~ **FIXED March 5, 2026** — PM2 installed, all 5 Python services managed, startup on reboot enabled.
- ~~Ports bound to 0.0.0.0~~ **FIXED March 5, 2026** — All services now bound to 127.0.0.1.
- ~~51 system updates pending~~ **FIXED March 5, 2026** — All updates applied, system rebooted, PM2 resurrect restored all services.

---

## Complete Domain Map

### Domains on the Droplet (165.22.45.158)

| Domain | Points To | How |
|--------|-----------|-----|
| gooderlabs.com | Droplet > Nginx > Python :5060 | DNS A record |
| kensteam.com | Droplet > Nginx > Python :5060 | DNS A record |
| lifestyle.gooderlabs.com | Droplet > Nginx > Python :5050 | DNS A record |
| lister.gooderlabs.com | Droplet > Nginx > Python :5055 | DNS A record |
| listing-optimizer.gooderlabs.com | Droplet > Nginx > Python :5070 | DNS A record |
| pipeline.gooderlabs.com | Droplet > Nginx > Python :5056 | DNS A record |
| vault.gooderlabs.com | Droplet > Nginx > static files | DNS A record |
| shield.gooderlabs.com | Droplet > Nginx > static files | DNS A record |
| tickets.gooderlabs.com | Droplet > Nginx > Python :5061 | DNS A record |
| trends.gooderlabs.com | Droplet > Nginx > Docker :8000 | DNS A record |
| big-liquidation.com | Droplet > Nginx > static files | DNS A record |

### Domains on Cloudflare

| Domain | Points To | Type |
|--------|-----------|------|
| **assets.gooderlabs.com** | R2 bucket: `mockup-packs` | R2 custom domain (Proxied) |
| gooder-tools.pages.dev | Cloudflare Pages | Team Hub dashboard |
| sim-placer.pages.dev | Cloudflare Pages | Sim Placer app |
| itemlens.pages.dev | Cloudflare Pages | ItemLens frontend |
| sim-uploader.homebase-9fe.workers.dev | Cloudflare Worker | **PNG Sim Browser** (browses R2) |
| upload.gooderlabs.com | Cloudflare Worker (sim-uploader) | Custom route for same worker |
| ~~png-sim-uploader~~ | DELETED March 5, 2026 | Was redundant with sim-uploader |
| ~~sim-upload~~ | DELETED March 5, 2026 | Was redundant with sim-uploader |
| auction-lister.homebase-9fe.workers.dev | Cloudflare Worker | Auction Lister |
| design-checker.homebase-9fe.workers.dev | Cloudflare Worker | Design Checker |
| itemlens-api.homebase-9fe.workers.dev | Cloudflare Worker | ItemLens API |
| mockup-pack-worker.homebase-9fe.workers.dev | Cloudflare Worker | Mockup Pack Worker |

### Domain on Heroku

| Domain | Points To |
|--------|-----------|
| autogenv2.herokuapp.com (default) | Heroku eco dyno, Node.js — GLSim |

---

## Heroku Config Vars (autogenv2 / GLSim)

| Key | Value |
|-----|-------|
| `BASE_DESIGN_URL` | `https://assets.gooderlabs.com/` |

---

## Cloudflare R2 Buckets

| Bucket | Objects | Size | Custom Domain | Used By |
|--------|---------|------|---------------|---------|
| **mockup-packs** | 3,670 | 306.65 MB | assets.gooderlabs.com | PNG Sim Browser, GLSim (BASE_DESIGN_URL), Lifestyle Generator mockups |
| **media-assets** | 205 | 107.58 MB | None | Auction lot photos — used by Auction Lister worker |
| **whatnot-media** | 0 | 0 B | None | Empty — possibly unused |

---

## DNS Records (gooderlabs.com)

### A Records (all point to droplet 165.22.45.158, Proxied)

gooderlabs.com, lifestyle, lister, listing-optimizer, pipeline, shield, tickets, trends, vault

### Special Records

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | mail | 160.153.54.39 | DNS only |
| R2 | assets | mockup-packs bucket | Proxied |
| CNAME | www | gooderlabs.com | Proxied |
| CNAME | files | files.secureserver.net | Proxied |
| CNAME | email/fax/imap/pop/smtp | secureserver.net | DNS only |

### Email (Google Workspace)

MX records point to aspmx.l.google.com (Google Workspace). SPF configured.

---

## Project-by-Project Breakdown

### 1. GLSim (Image Simulator) — CRITICAL TOOL

| Detail | Value |
|--------|-------|
| **Description** | Image Simulator v2.4 — generates product mockup images |
| **GitHub repo** | kensteam/glsim (Public, JavaScript, 1 branch) |
| **Key files** | app.js (Node.js entry), Procfile (Heroku), package.json, template/, design/, output/ |
| **Heroku app (current)** | `autogenv2` — eco dyno, `web node app.js` |
| **Heroku app history** | `glsim` (4 yrs ago) > `glsimv2` (2 yrs ago) > `autogenv2` (current) |
| **Heroku deploys** | salescounter@gmail.com, currently on v317 |
| **Last commit** | da15a236 "download validation fix" (March 6, 2026) |
| **Heroku config vars** | `BASE_DESIGN_URL` = `https://assets.gooderlabs.com/` |
| **GitHub Desktop** | Listed — re-located to `~/Company digital tools/glsim` |
| **Local folder** | `~/Company digital tools/glsim` (cloned March 5, 2026) |
| **Deploy method** | `cd ~/Company digital tools/glsim && git push` > Heroku auto-deploys from `main` |
| **Dependencies** | Pulls design assets from assets.gooderlabs.com (R2 bucket: mockup-packs) |

**Note:** Heroku app name `autogenv2` doesn't match repo name `glsim`. This is the 3rd Heroku app name. When this tool "gets screwed up," having the local clone lets you test changes before pushing to Heroku.

**IMPORTANT — Known failure mode (fixed March 6, 2026):**
Heroku eco dynos have ephemeral filesystems — every deploy/restart wipes the `design/` and `output/` cache directories. Products with `simKey !== "tee"` (coach, hoodie, workshirt, onesie, hat, lunchbox) try downloading a product-specific sim first (e.g., `2-coach-sim.png`). Most of these don't exist on R2, and prior to v2.4, the Cloudflare 404 HTML error page would be saved as a fake PNG. Sharp would then fail with "unsupported image format" and the Design Checker would go black.

**Three protections now in place (v2.4):**
1. HTTP status check on downloads — 404s are rejected immediately
2. PNG magic bytes validation — only real PNGs (`\x89PNG` header) are saved; corrupted cached files are auto-cleaned
3. `mkdir -p` at startup — ensures `design/` and `output/` directories always exist even if `.gitignore` placeholders are removed

**DO NOT delete `design/.gitignore` or `output/.gitignore`** — these are the only files keeping those directories in the git repo. Without them, Heroku won't create the directories and ALL image generation breaks.

---

### 2. GooderLabs.com + KensTeam.com (Shared Backend)

| Detail | Value |
|--------|-------|
| **Description** | Main company sites — shared Python backend |
| **Hosted on** | Droplet, port 5060, behind Nginx |
| **Domains** | gooderlabs.com, kensteam.com |
| **Local folder** | `~/Company digital tools/Kensteam` |
| **Code on droplet** | Accessible to the Python process on :5060 |
| **Deploy method** | `ssh root@165.22.45.158` > update code > restart Python process |

**Note:** kensteam.com has routes for /api/kensteam/ and /static/ in Nginx config.

---

### 3. Team Hub (gooder-tools)

| Detail | Value |
|--------|-------|
| **Description** | Central dashboard linking all tools |
| **URL** | gooder-tools.pages.dev |
| **Hosted on** | Cloudflare Pages (connected to GitHub, auto-deploys from `main`) |
| **Local folder** | `~/Company digital tools/gooder-tools` |
| **GitHub Desktop** | Listed — re-located |
| **Deploy method** | `git push` to `main` branch — auto-deploys to Cloudflare Pages |

---

### 4. Sim Placer

| Detail | Value |
|--------|-------|
| **Description** | Position designs on product templates |
| **URL** | sim-placer.pages.dev |
| **Hosted on** | Cloudflare Pages (connected to GitHub, auto-deploys from `main`) |
| **Local folder** | `~/Company digital tools/sim-placer` |
| **Deploy method** | `git push` to `main` branch — auto-deploys to Cloudflare Pages |

---

### 5. Sim Uploader / PNG Sim Browser

| Detail | Value |
|--------|-------|
| **Description** | Upload sim images + browse/search design sims from R2 |
| **Browser URL** | sim-uploader.homebase-9fe.workers.dev |
| **Upload URL** | upload.gooderlabs.com |
| **Hosted on** | Cloudflare Worker (`sim-uploader`), 1 R2 binding |
| **Data source** | R2 bucket `mockup-packs` (3,670 PNG sims + lifestyle mockups) |
| **Local folder** | `~/Company digital tools/sim-uploader` |
| **Key files** | worker.js, wrangler.toml |
| **Deploy method** | `cd ~/Company digital tools/sim-uploader && npx wrangler deploy` |
| **CORS fix** | Applied March 5, 2026 — images now served via `/img/` proxy route through worker |

**Related workers:** `png-sim-uploader` and `sim-upload` were deleted March 5, 2026 (redundant).

---

### 6. Auction Lister

| Detail | Value |
|--------|-------|
| **Description** | Multi-platform auction listing CSV |
| **URL** | auction-lister.homebase-9fe.workers.dev |
| **Hosted on** | Cloudflare Worker, 43 requests, 1 binding |
| **Local folder** | `~/Company digital tools/auction-lister` |
| **Deploy method** | `cd ~/Company digital tools/auction-lister && npx wrangler deploy` |

---

### 7. Design Checker

| Detail | Value |
|--------|-------|
| **Description** | Check mockups by design number |
| **URL** | design-checker.homebase-9fe.workers.dev |
| **Hosted on** | Cloudflare Worker, 0 bindings |
| **Deploy method** | `npx wrangler deploy` from project folder |

---

### 8. ItemLens

| Detail | Value |
|--------|-------|
| **Description** | Auction item analysis |
| **GitHub repo** | kensteam/itemlens (Private) |
| **Frontend URL** | itemlens.pages.dev |
| **API URL** | itemlens-api.homebase-9fe.workers.dev |
| **Frontend hosted on** | Cloudflare Pages (NO Git connection) |
| **API hosted on** | Cloudflare Worker |
| **Local folder** | `~/Company digital tools/itemlens` |
| **GitHub Desktop** | Listed (private) — re-located |
| **Deploy method** | Frontend: manual Pages upload. API: `npx wrangler deploy` |

---

### 9. Product Vault

| Detail | Value |
|--------|-------|
| **Description** | Central source of truth — 65K+ SKUs |
| **URL** | vault.gooderlabs.com |
| **Hosted on** | Droplet — static files at /var/www/product-vault/dist |
| **Local folder** | `~/Company digital tools/product-vault` |
| **Deploy method** | Build locally > `scp -r dist/ root@165.22.45.158:/var/www/product-vault/dist` |

---

### 10. Trademark Shield

| Detail | Value |
|--------|-------|
| **Description** | TM monitoring & enforcement |
| **URL** | shield.gooderlabs.com |
| **GitHub repo** | kensteam/trademark-shield (Public, JavaScript) |
| **Hosted on** | Droplet — static files at /var/www/trademark-shield/dist |
| **Local folder** | `~/Company digital tools/trademark-shield` |
| **GitHub Desktop** | Listed — re-located |
| **Deploy method** | Build locally > `scp -r dist/ root@165.22.45.158:/var/www/trademark-shield/dist` |

---

### 11. T-Shirt Lister v2

| Detail | Value |
|--------|-------|
| **Description** | Team t-shirt listing tool |
| **URL** | lister.gooderlabs.com |
| **GitHub repo** | kensteam/tshirt-lister-v2 |
| **Hosted on** | Droplet, Python on port 5055 |
| **Local folder** | `~/Company digital tools/tshirt-lister-v2` |
| **GitHub Desktop** | Listed — re-located |
| **Deploy method** | `ssh root@165.22.45.158` > update code > restart Python on :5055 |

**Also:** `TShirtLister.command` file on Mac — launch shortcut.

---

### 12. Whatnot Lister v2

| Detail | Value |
|--------|-------|
| **Description** | Whatnot platform listing tool |
| **GitHub repo** | kensteam/whatnot-lister-v2 (Public, JavaScript) |
| **Local folder** | `~/Company digital tools/whatnot-lister-v2` |
| **GitHub Desktop** | Listed — re-located |
| **Hosting** | UNKNOWN — not on droplet or Cloudflare. May run locally only. |

---

### 13. Lifestyle Generator

| Detail | Value |
|--------|-------|
| **Description** | AI lifestyle mockups via Nano Banana |
| **URL** | lifestyle.gooderlabs.com |
| **Hosted on** | Droplet, Python on port 5050 |
| **Deploy method** | `ssh root@165.22.45.158` > update code > restart Python on :5050 |

---

### 14. Listing Optimizer

| Detail | Value |
|--------|-------|
| **Description** | AI-powered Amazon listing optimizer |
| **URL** | listing-optimizer.gooderlabs.com |
| **Hosted on** | Droplet, Python on port 5070 |
| **Deploy method** | `ssh root@165.22.45.158` > update code > restart Python on :5070 |

---

### 15. TrendSpotter

| Detail | Value |
|--------|-------|
| **Description** | Real-time trend tracking for shirts |
| **URL** | trends.gooderlabs.com |
| **Hosted on** | Droplet, Docker container on port 8000 |
| **Local folder** | `~/Company digital tools/trendspotter` |
| **Deploy method** | `ssh root@165.22.45.158` > update Docker image/container on :8000 |

---

### 16. Tickets

| Detail | Value |
|--------|-------|
| **Description** | Submit issues & requests |
| **URL** | tickets.gooderlabs.com |
| **Hosted on** | Droplet, Python on port 5061 |
| **Local folder** | `~/Company digital tools/ticket-api` |
| **Deploy method** | `ssh root@165.22.45.158` > update code > restart Python on :5061 |

---

### 17. Big Liquidation

| Detail | Value |
|--------|-------|
| **Description** | Separate site (not on Team Hub) |
| **URL** | big-liquidation.com |
| **Hosted on** | Droplet — static files at /var/www/big-liquidation.com |
| **Local folder** | `~/Company digital tools/big-liquidation` |
| **Deploy method** | `scp -r ~/Company digital tools/big-liquidation/ root@165.22.45.158:/var/www/big-liquidation.com/` |

---

### 18. Mockup Pack Worker

| Detail | Value |
|--------|-------|
| **URL** | mockup-pack-worker.homebase-9fe.workers.dev |
| **Hosted on** | Cloudflare Worker, 1 binding |
| **Deploy method** | `npx wrangler deploy` from project folder |

---

### 19. Design Pipeline (FIXED March 5, 2026)

| Detail | Value |
|--------|-------|
| **Description** | Design image processing — generates sims/mockups, uploads to R2 via boto3 |
| **URL** | pipeline.gooderlabs.com |
| **Hosted on** | Droplet, Flask on port 5056, uses venv |
| **Droplet path** | /opt/design-pipeline |
| **PM2 name** | design-pipeline |
| **PM2 interpreter** | /opt/design-pipeline/venv/bin/python3 |
| **Script** | app.py |
| **R2 credentials** | /opt/design-pipeline/.env |
| **Deploy method** | `ssh root@165.22.45.158` > update code in /opt/design-pipeline > `pm2 restart design-pipeline` |
| **Status** | ONLINE — restored March 5, 2026 |

---

## External Tools (not our code, just links on Team Hub)

| Tool | Description | Notes |
|------|-------------|-------|
| Metal Helper | Metal product calculator | Third-party tool, link only |
| Postoria | Social media scheduling | External SaaS platform, link only |

---

## Local Mac Folders (~/Company digital tools/)

| Folder | Matched To | GitHub Repo |
|--------|-----------|-------------|
| auction-lister | Auction Lister (Cloudflare Worker) | None |
| autogenv2 | OLD copy of GLSim? (duplicate — use `glsim` instead) | N/A |
| big-liquidation | big-liquidation.com (Droplet static) | None |
| glsim | GLSim / Heroku autogenv2 (cloned March 5, 2026) | kensteam/glsim |
| glsim-main | OLD copy of GLSim? (duplicate — use `glsim` instead) | N/A |
| gooder-tools | Team Hub (Cloudflare Pages) | kensteam/gooder-tools |
| itemlens | ItemLens (Cloudflare Pages + Worker) | kensteam/itemlens (private) |
| Kensteam | kensteam.com / gooderlabs.com (Droplet :5060) | None |
| product-vault | Product Vault (Droplet static) | None |
| sim-placer | Sim Placer (Cloudflare Pages) | None |
| sim-uploader | PNG Sim Browser + Uploader (Cloudflare Worker) | None |
| ticket-api | Tickets (Droplet :5061) | None |
| trademark-shield | Trademark Shield (Droplet static) | kensteam/trademark-shield |
| trendspotter | TrendSpotter (Droplet Docker :8000) | None |
| tshirt-lister-v2 | T-Shirt Lister (Droplet :5055) | kensteam/tshirt-lister-v2 |
| TShirtLister.command | Mac launch shortcut | N/A |
| whatnot-lister-v2 | Whatnot Lister (hosting unknown) | kensteam/whatnot-lister-v2 |

**Note:** `autogenv2` and `glsim-main` appear to be older/duplicate copies of GLSim. The canonical copy is now `glsim` (freshly cloned from GitHub). Consider deleting the old folders once confirmed.

---

## GitHub Repos (kensteam org)

| Repo | Visibility | GitHub Desktop | Local Folder |
|------|-----------|----------------|-------------|
| glsim | Public | Yes (re-located) | ~/Company digital tools/glsim |
| gooder-tools | Public | Yes (re-located) | ~/Company digital tools/gooder-tools |
| itemlens | Private | Yes (re-located) | ~/Company digital tools/itemlens |
| trademark-shield | Public | Yes (re-located) | ~/Company digital tools/trademark-shield |
| tshirt-lister-v2 | Public | Yes (re-located) | ~/Company digital tools/tshirt-lister-v2 |
| whatnot-lister-v2 | Public | Yes (re-located) | ~/Company digital tools/whatnot-lister-v2 |

| product-vault | Private | No | ~/Company digital tools/product-vault |
| trendspotter | Private | No | ~/Company digital tools/trendspotter |
| ticket-api | Private | No | ~/Company digital tools/ticket-api |
| sim-placer | Private | No | ~/Company digital tools/sim-placer |
| sim-uploader | Private | No | ~/Company digital tools/sim-uploader |
| kensteam-site | Private | No | ~/Company digital tools/Kensteam |

**Note:** New repos added March 5, 2026. Consider adding them to GitHub Desktop for easy management.

---

## Deployment Quick Reference

### "How do I deploy ___?"

| Project | Command / Steps |
|---------|-------|
| **GLSim** | `cd ~/Company digital tools/glsim && git add . && git commit -m "msg" && git push` (auto-deploys to Heroku) |
| **Team Hub** | `cd ~/Company digital tools/gooder-tools && git push` (auto-deploys to Cloudflare Pages) |
| **Sim Placer** | `cd ~/Company digital tools/sim-placer && git push` (auto-deploys to Cloudflare Pages) |
| **ItemLens frontend** | `cd ~/Company digital tools/itemlens && git push` (likely auto-deploys to Cloudflare Pages) |
| **ItemLens API** | `cd ~/Company digital tools/itemlens && npx wrangler deploy` |
| **Sim Uploader/PNG Browser** | `cd ~/Company digital tools/sim-uploader && npx wrangler deploy` |
| **Auction Lister** | `npx wrangler deploy` from project folder |
| **Design Checker** | `npx wrangler deploy` from project folder |
| **Mockup Pack Worker** | `npx wrangler deploy` from project folder |
| **Product Vault** | Build locally > `scp -r dist/ root@165.22.45.158:/var/www/product-vault/dist` |
| **Trademark Shield** | Build locally > `scp -r dist/ root@165.22.45.158:/var/www/trademark-shield/dist` |
| **Big Liquidation** | `scp` files to `root@165.22.45.158:/var/www/big-liquidation.com/` |
| **T-Shirt Lister** | `ssh root@165.22.45.158` > update code > `pm2 restart tshirt-lister` |
| **Lifestyle Generator** | `ssh root@165.22.45.158` > update code > `pm2 restart lifestyle-generator` |
| **Listing Optimizer** | `ssh root@165.22.45.158` > update code > `pm2 restart listing-optimizer` |
| **Tickets** | `ssh root@165.22.45.158` > update code > `pm2 restart ticket-api` |
| **Design Pipeline** | `ssh root@165.22.45.158` > update code in /opt/design-pipeline > `pm2 restart design-pipeline` |
| **TrendSpotter** | `ssh root@165.22.45.158` > update/restart Docker container on :8000 |
| **KensTeam/GooderLabs** | `ssh root@165.22.45.158` > update code > `pm2 restart gooderlabs-site` |

---

## For Claude / AI Assistants

When Ken asks you to work on a project, use this document to understand where code lives and how to deploy. Key context:

- **GitHub org:** kensteam
- **Cloudflare zone:** homebase-9fe (workers), Pages for frontends
- **Custom domains:** gooderlabs.com (droplet + some Cloudflare routes), kensteam.com (droplet), big-liquidation.com (droplet)
- **Local code:** `~/Company digital tools/[project-name]`
- **Droplet SSH:** `ssh root@165.22.45.158` — Nginx reverse proxy, Python services + 1 Docker container
- **Heroku:** Only GLSim (app: autogenv2), deploys from salescounter@gmail.com, config var `BASE_DESIGN_URL=https://assets.gooderlabs.com/`
- **R2 storage:** `mockup-packs` bucket serves design assets at assets.gooderlabs.com — used by GLSim and PNG Sim Browser
- **PM2 on droplet** — all 6 Python services managed by PM2 with auto-restart. Use `pm2 restart [name]` after code updates. Config at `/root/ecosystem.config.js`.
- **Cloudflare Pages sites** — gooder-tools and sim-placer ARE connected to GitHub (auto-deploy from `main`). Check itemlens.

---

## Completed Fixes

### March 6, 2026

9. **GLSim "black images" bug fixed (v2.4)** — Design Checker showed black images for coach jackets, hoodies, workshirts, onesies, and other non-tee products after every Heroku deploy/restart. Root cause: `downloadImage()` didn't check HTTP status codes, so Cloudflare 404 HTML error pages (>7000 bytes) were saved as PNG files. Sharp then failed on the HTML with "unsupported image format," falling back to a 1x1 black pixel. Fix adds HTTP status validation, PNG magic bytes checking, corrupted cache auto-cleanup, and `mkdir -p` safety at startup. Heroku v317, commit da15a236.

### March 5, 2026

1. **GitHub Desktop paths fixed** — All 6 repos re-located from `~/Projects` to `~/Company digital tools`
2. **GLSim cloned locally** — Now at `~/Company digital tools/glsim` (was only on GitHub/Heroku before)
3. **PNG Sim Browser CORS fix** — Worker updated to serve images via `/img/` proxy route instead of loading cross-origin from assets.gooderlabs.com. Deployed via `npx wrangler deploy`.
4. **PM2 installed on droplet** — All 6 Python services now managed by PM2 with auto-restart on reboot.
5. **Design Pipeline restored** — pipeline.gooderlabs.com back online, added to PM2 with venv interpreter.
6. **Ports secured** — All Python services bound to 127.0.0.1 (no more direct IP access bypassing Nginx/SSL). Design-pipeline venv rebuilt.
7. **51 system updates applied** — All packages updated, system rebooted, PM2 auto-restored all 6 services.
8. **Missing repos added to GitHub** — product-vault, trendspotter, ticket-api, sim-placer, sim-uploader, kensteam-site all pushed as private repos.

---

## Remaining Action Items

### Critical
1. ~~pipeline.gooderlabs.com is DOWN~~ **FIXED March 5, 2026** — Service restored and added to PM2.
2. ~~Security: bind services to 127.0.0.1~~ **FIXED March 5, 2026** — All Python services now bound to 127.0.0.1. Design-pipeline venv rebuilt with Pillow/Flask/boto3.

### Important
3. ~~Install PM2~~ **DONE** — PM2 installed and configured with startup on reboot.
4. ~~51 updates pending + system restart required~~ **DONE March 5, 2026** — Updates applied, rebooted.
5. ~~Add missing repos to GitHub~~ **DONE March 5, 2026** — Created private repos: product-vault, trendspotter, ticket-api, sim-placer, sim-uploader, kensteam-site.
6. ~~Consolidate sim workers~~ **DONE March 5, 2026** — Deleted `png-sim-uploader` and `sim-upload` (unused). `sim-uploader` is the single worker for PNG Sim Browser + upload.
7. ~~Map media-assets R2 bucket~~ **DONE March 5, 2026** — Contains auction lot photos used by Auction Lister worker.

### Nice to Have
8. ~~Connect Cloudflare Pages to GitHub~~ **Already connected** — gooder-tools and sim-placer both deploy from `main` branch. Itemlens likely same. Audit was incorrect.
9. **Rename Heroku app** — `autogenv2` to `glsim` for clarity. (Optional — nothing references the old name, safe to rename or leave as-is.)
