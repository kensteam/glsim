require("dotenv").config();
const fetch = require("node-fetch");
const express = require("express");
const sharp = require("sharp");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");
const server = express();
server.use((req, res, next) => { res.set("Access-Control-Allow-Origin", "*"); next(); });

const root = (dir) => path.join(__dirname, dir);
const designFolder = (file) => `design/${file}`;
const templateFolder = (file) => `template/${file}`;
const outputFolder = (file) => `output/${file}`;
const JPGExt = (file) => `${file}.jpg`;
const FALLBACK_JPG = root("template/fallback.jpg");
const GENERATION_TIMEOUT_MS = 15000;

/**
 * PRODUCT PREFIX MAP
 */
const PRODUCT_PREFIXES = [
  "hoodie", "hoodieback", "ythhoodie", "ythhoodieback",
  "toddlerhoodie", "toddlerhoodieback", "jha009", "jha009back",
  "coach", "coachback",
  "workshirt", "workshirtback",
  "sweat", "sweatback", "youthsweat", "youthsweatback",
  "toddlersweat", "toddlersweatback",
  "onesie",
  "lstee", "lsteeback", "lsteehoodie", "lsteehoodieback",
  "performancelstee", "performancelsteeback",
  "tank", "tankback",
  "sleeveless", "sleevelessback",
  "raglan", "raglanback",
  "ring", "ringback",
  "nl6733", "nl3900", "nl3900back",
  "64v00l", "64v00lback",
  "youthtee", "youthteeback",
  "toddlertee", "toddlerteeback",
  "lunchbox",
  "tote", "sportbag",
  "5300",
  "nltbtee",
  "tee", "teeback",
  "td1000",
  "trucker",
  "ottowashed6p",
  "g5000real", "g5000realb", "g5000realc",
];

function getProductFromTemplate(templateName) {
  const lower = templateName.toLowerCase();
  const sorted = PRODUCT_PREFIXES.slice().sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (lower.startsWith(prefix + "-") || lower === prefix) {
      return prefix;
    }
  }
  return null;
}

const PRODUCT_TO_SIM_KEY = {
  "tee": "tee", "teeback": "tee",
  "hoodie": "hoodie", "hoodieback": "hoodie",
  "jha009": "hoodie", "jha009back": "hoodie",
  "ythhoodie": "hoodie", "ythhoodieback": "hoodie",
  "toddlerhoodie": "hoodie", "toddlerhoodieback": "hoodie",
  "coach": "coach", "coachback": "coach",
  "workshirt": "workshirt", "workshirtback": "workshirt",
  "sweat": "hoodie", "sweatback": "hoodie",
  "youthsweat": "hoodie", "youthsweatback": "hoodie",
  "toddlersweat": "hoodie", "toddlersweatback": "hoodie",
  "onesie": "onesie",
  "lstee": "tee", "lsteeback": "tee",
  "lsteehoodie": "hoodie", "lsteehoodieback": "hoodie",
  "performancelstee": "tee", "performancelsteeback": "tee",
  "tank": "tee", "tankback": "tee",
  "sleeveless": "tee", "sleevelessback": "tee",
  "raglan": "tee", "raglanback": "tee",
  "ring": "tee", "ringback": "tee",
  "nl6733": "tee",
  "nl3900": "tee", "nl3900back": "tee",
  "64v00l": "tee", "64v00lback": "tee",
  "youthtee": "tee", "youthteeback": "tee",
  "toddlertee": "tee", "toddlerteeback": "tee",
  "5300": "tee",
  "nltbtee": "tee",
  "td1000": "tee",
  "lunchbox": "lunchbox",
  "tote": "tee",
  "sportbag": "tee",
  "trucker": "hat",
  "ottowashed6p": "hat",
  "g5000real": "tee", "g5000realb": "tee", "g5000realc": "tee",
};

const sendFallback = (res) => {
  res.type("jpg").status(200).sendFile(FALLBACK_JPG);
};

const withTimeout = (promise, ms) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
};

const checkIfFileExists = (file) => {
  return new Promise((resolve) => {
    fs.access(file, fs.constants.F_OK, (err) => { resolve(err == null); });
  });
};

const createImage = (path, data) => {
  return new Promise((resolve) => {
    fs.writeFile(path, data, (err) => { resolve(err == null); });
  });
};

const generateDownloadLink = (file) =>
  new URL(`${process.env.BASE_DESIGN_URL}${file}`);

const downloadImage = async (url, fileName) => {
  const image = await fetch(new URL(url));
  const buffer = await image.buffer();
  const filePath = root(designFolder(fileName));
  try {
    if (buffer.length < 7000) return false;
    const isCreated = await createImage(filePath, buffer);
    if (isCreated) return true;
    return false;
  } catch (err) {
    console.log(err);
  }
};

const tryDownloadDesign = async (designFile) => {
  const localDesign = root(designFolder(designFile));
  const isFileExist = await checkIfFileExists(localDesign);
  if (isFileExist) return true;
  try {
    const designLink = generateDownloadLink(designFile);
    const isDownloaded = await downloadImage(designLink, designFile);
    return isDownloaded;
  } catch (err) {
    return false;
  }
};

/**
 * ═══════════════════════════════════════════════════════
 * GENERATE IMAGE — WITH AUTO-RESIZE FIX
 * ═══════════════════════════════════════════════════════
 * This is the critical fix: before compositing, we check if the
 * design PNG is larger than the template and resize it to fit.
 * This prevents sharp from failing silently and producing black images.
 */
const generateImage = async (file) => {
  const indexSeparator = file.indexOf("-", file.indexOf("-") + 1);
  const templateFile = JPGExt(file.slice(0, indexSeparator));
  const designNumber = file.slice(indexSeparator + 1).replace(".jpg", "");
  const templateName = file.slice(0, indexSeparator);
  const localTemplate = root(templateFolder(templateFile));
  const output = root(outputFolder(file));

  try {
    const product = getProductFromTemplate(templateName);
    const simKey = product ? (PRODUCT_TO_SIM_KEY[product] || null) : null;

    let designFile = null;
    let localDesign = null;

    // Strategy 1: Try product-specific sim file
    if (simKey && simKey !== "tee") {
      const productSimFile = `${designNumber}-${simKey}-sim.png`;
      const downloaded = await tryDownloadDesign(productSimFile);
      if (downloaded) {
        designFile = productSimFile;
        localDesign = root(designFolder(productSimFile));
        console.log(`[autogen] using product sim: ${productSimFile}`);
      }
    }

    // Strategy 2: Fall back to generic sim file
    if (!designFile) {
      const genericFile = `${designNumber}.png`;
      const localGeneric = root(designFolder(genericFile));
      const isFileExist = await checkIfFileExists(localGeneric);
      if (!isFileExist) {
        const designLink = generateDownloadLink(genericFile);
        const isDownloaded = await downloadImage(designLink, genericFile);
        if (!isDownloaded) return false;
      }
      designFile = genericFile;
      localDesign = localGeneric;
    }

    // ════════════════════════════════════════════════
    // AUTO-RESIZE FIX: Get template dimensions, then
    // resize design to fit BEFORE compositing.
    // This is the fix that prevents black images when
    // the design PNG is larger than the template.
    // ════════════════════════════════════════════════
    const templateMeta = await sharp(localTemplate).metadata();
    const designMeta = await sharp(localDesign).metadata();

    console.log(`[autogen] template: ${templateMeta.width}x${templateMeta.height}, design: ${designMeta.width}x${designMeta.height}`);

    let compositeInput;

    if (designMeta.width > templateMeta.width || designMeta.height > templateMeta.height) {
      // Design is bigger than template — resize to fit within template bounds
      console.log(`[autogen] resizing design to fit template (${templateMeta.width}x${templateMeta.height})`);
      compositeInput = await sharp(localDesign)
        .resize(templateMeta.width, templateMeta.height, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    } else {
      // Design fits — use as-is
      compositeInput = localDesign;
    }

    const image = await sharp(localTemplate)
      .composite([{ input: compositeInput }])
      .toFile(output);

    return image;
  } catch (err) {
    console.log(`[autogen] generateImage error: ${err.message}`);
    console.log(err.stack);
  }
};

server.get("/autogen/:file", async (req, res) => {
  const fileName = req.params.file;
  const outputFile = root(outputFolder(fileName));
  try {
    const isFileExist = await checkIfFileExists(outputFile);
    if (isFileExist) {
      return res.type("jpg").sendFile(outputFile);
    }

    console.log(`[autogen] generating: ${fileName}`);
    const start = Date.now();
    const output = await withTimeout(generateImage(fileName), GENERATION_TIMEOUT_MS);
    const duration = Date.now() - start;

    if (output) {
      console.log(`[autogen] done: ${fileName} (${duration}ms)`);
      return res.type("jpg").sendFile(outputFile);
    }

    console.log(`[autogen] failed (no output): ${fileName} (${duration}ms)`);
    return sendFallback(res);
  } catch (err) {
    console.log(`[autogen] error: ${fileName} - ${err.message}`);
    return sendFallback(res);
  }
});

/**
 * Cache bust single file
 */
server.get("/bust/:file", async (req, res) => {
  const fileName = req.params.file;
  const outputFile = root(outputFolder(fileName));
  const designNumber = fileName.slice(fileName.indexOf("-", fileName.indexOf("-") + 1) + 1).replace(".jpg", "");

  try {
    if (await checkIfFileExists(outputFile)) fs.unlinkSync(outputFile);

    const designDir = root("design");
    const designFiles = fs.readdirSync(designDir).filter(f => f.startsWith(designNumber));
    designFiles.forEach(f => { try { fs.unlinkSync(path.join(designDir, f)); } catch(e) {} });

    const start = Date.now();
    const output = await withTimeout(generateImage(fileName), GENERATION_TIMEOUT_MS);
    const duration = Date.now() - start;

    if (output) {
      console.log(`[bust] regenerated: ${fileName} (${duration}ms)`);
      return res.type("jpg").sendFile(root(outputFolder(fileName)));
    }
    return sendFallback(res);
  } catch (err) {
    console.log(`[bust] failed: ${fileName} - ${err.message}`);
    return sendFallback(res);
  }
});

/**
 * Bust ALL cached mockups for a design number
 */
server.get("/bust-design/:designNum", async (req, res) => {
  const designNum = req.params.designNum;
  let deletedOutput = 0, deletedDesign = 0;

  try {
    const outputDir = root("output");
    if (fs.existsSync(outputDir)) {
      fs.readdirSync(outputDir).filter(f => f.endsWith(`-${designNum}.jpg`)).forEach(f => {
        try { fs.unlinkSync(path.join(outputDir, f)); deletedOutput++; } catch(e) {}
      });
    }

    const designDir = root("design");
    if (fs.existsSync(designDir)) {
      fs.readdirSync(designDir).filter(f => f.startsWith(designNum + '.') || f.startsWith(designNum + '-')).forEach(f => {
        try { fs.unlinkSync(path.join(designDir, f)); deletedDesign++; } catch(e) {}
      });
    }

    console.log(`[bust-design] Cleared design ${designNum}: ${deletedOutput} outputs, ${deletedDesign} design files`);
    res.json({ success: true, designNum, deletedOutput, deletedDesign,
      message: `Cleared ${deletedOutput} mockups and ${deletedDesign} design files for design ${designNum}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

server.get("/", async (req, res) => {
  res.send("Hello from template simulation app! v2.3 — auto-resize fix");
});

server.listen(process.env.PORT, () => {
  console.log(`Server listening at ${process.env.PORT}`);
});
