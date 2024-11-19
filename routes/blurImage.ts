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
import getExistingResults from "../functions/getExistingResult.js";
import { createHashKey } from "../helpers/utils.js";

const route = express.Router();

route.post("/", async (req: CustomRequest, res: Response) => {
  const { url, blurType } = req.body;

  if (!url || !["face", "eyes"].includes(blurType)) {
    res.status(400).json({ error: "Bad request" });
    return;
  }

  let tempDir;

  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blur-image-"));

    const hash = await createHashKey(url);

    const existingResult = await getExistingResults({
      blurType,
      hash,
    });

    if (existingResult) {
      res.status(200).json({ message: existingResult });
      return;
    }

    const tempPath = fs.mkdtempSync(path.join(tempDir, nanoid()) + ".png");

    const response = await doWithRetries({
      functionName: "blurImage - fetch",
      functionToExecute: async () => fetch(url),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const orientedBuffer = await sharp(buffer).rotate().toBuffer();
    const detection = await detectWithHuman(orientedBuffer);

    let resultUrl;
    let resultBuffer;

    if (detection) {
      if (blurType === "face") {
        resultBuffer = await processFace(detection, orientedBuffer);
      } else {
        resultBuffer = await processEye(detection, tempPath, orientedBuffer);
      }
    } else {
      resultBuffer = orientedBuffer;
    }

    resultUrl = await uploadToSpaces({
      buffer: resultBuffer,
      mimeType: "image/webp",
    });

    const toInsert = {
      updatedAt: new Date(),
      isRunning: false,
      blurType,
      hash,
      url: resultUrl,
    };

    await doWithRetries({
      functionName: "blurVideo - save analysis result",
      functionToExecute: async () =>
        db.collection("BlurProcessingStatus").insertOne(toInsert),
    });

    res.status(200).json({ message: { url: resultUrl } });
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
