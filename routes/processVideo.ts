import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { Router, Response } from "express";
import resizeVideoBuffer from "functions/resizeVideoBuffer.js";
import transcribeVideoBuffer from "functions/transcribeVideoBuffer.js";
import getVideoDuration from "@/functions/getVideoDuration.js";
import extractFrames from "functions/extractFrames.js";
import doWithRetries from "helpers/doWithRetries.js";
import uploadToSpaces from "functions/uploadToSpaces.js";
import httpError from "@/helpers/httpError.js";
import { CustomRequest } from "@/types.js";

const route = Router();

route.post("/", async (req: CustomRequest, res: Response) => {
  if (!req.userId) {
    res.status(400).json({ message: "Bad request" });
    return;
  }

  let urlsFolder: any;

  try {
    const { url } = req.body;

    const response = await doWithRetries(async () => fetch(url));

    if (!response.ok) {
      throw httpError(`Failed to fetch the URL: ${response.statusText}`);
    }

    const arrayBuffer = await doWithRetries(() => response.arrayBuffer());
    const buffer = Buffer.from(arrayBuffer);

    const { resizedBuffer, targetHeight, targetWidth } =
      await resizeVideoBuffer(buffer);

    const duration = (await getVideoDuration(resizedBuffer)) as number | null;
    const durationIsValid = duration >= 5 && duration <= 20;

    if (!durationIsValid) {
      res.status(400).json({
        status: false,
        error: "Video must be between 5 and 20 seconds in length.",
      });
      return;
    }

    const transcription = await transcribeVideoBuffer({
      videoBuffer: resizedBuffer,
      duration,
      userId: req.userId,
      categoryName: "proof",
    });

    const timestamps = [];
    const timestampSpace = Math.floor(100 / duration);

    for (let i = 1; i < Math.floor(duration) + 1; i++) {
      timestamps.push(`${i * timestampSpace}%`);
    }

    urlsFolder = await extractFrames({
      input: resizedBuffer,
      timestamps,
      width: targetWidth,
      height: targetHeight,
    });

    const fileNames = fs.readdirSync(urlsFolder);

    const uploadPromises = fileNames.map((fileName) => {
      const filePath = path.join(urlsFolder, fileName);
      return doWithRetries(async () =>
        uploadToSpaces({ localUrl: filePath, mimeType: "image/webp" })
      );
    });

    const urls = await doWithRetries(() => Promise.all(uploadPromises));

    res.status(200).json({ status: true, message: { urls, transcription } });
  } catch (error) {
    console.error("Error processing video:", error);
    res
      .status(500)
      .send({ message: "Error processing video", error: error.message });
  } finally {
    if (fs.existsSync(urlsFolder)) {
      fs.rmSync(urlsFolder, { recursive: true, force: true });
    }
  }
});

export default route;
