import * as dotenv from "dotenv";
dotenv.config();
import os from "os";
import path from "path";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { nanoid } from "nanoid";
import { checkForProhibitedContent } from "./checkProhibitedContent.js";
import doWithRetries from "../helpers/doWithRetries.js";

const tempDir = os.tmpdir();

export default async function checkVideoSafety(buffer) {
  const inputFilePath = path.join(tempDir, `input-${nanoid()}`);
  const framesDir = path.join(tempDir, `frames-${nanoid()}`);

  try {
    await doWithRetries({
      functionToExecute: () => fs.writeFile(inputFilePath, buffer),
    });

    await fs.mkdir(framesDir, { recursive: true });

    await doWithRetries({
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          ffmpeg(inputFilePath)
            .outputOptions("-vf", "fps=1")
            .output(path.join(framesDir, "frame-%03d.jpg"))
            .on("end", () => {
              resolve();
            })
            .on("error", (err) => {
              console.error("FFmpeg error:", err);
              reject(err);
            })
            .run();
        }),
    });

    const frameFiles = await fs.readdir(framesDir);

    const frameFilePaths = frameFiles.map((file) => path.join(framesDir, file));

    const isProhibited = await checkForProhibitedContent(frameFilePaths);

    if (isProhibited) {
      return {
        status: false,
        message: "Video contains prohibited content",
      };
    } else {
      return {
        status: true,
      };
    }
  } catch (err) {
    console.error("Error in checking video safety:", err);
    throw err;
  } finally {
    try {
      await fs.unlink(inputFilePath).catch((e) => {
        console.warn(`Failed to delete input file: ${inputFilePath}`, e);
      });
      await fs.rm(framesDir, { recursive: true, force: true }).catch((e) => {
        console.warn(`Failed to delete frames directory: ${framesDir}`, e);
      });
    } catch (cleanupErr) {
      console.error("Error during cleanup:", cleanupErr);
    }
  }
}
