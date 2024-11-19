import { CustomRequest } from "../types.js";
import * as dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import { Router, Response } from "express";
import checkVideoSafety from "../functions/checkVideoSafety.js";
import resizeVideoBuffer from "../functions/resizeVideoBuffer.js";
import transcribeVideoBuffer from "../functions/transcribeVideoBuffer.js";
import checkVideoDuration from "../functions/checkVideoDuration.js";
import checkTextSafety from "../functions/checkTextSafety.js";
import extractFrames from "../functions/extractFrames.js";
import doWithRetries from "../helpers/doWithRetries.js";
import uploadToSpaces from "../helpers/uploadToSpaces.js";

const route = Router();

route.post("/", async (req: CustomRequest, res: Response) => {
  if (req.header("authorization") !== process.env.SECRET) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  let urlsFolder: any;

  try {
    const { url } = req.body;

    console.log("analyzeVideo req.body", req.body);

    const response = await doWithRetries({
      functionName: "analyzeVideo - fetch",
      functionToExecute: async () => fetch(url),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { resizedBuffer, targetHeight, targetWidth } =
      await resizeVideoBuffer(buffer);

    const durationIsValid = await checkVideoDuration(resizedBuffer);

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

    const transcription = await transcribeVideoBuffer(resizedBuffer);
    const { verdict: textIsSafe } = await checkTextSafety(transcription);

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
      console.log("filePath", filePath);
      return doWithRetries({
        functionName: "extractFrames - uploadPromises",
        functionToExecute: async () =>
          uploadToSpaces({ localUrl: filePath, mimeType: "image/webp" }),
      });
    });

    const urls = await doWithRetries({
      functionName: "resizeVideoBuffer - getUrls",
      functionToExecute: () => Promise.all(uploadPromises),
    });

    console.log("analyze video urls", {
      status: true,
      message: urls,
    });

    res.status(200).json({ status: true, message: urls });
  } catch (error) {
    console.error("Error processing video:", error);
    res
      .status(500)
      .send({ message: "Error processing video", error: error.message });
  }
});

export default route;
