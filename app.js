require("dotenv").config();
const fetch = require("node-fetch");
const express = require("express");
const sharp = require("sharp");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");
const server = express();

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
const GENERATION_TIMEOUT_MS = 15000;

/**
 * ═══════ PRODUCT PREFIX MAP ═══════
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
 */
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

/**
 * Map product prefixes to placement config keys.
 * Multiple autogen prefixes map to the same placement.
 */
const PRODUCT_TO_PLACEMENT = {
  // Standard tees — use tee placement
  "tee": "tee", "teeback": "tee",
  "nltbtee": "tee", "5300": "tee",
  "lstee": "tee", "lsteeback": "tee",
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
  "td1000": "tee",
  "g5000real": "tee", "g5000realb": "tee", "g5000realc": "tee",
  "tote": "tee",

  // Hoodies
  "hoodie": "hoodie", "hoodieback": "hoodie",
  "jha009": "hoodie", "jha009back": "hoodie",
  "ythhoodie": "hoodie", "ythhoodieback": "hoodie",
  "toddlerhoodie": "hoodie", "toddlerhoodieback": "hoodie",
  "lsteehoodie": "hoodie", "lsteehoodieback": "hoodie",

  // Sweatshirts
  "sweat": "sweat", "sweatback": "sweat",
  "youthsweat": "sweat", "youthsweatback": "sweat",
  "toddlersweat": "sweat", "toddlersweatback": "sweat",

  // Coach jacket
  "coach": "coach", "coachback": "coach",

  // Workshirt — similar to coach
  "workshirt": "coach", "workshirtback": "coach",

  // Onesie
  "onesie": "onesie",

  // Lunchbox
  "lunchbox": "lunchbox",

  // Sport bag
  "sportbag": "sportbag",

  // Hats
  "trucker": "hat",
  "ottowashed6p": "hat",
};

/**
 * ═══════════════════════════════════════════════════════════════════════
 * PER-PRODUCT PLACEMENT CONFIG  (v4.0 — locked 2026-02-24)
 * ═══════════════════════════════════════════════════════════════════════
 * Canvas: 826 x 1011
 * ~35 pixels per inch
 *
 * The design PNG from R2 ({number}.png) has the design positioned for a
 * tee (centered, 15% from top). For other products, we extract the design
 * from the PNG and reposition it according to these specs.
 *
 * For "tee" placement, we use the PNG as-is (no repositioning needed).
 * ═══════════════════════════════════════════════════════════════════════
 */
const PLACEMENT_CONFIG = {
  tee: {
    // Baseline — use the sim PNG as-is, no repositioning
    reposition: false,
  },
  hoodie: {
    reposition: true,
    designWidthPct: 0.50,    // ~413px
    pasteYPct: 0.24,         // ~243px from top
    maxHeightPct: 0.38,      // ~384px
    leftChest: false,
  },
  sweat: {
    reposition: true,
    designWidthPct: 0.445,   // 10.5"
    pasteYPct: 0.23,         // ~233px
    maxHeightPct: 0.52,      // 15"
    leftChest: false,
  },
  coach: {
    reposition: true,
    designWidthPct: 0.190,   // 4.5" = ~157px
    pasteYPct: 0.28,         // below collar
    maxHeightPct: 0.156,     // 4.5" = ~158px
    leftChest: true,
    pasteXPct: 0.55,         // wearer's left = viewer's right
  },
  onesie: {
    reposition: true,
    designWidthPct: 0.40,    // ~330px
    pasteYPct: 0.17,         // ~172px
    maxHeightPct: 0.48,      // ~485px
    leftChest: false,
  },
  lunchbox: {
    reposition: true,
    designWidthPct: 0.75,    // ~619px — ridge to ridge
    pasteYPct: 0.21,         // ~212px — in the panel
    maxHeightPct: 0.43,      // ~435px
    leftChest: false,
  },
  sportbag: {
    reposition: true,
    designWidthPct: 0.55,    // ~454px
    pasteYPct: 0.29,         // ~293px — below drawstrings
    maxHeightPct: 0.48,      // ~485px
    leftChest: false,
  },
  hat: {
    reposition: true,
    designWidthPct: 0.35,    // ~289px
    pasteYPct: 0.22,         // ~222px
    maxHeightPct: 0.30,      // ~303px
    leftChest: false,
  },
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
 */
const checkIfFileExists = (file) => {
  return new Promise((resolve) => {
    fs.access(file, fs.constants.F_OK, (err) => {
      resolve(err == null);
    });
  });
};

/**
 * Write file to disk
 */
const createImage = (path, data) => {
  return new Promise((resolve) => {
    fs.writeFile(path, data, (err) => {
      resolve(err == null);
    });
  });
};

/**
 * Generate download link from BASE_DESIGN_URL
 */
const generateDownloadLink = (file) =>
  new URL(`${process.env.BASE_DESIGN_URL}${file}`);

/**
 * Download image from URL
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
 * Extract the design from an existing sim PNG.
 * The sim is 826x1011 with the design on a transparent background.
 * We trim the transparent edges to get just the design.
 *
 * Returns a sharp instance of the extracted design, or null.
 */
const extractDesignFromSim = async (simPath) => {
  try {
    const trimmed = await sharp(simPath)
      .trim()  // removes transparent/solid borders
      .toBuffer({ resolveWithObject: true });

    if (trimmed.info.width < 10 || trimmed.info.height < 10) {
      return null;
    }

    return { buffer: trimmed.data, width: trimmed.info.width, height: trimmed.info.height };
  } catch (err) {
    console.log(`[autogen] extract failed: ${err.message}`);
    return null;
  }
};

/**
 * Reposition a design for a specific product.
 * Takes the extracted design and places it on a new 826x1011 canvas
 * according to the product's placement config.
 *
 * Returns buffer of the repositioned sim PNG.
 */
const repositionDesign = async (designBuffer, designWidth, designHeight, placementKey) => {
  const config = PLACEMENT_CONFIG[placementKey];
  if (!config || !config.reposition) return null;

  const canvasW = 826;
  const canvasH = 1011;

  // Calculate target size
  const maxW = Math.round(canvasW * config.designWidthPct);
  const maxH = Math.round(canvasH * config.maxHeightPct);

  const scaleW = maxW / designWidth;
  const scaleH = maxH / designHeight;
  const scale = Math.min(scaleW, scaleH);

  const newW = Math.round(designWidth * scale);
  const newH = Math.round(designHeight * scale);

  // Resize the design
  const resized = await sharp(designBuffer)
    .resize(newW, newH, { fit: 'inside' })
    .toBuffer();

  // Calculate position
  const pasteY = Math.round(canvasH * config.pasteYPct);
  let pasteX;
  if (config.leftChest) {
    pasteX = Math.round(canvasW * config.pasteXPct);
  } else {
    pasteX = Math.round((canvasW - newW) / 2);
  }

  // Create transparent canvas and composite
  const canvas = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .png()
    .composite([{ input: resized, top: pasteY, left: pasteX }])
    .toBuffer();

  return canvas;
};

/**
 * Generate image — NOW WITH PER-PRODUCT REPOSITIONING
 *
 * 1. Parse request to get template name and design number
 * 2. Determine product type from template name
 * 3. Download the generic sim ({number}.png) from R2
 * 4. If product needs repositioning, extract design and reposition
 * 5. Composite onto the garment template
 */
const generateImage = async (file) => {
  const indexSeparator = file.indexOf("-", file.indexOf("-") + 1);
  const templateFile = JPGExt(file.slice(0, indexSeparator));
  const designNumber = file.slice(indexSeparator + 1).replace(".jpg", "");
  const templateName = file.slice(0, indexSeparator);
  const localTemplate = root(templateFolder(templateFile));
  const output = root(outputFolder(file));

  try {
    // Step 1: Download the generic sim PNG
    const genericFile = `${designNumber}.png`;
    const localGeneric = root(designFolder(genericFile));
    const isFileExist = await checkIfFileExists(localGeneric);
    if (!isFileExist) {
      const designLink = generateDownloadLink(genericFile);
      const isDownloaded = await downloadImage(designLink, genericFile);
      if (!isDownloaded) return false;
    }

    // Step 2: Determine product and whether we need to reposition
    const product = getProductFromTemplate(templateName);
    const placementKey = product ? (PRODUCT_TO_PLACEMENT[product] || "tee") : "tee";
    const config = PLACEMENT_CONFIG[placementKey];

    let compositeInput = localGeneric;

    // Step 3: If this product needs repositioning, do it
    if (config && config.reposition) {
      // Check if we already have a repositioned version cached
      const reposFile = `${designNumber}-${placementKey}.png`;
      const localRepos = root(designFolder(reposFile));
      const reposExists = await checkIfFileExists(localRepos);

      if (reposExists) {
        compositeInput = localRepos;
        console.log(`[autogen] using cached repositioned: ${reposFile}`);
      } else {
        // Extract design from generic sim and reposition
        const extracted = await extractDesignFromSim(localGeneric);
        if (extracted) {
          const repositioned = await repositionDesign(
            extracted.buffer, extracted.width, extracted.height, placementKey
          );
          if (repositioned) {
            await createImage(localRepos, repositioned);
            compositeInput = localRepos;
            console.log(`[autogen] repositioned for ${placementKey}: ${reposFile}`);
          } else {
            console.log(`[autogen] reposition failed, using generic for ${placementKey}`);
          }
        } else {
          console.log(`[autogen] extract failed, using generic`);
        }
      }
    } else {
      console.log(`[autogen] tee placement, using generic as-is`);
    }

    // Step 4: Composite onto garment template
    const image = await sharp(localTemplate)
      .composite([{ input: compositeInput }])
      .toFile(output);

    return image;
  } catch (err) {
    console.log(`[autogen] error: ${err.message}`);
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
 * and all cached repositioned designs for this design number.
 * Example: GET /bust/hoodie-black-167.jpg
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

    // Delete ALL cached design files for this number (generic + repositioned)
    const designDir = root("design");
    const designFiles = fs.readdirSync(designDir).filter(f => f.startsWith(designNumber));
    designFiles.forEach(f => {
      try { fs.unlinkSync(path.join(designDir, f)); } catch(e) {}
    });

    console.log(`[bust] cleared ${designFiles.length} cached files for design ${designNumber}`);

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
 * Bust ALL outputs for a design number across all products
 * Example: GET /bust-all/167
 */
server.get("/bust-all/:designNumber", async (req, res) => {
  const designNumber = req.params.designNumber;

  try {
    // Delete all cached design files
    const designDir = root("design");
    const designFiles = fs.readdirSync(designDir).filter(f => f.startsWith(designNumber));
    designFiles.forEach(f => {
      try { fs.unlinkSync(path.join(designDir, f)); } catch(e) {}
    });

    // Delete all cached output files
    const outputDir = root("output");
    const outputFiles = fs.readdirSync(outputDir).filter(f => f.includes(`-${designNumber}.jpg`));
    outputFiles.forEach(f => {
      try { fs.unlinkSync(path.join(outputDir, f)); } catch(e) {}
    });

    res.json({
      success: true,
      designNumber,
      clearedDesignFiles: designFiles.length,
      clearedOutputFiles: outputFiles.length,
      message: `Cache cleared. Next request for any product with design ${designNumber} will regenerate with correct positioning.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.get("/", async (req, res) => {
  res.send("Hello from template simulation app! v4.0 — per-product repositioning at render time");
});

server.listen(process.env.PORT, () => {
  console.log(`Server listening at ${process.env.PORT}`);
});
