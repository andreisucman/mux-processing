import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { Router, Request, Response } from "express";
import resizeVideoBuffer from "functions/resizeVideoBuffer.js";
import transcribeVideoBuffer from "functions/transcribeVideoBuffer.js";
import getVideoDuration from "@/functions/getVideoDuration.js";
import checkTextSafety from "functions/checkTextSafety.js";
import extractFrames from "functions/extractFrames.js";
import doWithRetries from "helpers/doWithRetries.js";
import uploadToSpaces from "functions/uploadToSpaces.js";
import httpError from "@/helpers/httpError.js";

const route = Router();

route.post("/", async (req: Request, res: Response) => {
  if (req.header("authorization") !== process.env.SECRET) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  const userId = req.header("userid");

  if (!userId) {
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
    const durationIsValid = duration >= 5 && duration <= 15;

    if (!durationIsValid) {
      res.status(400).json({
        status: false,
        error: "Video must be between 5 and 15 seconds in length.",
      });
      return;
    }

    // const { status: videoIsSafe } = await checkVideoSafety(resizedBuffer);

    // if (!videoIsSafe) {
    //   res
    //     .status(400)
    //     .json({ status: false, message: "Video contains prohibited content" });
    //   return;
    // }

    const transcription = await transcribeVideoBuffer({
      videoBuffer: resizedBuffer,
      duration,
      userId,
    });

    const { verdict: textIsSafe } = await checkTextSafety({
      text: transcription,
      userId,
    });

    if (!textIsSafe) {
      res
        .status(400)
        .json({ status: false, message: "Speech contains prohibited content" });
      return;
    }

    urlsFolder = await extractFrames({
      input: resizedBuffer,
      timestamps: ["25%", "50%", "75%"],
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

    res.status(200).json({ status: true, message: urls });
  } catch (error) {
    console.error("Error processing video:", error);
    res
      .status(500)
      .send({ message: "Error processing video", error: error.message });
  }
});

export default route;
