import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import os from "os";
import path from "path";
import pLimit from "p-limit";
import ffmpeg from "fluent-ffmpeg";
import { nanoid } from "nanoid";
import { ObjectId } from "mongodb";
import express, { Response } from "express";
import { processFrame } from "../functions/processFrame.js";
import uploadToSpaces from "../helpers/uploadToSpaces.js";
import { CustomRequest } from "../types.js";
import { __dirname, db } from "../init.js";
import { getBase64Keys } from "../helpers/utils.js";
import doWithRetries from "../helpers/doWithRetries.js";
import addErrorLog from "../helpers/addErrorLog.js";
import extractFrames from "../functions/extractFrames.js";
import deleteFromSpaces from "../functions/deleteFromSpaces.js";
import addAnalysisStatusError from "../helpers/addAnalysisStatusError.js";
import getExistingResults from "../functions/checkIfResultExists.js";

const route = express.Router();

route.post("/", async (req: CustomRequest, res: Response) => {
  const { url, blurType, contentId } = req.body;

  if (!["face", "eyes"].includes(blurType) || !contentId || !url) {
    res.status(400).json({ error: "Bad request" });
    return;
  }

  let tempDir;

  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blur-video-"));

    const id = nanoid();
    const videoPath = path.join(tempDir, `input-${id}.mp4`);
    const framesDir = path.join(tempDir, `frames-${id}`);
    const processedFramesDir = path.join(tempDir, `processedFrames-${id}`);
    const outputVideoPath = path.join(tempDir, `output-${id}.mp4`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(videoPath, buffer);

    /* check if the result already exists */
    const screenshotsFolder = await extractFrames({
      input: videoPath,
      timestamps: ["50%"],
    });

    const localUrls = fs.readdirSync(screenshotsFolder);

    const base64Keys = await getBase64Keys(localUrls);

    const existingResults = await getExistingResults({ blurType, base64Keys });

    if (existingResults.length > 0) {
      res.status(200).json({ message: existingResults });
      return;
    }

    /* create a new result */
    const analysisId = new ObjectId();

    await doWithRetries({
      functionName: "blurVideo - add analysis status",
      functionToExecute: async () =>
        db.collection("BlurProcessingStatus").updateOne(
          { _id: analysisId, blurType },
          {
            $set: {
              isRunning: true,
              updatedAt: new Date(),
            },
          }
        ),
    });

    res.status(200).end();

    fs.mkdirSync(framesDir);
    fs.mkdirSync(processedFramesDir);

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(path.join(framesDir, "frame-%04d.png"))
        .videoFilter("scale='if(gt(iw,ih),1280,-1)':'if(gt(ih,iw),1280,-1)'")
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    const frameFiles = fs.readdirSync(framesDir);

    const limit = pLimit(10);

    const promises = frameFiles.map((frameFile) =>
      limit(() =>
        processFrame(frameFile, framesDir, processedFramesDir, blurType)
      )
    );

    await Promise.all(promises);

    const processedFrameFiles = fs.readdirSync(processedFramesDir);

    if (frameFiles.length !== processedFrameFiles.length) {
      throw new Error(
        `Mismatch in number of frames. Original: ${frameFiles.length}, Processed: ${processedFrameFiles.length}`
      );
    }

    await new Promise((resolve, reject) => {
      ffmpeg(path.join(processedFramesDir, "frame-%04d.png"))
        .inputOptions(["-framerate 30", "-start_number 1"])
        .input(videoPath)
        .outputOptions([
          "-c:v",
          "libx264", // or libopenh264
          "-preset",
          "fast",
          "-threads",
          "0",
          "-c:a",
          "copy",
          "-shortest",
          "-pix_fmt",
          "yuv420p",
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
        ])
        .videoFilter("scale='if(gt(iw,ih),1280,-1)':'if(gt(ih,iw),1280,-1)'")
        .save(outputVideoPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg command: " + commandLine);
        })
        .on("stderr", (stderrLine) => {
          console.log("FFmpeg stderr: " + stderrLine);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const resultUrl = await uploadToSpaces({
      localUrl: outputVideoPath,
      mimeType: "video/mp4",
    });

    await doWithRetries({
      functionName: "blurVideo - save analysis result",
      functionToExecute: async () =>
        db.collection("BlurProcessingStatus").updateOne(
          { _id: analysisId },
          {
            $set: {
              blurType,
              base64Key: base64Keys[0],
              originalUrl: url,
              resultUrl,
              isRunning: false,
              updatedAt: new Date(),
            },
          }
        ),
    });

    await fs.promises.rm(tempDir, { recursive: true, force: true });
    await fs.promises.rm(screenshotsFolder, { recursive: true, force: true });
  } catch (error) {
    deleteFromSpaces(url);
    addErrorLog({ functionName: "processing - blurVideo", message: error });
    addAnalysisStatusError({ blurType, contentId, message: error });

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

export default route;
