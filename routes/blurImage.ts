import * as dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import os from "os";
import { nanoid } from "nanoid";
import express, { Response } from "express";
import sharp from "sharp";
import { CustomRequest } from "../types.js";
import { __dirname, db } from "../init.js";
import uploadToSpaces from "../helpers/uploadToSpaces.js";
import { detectWithHuman } from "../functions/processFrame.js";
import processEye from "../functions/processEye.js";
import processFace from "../functions/processFace.js";
import doWithRetries from "../helpers/doWithRetries.js";
import getExistingResults from "../functions/checkIfResultExists.js";
import { getHashes } from "../helpers/utils.js";

const route = express.Router();

type UrlObject = { url: string; contentKey: string };

route.post("/", async (req: CustomRequest, res: Response) => {
  const { urlObjects, blurType } = req.body;

  if (!urlObjects || !["face", "eyes"].includes(blurType)) {
    res.status(400).json({ error: "Bad request" });
    return;
  }

  let tempDir;

  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blur-image-"));

    const hashes = await getHashes(urlObjects.map((obj: UrlObject) => obj.url));

    const existingResults = await getExistingResults({
      blurType,
      hashes,
    });

    if (existingResults.length > 0) {
      res.status(200).json({ message: existingResults });
      return;
    }

    const results = [];

    for (const obj of urlObjects) {
      const tempPath = fs.mkdtempSync(path.join(tempDir, nanoid()) + ".png");
      const response = await fetch(obj.url);

      if (!response.ok) {
        throw new Error(`Failed to fetch the URL: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      const orientedBuffer = await sharp(buffer).rotate().toBuffer();

      const detection = await detectWithHuman(orientedBuffer, tempPath);

      let resultBuffer;

      if (blurType === "face") {
        resultBuffer = await processFace(detection, orientedBuffer);
      } else {
        resultBuffer = await processEye(detection, tempPath, orientedBuffer);
      }

      const resultUrl = await uploadToSpaces({
        buffer: resultBuffer,
        mimeType: "image/webp",
      });

      results.push({
        resultUrl,
        originalUrl: obj.url,
        contentKey: obj.contentKey,
      });
    }

    const toInsert = results.map((res, i) => ({
      ...res,
      updatedAt: new Date(),
      isRunning: false,
      blurType,
      hash: hashes[i],
    }));

    await doWithRetries({
      functionName: "blurVideo - save analysis result",
      functionToExecute: async () =>
        db.collection("BlurProcessingStatus").insertMany(toInsert),
    });

    res.status(200).json({ message: results });
  } catch (error) {
    console.error("Error processing image:", error);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    res
      .status(500)
      .send({ message: "Error processing image", error: error.message });
  }
});

export default route;
