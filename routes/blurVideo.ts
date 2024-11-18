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
import { createHashKey } from "../helpers/utils.js";
import doWithRetries from "../helpers/doWithRetries.js";
import addErrorLog from "../helpers/addErrorLog.js";
import extractFrames from "../functions/extractFrames.js";
import addAnalysisStatusError from "../helpers/addAnalysisStatusError.js";
import getExistingResult from "../functions/getExistingResult.js";
import resizeVideoBuffer from "../functions/resizeVideoBuffer.js";

const route = express.Router();

//!!! CHECK CODEC

route.post("/", async (req: CustomRequest, res: Response) => {
  const { url, blurType } = req.body;
  console.log("req.body blur video", req.body);

  if (!["face", "eyes"].includes(blurType) || !url) {
    res.status(400).json({ error: "Bad request" });
    return;
  }

  let tempDir;
  const analysisId = new ObjectId();

  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blur-video-"));

    const id = nanoid();
    const videoPath = path.join(tempDir, `input-${id}.mp4`);
    const framesDir = path.join(tempDir, `frames-${id}`);
    const processedFramesDir = path.join(tempDir, `processedFrames-${id}`);
    const outputVideoPath = path.join(tempDir, `output-${id}.mp4`);

    const response = await doWithRetries({
      functionName: "blurVideo - fetch",
      functionToExecute: async () => fetch(url),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { resizedBuffer } = await resizeVideoBuffer(buffer);

    fs.writeFileSync(videoPath, resizedBuffer);

    /* check if the result already exists */
    const screenshotsFolder = await extractFrames({
      input: videoPath,
      timestamps: ["25%"],
    });

    const localUrls = fs.readdirSync(screenshotsFolder);

    const hash = await createHashKey(
      path.join(screenshotsFolder, localUrls[0])
    );

    const existingResultUrl = await getExistingResult({ blurType, hash });

    if (existingResultUrl) {
      res.status(200).json({ message: { url: existingResultUrl } });
      return;
    }

    await doWithRetries({
      functionName: "blurVideo - add analysis status",
      functionToExecute: async () =>
        db.collection("BlurProcessingStatus").insertOne({
          _id: analysisId,
          hash,
          blurType,
          isRunning: true,
          updatedAt: new Date(),
        }),
    });

    res.status(200).json({ message: { hash } });

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

    const incrementPercent = 100 / frameFiles.length;

    const promises = frameFiles.map((frameFile) =>
      limit(() =>
        processFrame({
          frameFile,
          framesDir,
          processedFramesDir,
          blurType,
          cb: () => progressUpdateCallback(analysisId, incrementPercent),
        })
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
          "libopenh264",
          // "libx264", // or libopenh264
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
              hash,
              url: resultUrl,
              isRunning: false,
              updatedAt: new Date(),
            },
          }
        ),
    });

    await fs.promises.rm(tempDir, { recursive: true, force: true });
    await fs.promises.rm(screenshotsFolder, { recursive: true, force: true });
  } catch (error) {
    addErrorLog({ functionName: "processing - blurVideo", message: error });
    addAnalysisStatusError({ blurType, analysisId, message: error });

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

export default route;

async function progressUpdateCallback(analysisId: ObjectId, inc: number) {
  await doWithRetries({
    functionName: "blurVideo - progressUpdateCallback",
    functionToExecute: async () =>
      db.collection("BlurProcessingStatus").updateOne(
        { _id: analysisId },
        {
          $inc: {
            progress: inc,
          },
        }
      ),
  });
}
