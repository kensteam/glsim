require("dotenv").config();
const fetch = require("node-fetch");
const express = require("express");
const sharp = require("sharp");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");
const server = express();

const root = (dir) => path.join(__dirname, dir);
const designFolder = (file) => `design/${file}`;
const templateFolder = (file) => `template/${file}`;
const outputFolder = (file) => `output/${file}`;
const JPGExt = (file) => `${file}.jpg`;
const FALLBACK_JPG = root("template/fallback.jpg");
const GENERATION_TIMEOUT_MS = 10000;

// Limit sharp memory/concurrency for Heroku 512MB dyno
sharp.concurrency(1);
sharp.cache({ memory: 50, files: 20, items: 100 });

const PRODUCT_PREFIXES = [
  "hoodie", "hoodieback", "ythhoodie", "ythhoodieback",
  "toddlerhoodie", "toddlerhoodieback", "jha009", "jha009back",
  "coach", "coachback", "workshirt", "workshirtback",
  "sweat", "sweatback", "youthsweat", "youthsweatback",
  "toddlersweat", "toddlersweatback",
  "onesie",
  "lstee", "lsteeback", "lsteehoodie", "lsteehoodieback",
  "performancelstee", "performancelsteeback",
  "tank", "tankback", "sleeveless", "sleevelessback",
  "raglan", "raglanback", "ring", "ringback",
  "nl6733", "nl3900", "nl3900back", "64v00l", "64v00lback",
  "youthtee", "youthteeback", "toddlertee", "toddlerteeback",
  "lunchbox", "tote", "sportbag", "5300", "nltbtee",
  "tee", "teeback", "td1000",
  "trucker", "ottowashed6p",
  "g5000real", "g5000realb", "g5000realc",
];

function getProductFromTemplate(templateName) {
  const lower = templateName.toLowerCase();
  const sorted = PRODUCT_PREFIXES.slice().sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (lower.startsWith(prefix + "-") || lower === prefix) return prefix;
  }
  return null;
}

const PRODUCT_TO_PLACEMENT = {
  "tee":"tee","teeback":"tee","nltbtee":"tee","5300":"tee",
  "lstee":"tee","lsteeback":"tee",
  "performancelstee":"tee","performancelsteeback":"tee",
  "tank":"tee","tankback":"tee","sleeveless":"tee","sleevelessback":"tee",
  "raglan":"tee","raglanback":"tee","ring":"tee","ringback":"tee",
  "nl6733":"tee","nl3900":"tee","nl3900back":"tee",
  "64v00l":"tee","64v00lback":"tee",
  "youthtee":"tee","youthteeback":"tee",
  "toddlertee":"tee","toddlerteeback":"tee",
  "td1000":"tee","g5000real":"tee","g5000realb":"tee","g5000realc":"tee",
  "tote":"tee",
  "hoodie":"hoodie","hoodieback":"hoodie",
  "jha009":"hoodie","jha009back":"hoodie",
  "ythhoodie":"hoodie","ythhoodieback":"hoodie",
  "toddlerhoodie":"hoodie","toddlerhoodieback":"hoodie",
  "lsteehoodie":"hoodie","lsteehoodieback":"hoodie",
  "sweat":"sweat","sweatback":"sweat",
  "youthsweat":"sweat","youthsweatback":"sweat",
  "toddlersweat":"sweat","toddlersweatback":"sweat",
  "coach":"coach","coachback":"coach",
  "workshirt":"coach","workshirtback":"coach",
  "onesie":"onesie",
  "lunchbox":"lunchbox",
  "sportbag":"sportbag",
  "trucker":"hat","ottowashed6p":"hat",
};

// Placement specs (canvas 826x1011)
const PL = {
  tee:       { r:false },
  hoodie:    { r:true, w:0.50,  y:0.24, h:0.38 },
  sweat:     { r:true, w:0.445, y:0.23, h:0.52 },
  coach:     { r:true, w:0.190, y:0.28, h:0.156, lc:true, x:0.55 },
  onesie:    { r:true, w:0.40,  y:0.17, h:0.48 },
  lunchbox:  { r:true, w:0.75,  y:0.21, h:0.43 },
  sportbag:  { r:true, w:0.55,  y:0.29, h:0.48 },
  hat:       { r:true, w:0.35,  y:0.22, h:0.30 },
};

const CW = 826, CH = 1011;

const sendFallback = (res) => res.type("jpg").status(200).sendFile(FALLBACK_JPG);

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms);
  promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
});

const fileExists = (f) => new Promise(r => fs.access(f, fs.constants.F_OK, e => r(!e)));

const writeFile = (p, d) => new Promise(r => fs.writeFile(p, d, e => r(!e)));

const downloadImage = async (url, fileName) => {
  try {
    const resp = await fetch(new URL(url));
    const buf = await resp.buffer();
    if (buf.length < 7000) return false;
    return await writeFile(root(designFolder(fileName)), buf);
  } catch (e) { return false; }
};

const generateImage = async (file) => {
  const sep = file.indexOf("-", file.indexOf("-") + 1);
  const tplFile = JPGExt(file.slice(0, sep));
  const dNum = file.slice(sep + 1).replace(".jpg", "");
  const tplName = file.slice(0, sep);
  const localTpl = root(templateFolder(tplFile));
  const output = root(outputFolder(file));

  try {
    // Get generic sim
    const gFile = `${dNum}.png`;
    const localG = root(designFolder(gFile));
    if (!(await fileExists(localG))) {
      const ok = await downloadImage(new URL(`${process.env.BASE_DESIGN_URL}${gFile}`), gFile);
      if (!ok) return false;
    }

    const product = getProductFromTemplate(tplName);
    const pk = product ? (PRODUCT_TO_PLACEMENT[product] || "tee") : "tee";
    const cfg = PL[pk];

    if (!cfg || !cfg.r) {
      // Tee — original behavior, composite as-is
      return await sharp(localTpl).composite([{ input: localG }]).toFile(output);
    }

    // Reposition: trim design from sim, resize, composite at new position
    const trimInfo = await sharp(localG).trim().toBuffer({ resolveWithObject: true });
    const dw = trimInfo.info.width, dh = trimInfo.info.height;

    const maxW = Math.round(CW * cfg.w);
    const maxH = Math.round(CH * cfg.h);
    const sc = Math.min(maxW / dw, maxH / dh);
    const tw = Math.round(dw * sc), th = Math.round(dh * sc);

    const resized = await sharp(trimInfo.data).resize(tw, th, { fit: "inside" }).png().toBuffer();

    const top = Math.round(CH * cfg.y);
    const left = cfg.lc ? Math.round(CW * cfg.x) : Math.round((CW - tw) / 2);

    const img = await sharp(localTpl).composite([{ input: resized, top, left }]).toFile(output);
    console.log(`[v4.1] ${pk}: ${file} ${tw}x${th}@${left},${top}`);
    return img;

  } catch (e) {
    console.log(`[v4.1] err: ${file} - ${e.message}`);
    return false;
  }
};

server.get("/autogen/:file", async (req, res) => {
  const fn = req.params.file;
  const out = root(outputFolder(fn));
  try {
    if (await fileExists(out)) return res.type("jpg").sendFile(out);
    const r = await withTimeout(generateImage(fn), GENERATION_TIMEOUT_MS);
    if (r) return res.type("jpg").sendFile(out);
    return sendFallback(res);
  } catch (e) {
    console.log(`[autogen] ${fn}: ${e.message}`);
    return sendFallback(res);
  }
});

server.get("/bust/:file", async (req, res) => {
  const fn = req.params.file;
  const out = root(outputFolder(fn));
  const dNum = fn.slice(fn.indexOf("-", fn.indexOf("-") + 1) + 1).replace(".jpg", "");
  try {
    if (await fileExists(out)) fs.unlinkSync(out);
    const dd = root("design");
    fs.readdirSync(dd).filter(f => f.startsWith(dNum)).forEach(f => {
      try { fs.unlinkSync(path.join(dd, f)); } catch(e) {}
    });
    const r = await withTimeout(generateImage(fn), GENERATION_TIMEOUT_MS);
    if (r) return res.type("jpg").sendFile(root(outputFolder(fn)));
    return sendFallback(res);
  } catch (e) {
    console.log(`[bust] ${fn}: ${e.message}`);
    return sendFallback(res);
  }
});

server.get("/bust-all/:dNum", async (req, res) => {
  const dNum = req.params.dNum;
  try {
    let c = 0;
    const dd = root("design");
    fs.readdirSync(dd).filter(f => f.startsWith(dNum)).forEach(f => {
      try { fs.unlinkSync(path.join(dd, f)); c++; } catch(e) {}
    });
    const od = root("output");
    fs.readdirSync(od).filter(f => f.includes(`-${dNum}.jpg`)).forEach(f => {
      try { fs.unlinkSync(path.join(od, f)); c++; } catch(e) {}
    });
    res.json({ success: true, cleared: c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

server.get("/", (req, res) => {
  res.send("Hello from template simulation app! v4.1 — per-product repositioning (lightweight)");
});

server.listen(process.env.PORT, () => console.log(`Listening on ${process.env.PORT}`));
