require("dotenv").config();
const fetch = require("node-fetch");
const express = require("express");
const sharp = require("sharp");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");
const server = express();
server.use((req, res, next) => { res.set("Access-Control-Allow-Origin", "*"); next(); });
/**
 * Helper functions for
 * creating directory paths
 * or file names/ extensions
 */
const root = (dir) => path.join(__dirname, dir);
const designFolder = (file) => `design/${file}`;
const templateFolder = (file) => `template/${file}`;
const outputFolder = (file) => `output/${file}`;
const JPGExt = (file) => `${file}.jpg`;
const FALLBACK_JPG = root("template/fallback.jpg");
const GENERATION_TIMEOUT_MS = 10000;

/**
 * ═══════ PRODUCT PREFIX MAP ═══════
 * Maps the first part of the template filename to a product type
 * used for looking up product-specific sim files.
 * e.g. "hoodie-black.jpg" → product is "hoodie"
 *      "coach-navy.jpg"   → product is "coach"
 *      "tee-red.jpg"      → product is "tee"
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

/**
 * Extract product type from the template filename.
 * Returns the product prefix that matches.
 * e.g. "hoodie-black" → "hoodie"
 *      "workshirt-navy" → "workshirt"
 *      "tee-red" → "tee"
 */
function getProductFromTemplate(templateName) {
  // templateName is like "hoodie-black" (no extension)
  const lower = templateName.toLowerCase();
  // Sort by length descending so longer prefixes match first
  // (e.g. "hoodieback" before "hoodie", "workshirt" before "work")
  const sorted = PRODUCT_PREFIXES.slice().sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (lower.startsWith(prefix + "-") || lower === prefix) {
      return prefix;
    }
  }
  return null;
}

/**
 * Map product prefixes to the sim file product key used by Design Pipeline.
 * The pipeline generates sims named like: 4001-tee-sim.png, 4001-hoodie-sim.png
 * Multiple autogen prefixes map to the same pipeline product.
 */
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

/**
 * Send the fallback placeholder JPEG
 */
const sendFallback = (res) => {
  res.type("jpg").status(200).sendFile(FALLBACK_JPG);
};

/**
 * Wrap a promise with a timeout
 */
const withTimeout = (promise, ms) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
};

/**
 * Check if file exists
 *
 * @param {string} file
 * @returns {Promise}
 */
const checkIfFileExists = (file) => {
  return new Promise((resolve, reject) => {
    fs.access(file, fs.constants.F_OK, (err) => {
      if (err == null) {
        resolve(true);
      }
      resolve(false);
    });
  });
};

/**
 * Create image from downloaded image file
 *
 * @param {string} path
 * @param {string} data
 * @returns {Promise}
 */
const createImage = (path, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, (err) => {
      if (err == null) {
        resolve(true);
      }

      resolve(false);
    });
  });
};

/**
 * Generate download link
 * add base url to file name
 *
 * @param {array} file
 * @returns array
 */
const generateDownloadLink = (file) =>
  new URL(`${process.env.BASE_DESIGN_URL}${file}`);

/**
 * Download image from source url
 *
 * @param {string} url
 * @param {string} fileName
 * @return {boolean}
 */
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

/**
 * Try to download a design file, return true if successful
 */
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
 * Generate image
 * NOW SUPPORTS PER-PRODUCT SIM FILES:
 * 1. Parse the request to get template name and design number
 * 2. Determine the product type from the template name
 * 3. Try product-specific sim first (e.g. 4001-hoodie-sim.png)
 * 4. Fall back to generic sim (e.g. 4001.png)
 *
 * @param {string} file
 * @returns {boolean or object}
 */
const generateImage = async (file) => {
  const indexSeparator = file.indexOf("-", file.indexOf("-") + 1);
  const templateFile = JPGExt(file.slice(0, indexSeparator));
  const designNumber = file.slice(indexSeparator + 1).replace(".jpg", "");
  const templateName = file.slice(0, indexSeparator);
  const localTemplate = root(templateFolder(templateFile));
  const output = root(outputFolder(file));

  try {
    // Determine which product this is
    const product = getProductFromTemplate(templateName);
    const simKey = product ? (PRODUCT_TO_SIM_KEY[product] || null) : null;

    let designFile = null;
    let localDesign = null;

    // Strategy 1: Try product-specific sim file (e.g. "4001-hoodie-sim.png")
    if (simKey && simKey !== "tee") {
      const productSimFile = `${designNumber}-${simKey}-sim.png`;
      const downloaded = await tryDownloadDesign(productSimFile);
      if (downloaded) {
        designFile = productSimFile;
        localDesign = root(designFolder(productSimFile));
        console.log(`[autogen] using product sim: ${productSimFile}`);
      }
    }

    // Strategy 2: Fall back to generic sim file (e.g. "4001.png")
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

    const image = await sharp(localTemplate)
      .composite([{ input: localDesign }])
      .toFile(output);

    return image;
  } catch (err) {
    console.log(err);
  }
};

server.get("/autogen/:file", async (req, res) => {
  const fileName = req.params.file;
  const outputFile = root(outputFolder(fileName));
  try {
    const isFileExist = await checkIfFileExists(outputFile);
    if (isFileExist) {
      console.log(`[autogen] cache hit: ${fileName}`);
      return res.type("jpg").sendFile(outputFile);
    }

    console.log(`[autogen] cache miss, generating: ${fileName}`);
    const start = Date.now();
    const output = await withTimeout(generateImage(fileName), GENERATION_TIMEOUT_MS);
    const duration = Date.now() - start;

    if (output) {
      console.log(`[autogen] generated: ${fileName} (${duration}ms)`);
      return res.type("jpg").sendFile(outputFile);
    }

    console.log(`[autogen] generation returned falsy: ${fileName} (${duration}ms)`);
    return sendFallback(res);
  } catch (err) {
    console.log(`[autogen] failed: ${fileName} - ${err.message}`);
    return sendFallback(res);
  }
});

/**
 * Cache-busting endpoint: forces re-generation by deleting cached output
 * Use when a design's sim file has been updated and you need fresh mockups
 * Example: GET /bust/hoodie-black-4001.jpg
 */
server.get("/bust/:file", async (req, res) => {
  const fileName = req.params.file;
  const outputFile = root(outputFolder(fileName));
  const designNumber = fileName.slice(fileName.indexOf("-", fileName.indexOf("-") + 1) + 1).replace(".jpg", "");

  try {
    // Delete cached output
    const outputExists = await checkIfFileExists(outputFile);
    if (outputExists) {
      fs.unlinkSync(outputFile);
    }

    // Delete cached design files for this number (all variants)
    const designDir = root("design");
    const designFiles = fs.readdirSync(designDir).filter(f => f.startsWith(designNumber));
    designFiles.forEach(f => {
      try { fs.unlinkSync(path.join(designDir, f)); } catch(e) {}
    });

    // Now regenerate
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
 * Bust ALL cached mockups for a design number at once.
 * Deletes every output image and design cache file for the given number.
 * Example: GET /bust-design/175
 * After this, every mockup for design 175 will regenerate fresh from R2.
 */
server.get("/bust-design/:designNum", async (req, res) => {
  const designNum = req.params.designNum;
  let deletedOutput = 0;
  let deletedDesign = 0;

  try {
    // Delete ALL output files for this design number (tee-black-175.jpg, hoodie-navy-175.jpg, etc.)
    const outputDir = root("output");
    if (fs.existsSync(outputDir)) {
      const outputFiles = fs.readdirSync(outputDir).filter(f => f.endsWith(`-${designNum}.jpg`));
      outputFiles.forEach(f => {
        try { fs.unlinkSync(path.join(outputDir, f)); deletedOutput++; } catch(e) {}
      });
    }

    // Delete ALL cached design/sim files for this number (175.png, 175-hoodie-sim.png, etc.)
    const designDir = root("design");
    if (fs.existsSync(designDir)) {
      const designFiles = fs.readdirSync(designDir).filter(f => f.startsWith(designNum + '.') || f.startsWith(designNum + '-'));
      designFiles.forEach(f => {
        try { fs.unlinkSync(path.join(designDir, f)); deletedDesign++; } catch(e) {}
      });
    }

    console.log(`[bust-design] Cleared design ${designNum}: ${deletedOutput} outputs, ${deletedDesign} design files`);

    res.json({
      success: true,
      designNum,
      deletedOutput,
      deletedDesign,
      message: `Cleared ${deletedOutput} mockups and ${deletedDesign} design files for design ${designNum}`
    });
  } catch (err) {
    console.log(`[bust-design] Error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

server.get("/", async (req, res) => {
  res.send("Hello from template simulation app! v2.2 — per-product sim support + bulk cache bust");
});

server.listen(process.env.PORT, () => {
  console.log(`Server listening at ${process.env.PORT}`);
});
