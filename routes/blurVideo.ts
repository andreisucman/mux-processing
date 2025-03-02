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
import { processFrame } from "functions/processFrame.js";
import uploadToSpaces from "functions/uploadToSpaces.js";
import { CustomRequest } from "types.js";
import { __dirname, db } from "init.js";
import createHashKey from "@/functions/createHashKey.js";
import doWithRetries from "helpers/doWithRetries.js";
import extractFrames from "functions/extractFrames.js";
import addAnalysisStatusError from "functions/addAnalysisStatusError.js";
import getExistingResult from "functions/getExistingResult.js";
import resizeVideoBuffer from "functions/resizeVideoBuffer.js";
import httpError from "@/helpers/httpError.js";

const route = express.Router();

//!!! CHECK CODEC

route.post("/", async (req: CustomRequest, res: Response) => {
  const { url, blurType } = req.body;

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

    const response = await doWithRetries(async () => fetch(url));

    if (!response.ok) {
      throw httpError(`Failed to fetch the URL: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const {
      duration,
      resizedBuffer,
      targetHeight,
      targetWidth,
      frameRate = 30,
    } = await resizeVideoBuffer(buffer);

    fs.writeFileSync(videoPath, resizedBuffer);

    /* check if the result already exists */
    const timestamps = [Number(duration) * 0.25];
    const screenshotsFolder = await extractFrames({
      input: videoPath,
      timestamps,
      width: targetWidth,
      height: targetHeight,
    });

    const localUrls = fs.readdirSync(screenshotsFolder);

    const hash = await createHashKey(
      path.join(screenshotsFolder, localUrls[0])
    );

    const existingResult = await getExistingResult({ blurType, hash });

    if (existingResult) {
      res.status(200).json({ message: { ...existingResult, hash } }); // return hash to make it not rerun when analysis is in progress and page reloaded
      return;
    }

    await doWithRetries(async () =>
      db.collection("BlurProcessingStatus").insertOne({
        _id: analysisId,
        hash,
        blurType,
        isRunning: true,
        updatedAt: new Date(),
      })
    );

    res.status(200).json({ message: { hash } });

    fs.mkdirSync(framesDir);
    fs.mkdirSync(processedFramesDir);

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .inputOptions("-r", `${frameRate}`)
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
          cb: () => incrementProgress(analysisId, incrementPercent),
        })
      )
    );

    await Promise.all(promises);

    const processedFrameFiles = fs.readdirSync(processedFramesDir);

    if (frameFiles.length !== processedFrameFiles.length) {
      throw httpError(
        `Mismatch in number of frames. Original: ${frameFiles.length}, Processed: ${processedFrameFiles.length}`
      );
    }

    const codec = process.env.ENV === "dev" ? "libopenh264" : "libx264";

    await new Promise((resolve, reject) => {
      ffmpeg(path.join(processedFramesDir, "frame-%04d.png"))
        .inputOptions([`-framerate ${frameRate}`, "-start_number 1"])
        .input(videoPath)
        .outputOptions([
          "-c:v",
          codec,
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

    const thumbnail = await uploadToSpaces({
      localUrl: path.join(processedFramesDir, processedFrameFiles[0]),
      mimeType: "image/webp",
    });

    await doWithRetries(async () =>
      db.collection("BlurProcessingStatus").updateOne(
        { _id: analysisId },
        {
          $set: {
            blurType,
            hash,
            url: resultUrl,
            thumbnail,
            isRunning: false,
            updatedAt: new Date(),
          },
        }
      )
    );

    await fs.promises.rm(tempDir, { recursive: true, force: true });
    await fs.promises.rm(screenshotsFolder, { recursive: true, force: true });
  } catch (err) {
    addAnalysisStatusError({ blurType, analysisId, message: err.message });

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

export default route;

async function incrementProgress(analysisId: ObjectId, inc: number) {
  await doWithRetries(async () =>
    db.collection("BlurProcessingStatus").updateOne(
      { _id: analysisId },
      {
        $inc: {
          progress: inc,
        },
      }
    )
  );
}
