# glsim — Image Simulator

Mockup image generator that composites design artwork onto product template photos. Built with Node.js, Express, and Sharp.

Originally coded by **cjcanlas01**.

---

## What It Does

glsim takes a transparent design PNG and overlays it onto a product template JPG (flat-lay mockup photo) to produce a finished product mockup image. This is the **autogen** system — given a product type, color, and design number, it returns a composited JPG on the fly.

The lister apps (e.g. tshirt-lister-v2) call glsim's `/autogen` endpoint to get mockup images for Sellbrite/Amazon CSV exports. glsim does **not** handle listing logic, CSV generation, or lifestyle images — it only produces flat mockup composites.

---

## How It Works

1. A request comes in for a file like `tee-black-42.jpg`
2. glsim parses the filename to extract the product prefix, color, and design number
3. It finds the matching template JPG (e.g. `template/tee-black.jpg`)
4. It downloads the design PNG from the design server
5. It composites the design onto the template using Sharp, auto-resizing if needed
6. It caches the result in the `output/` folder and serves it

---

## Endpoints

### `GET /autogen/:file`
Generate (or serve cached) a mockup image.

**file format:** `{prefix}-{color}-{designNumber}.jpg`

Examples: `tee-black-42.jpg`, `hoodie-navy-108.jpg`, `ring-royal-55.jpg`

Returns a JPG image. Falls back to `template/fallback.jpg` on error or timeout.

### `GET /bust/:file`
Cache-bust a single mockup. Deletes cached output + design files, then regenerates.

### `GET /bust-design/:designNum`
Cache-bust ALL cached mockups for a given design number.

### `GET /`
Health check. Returns version string.

---

## Product Prefixes

Every template filename starts with a product prefix:

| Category | Prefixes |
|---|---|
| **Tees** | tee, teeback |
| **Pocket Tees** | 5300 |
| **Long Sleeve** | lstee, lsteeback |
| **LS Hoodie** | lsteehoodie, lsteehoodieback |
| **Performance** | performancelstee, performancelsteeback |
| **Hoodies** | hoodie, hoodieback, jha009, jha009back |
| **Youth Hoodies** | ythhoodie, ythhoodieback |
| **Toddler Hoodies** | toddlerhoodie, toddlerhoodieback |
| **Sweatshirts** | sweat, sweatback |
| **Youth Sweatshirts** | youthsweat, youthsweatback |
| **Toddler Sweatshirts** | toddlersweat, toddlersweatback |
| **Coach Jacket** | coach, coachback |
| **Work Shirt** | workshirt, workshirtback |
| **Tanks** | tank, tankback |
| **Sleeveless** | sleeveless, sleevelessback |
| **Ringers** | ring, ringback |
| **Raglans** | raglan, raglanback |
| **Ladies V-Neck (64V00L)** | 64v00l, 64v00lback |
| **Ladies Boyfriend Tee (NL3900)** | nl3900, nl3900back |
| **Ladies Racerback (NL6733)** | nl6733 |
| **Next Level Toddler** | nltbtee |
| **Onesie** | onesie |
| **Youth Tee** | youthtee, youthteeback |
| **Toddler Tee** | toddlertee, toddlerteeback |
| **Tie Dye** | td1000 |
| **Bags** | tote, sportbag, lunchbox |
| **Hats** | trucker, ottowashed6p |
| **Realistic Mockups** | g5000real, g5000realb, g5000realc |

### Sim Key Mapping

Products with unique garment shapes get their own sim key for product-specific design PNGs. Everything else falls back to the generic tee sim:

- hoodie → hoodie, jha009, sweat, youth/toddler sweat, youth/toddler hoodie, lsteehoodie
- coach → coach
- workshirt → workshirt
- onesie → onesie
- lunchbox → lunchbox
- hat → trucker, ottowashed6p
- tee → everything else (tee, lstee, tank, ring, raglan, 64v00l, nl3900, nl6733, bags, etc.)

---

## Project Structure

- app.js — Express server, all routing and image generation logic
- package.json — Dependencies (express, sharp, node-fetch, dotenv)
- Procfile — Heroku deployment config
- template/ — Product template JPGs (flat-lay photos per product+color)
- template/static_assets/ — Brand cards and other static overlay images
- design/ — Downloaded design PNGs (cached from design server)
- output/ — Generated composite mockups (cached)
- td1000-*.jpg — Tie dye background textures (root level)

---

## Environment Variables

- PORT — Server port (set by Heroku)
- BASE_DESIGN_URL — Base URL where design PNGs are hosted (currently assets.gooderlabs.com)

---

## Deployment

glsim runs on Heroku (app: autogenv2). Auto-deploys when you push to main:

cd ~/Company digital tools/glsim && git add . && git commit -m "msg" && git push

Current production deployment: autogenv2 on Heroku eco dyno.

---

## Adding New Templates

1. Create template JPGs named {prefix}-{color}.jpg
2. Place them in the template/ folder
3. If the prefix is new, add it to PRODUCT_PREFIXES in app.js
4. If the product needs a unique sim key, add it to PRODUCT_TO_SIM_KEY
5. Push to main (auto-deploys to Heroku)

---

## Relationship to tshirt-lister-v2

glsim and the lister are separate systems that don't run together:

1. glsim generates mockup images on demand via HTTP
2. tshirt-lister-v2 builds Sellbrite CSV files and constructs autogen URLs that point to glsim

The lister calls glsim's /autogen endpoint to get image URLs. For a substrate to work end-to-end, it must exist in both:
- glsim: template JPGs + product prefix in app.js
- lister: substrate entry in config.json with matching mockup_prefix

---

## Timeout and Fallback

- Generation timeout: 15 seconds
- If generation fails or times out, returns template/fallback.jpg
- Design PNGs smaller than 7KB are rejected (likely error pages)
- Auto-resize: if a design PNG is larger than the template, it is resized to fit before compositing
