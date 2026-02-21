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
const GENERATION_TIMEOUT_MS = 10000;

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
 * Generate image
 * @param {string} file
 * @returns {boolean or object}
 */
const generateImage = async (file) => {
  const indexSeparator = file.indexOf("-", file.indexOf("-") + 1);
  const templateFile = JPGExt(file.slice(0, indexSeparator));
  const designFile = file.slice(indexSeparator + 1).replace(".jpg", ".png");
  const localDesign = root(designFolder(designFile));
  const localTemplate = root(templateFolder(templateFile));
  const output = root(outputFolder(file));

  try {
    const isFileExist = await checkIfFileExists(localDesign);
    if (!isFileExist) {
      const designLink = generateDownloadLink(designFile);
      const isDownloaded = await downloadImage(designLink, designFile);
      if (!isDownloaded) return false;
    }

    // Get template dimensions so we can resize the design to fit
    const templateMeta = await sharp(localTemplate).metadata();
    const designMeta = await sharp(localDesign).metadata();

    let designInput = localDesign;

    // If design is larger than template, resize it to fit within template bounds
    if (designMeta.width > templateMeta.width || designMeta.height > templateMeta.height) {
      designInput = await sharp(localDesign)
        .resize({
          width: templateMeta.width,
          height: templateMeta.height,
          fit: 'inside',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
    }

    const image = await sharp(localTemplate)
      .composite([{ input: designInput }])
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

server.get("/", async (req, res) => {
  res.send("Hello from template simulation app!");
});

server.listen(process.env.PORT, () => {
  console.log(`Server listening at ${process.env.PORT}`);
});
