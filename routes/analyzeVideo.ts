import { CustomRequest } from "../types.js";
import * as dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import express, { Response } from "express";
import checkVideoSafety from "../functions/checkVideoSafety.js";
import resizeVideoBuffer from "../functions/resizeVideoBuffer.js";
import transcribeVideoBuffer from "../functions/transcribeVideoBuffer.js";
import checkVideoDuration from "../functions/checkVideoDuration.js";
import checkTextSafety from "../functions/checkTextSafety.js";
import extractFrames from "../functions/extractFrames.js";
import doWithRetries from "../helpers/doWithRetries.js";
import uploadToSpaces from "../helpers/uploadToSpaces.js";

const route = express.Router();

route.post("/", async (req: CustomRequest, res: Response) => {
  if (req.header("authorization") !== process.env.SECRET) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  try {
    const { url } = req.body;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { resizedBuffer } = await resizeVideoBuffer(buffer);

    const durationIsValid = await checkVideoDuration(resizedBuffer);

    if (!durationIsValid) {
      res.status(400).json({
        status: false,
        message: "Video must be between 5 and 30 seconds in length.",
      });
      return;
    }

    const { status: videoIsSafe } = await checkVideoSafety(resizedBuffer);

    if (!videoIsSafe) {
      res
        .status(400)
        .json({ status: false, message: "Video contains prohibited content" });
      return;
    }

    const transcription = await transcribeVideoBuffer(resizedBuffer);
    const { verdict: textIsSafe } = await checkTextSafety(transcription);

    if (!textIsSafe) {
      res
        .status(400)
        .json({ status: false, message: "Speech contains prohibited content" });
      return;
    }

    const urlsFolder = await extractFrames({
      input: resizedBuffer,
      timestamps: ["50%"],
    });

    const localUrls = fs.readdirSync(urlsFolder);

    const uploadPromises = localUrls.map((localUrl) =>
      doWithRetries({
        functionName: "extractFrames - uploadPromises",
        functionToExecute: () =>
          uploadToSpaces({ localUrl, mimeType: "image/webp" }),
      })
    );

    const urls = await doWithRetries({
      functionName: "resizeVideoBuffer - getUrls",
      functionToExecute: () => Promise.all(uploadPromises),
    });

    fs.rmSync(urlsFolder, { recursive: true, force: true });

    res.status(200).json({ status: true, message: urls });
  } catch (error) {
    console.error("Error processing video:", error);
    res
      .status(500)
      .send({ message: "Error processing video", error: error.message });
  }
});

export default route;
