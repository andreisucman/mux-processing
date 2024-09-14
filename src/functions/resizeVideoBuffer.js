import fs from "fs";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import { calculateTargetDimensions } from "../helpers/utils.js";
import { fileTypeFromBuffer } from "file-type";
import doWithRetries from "../helpers/doWithRetries.js";

export default async function resizeVideoBuffer(inputBuffer) {
  let tempFile;
  let outputFile;

  try {
    tempFile = tmp.fileSync({ postfix: ".mp4" });
    outputFile = tmp.fileSync({ postfix: ".mp4" });

    const tempFilePath = tempFile.name;
    const outputFilePath = outputFile.name;

    await doWithRetries({
      functionToExecute: () => fs.promises.writeFile(tempFilePath, inputBuffer),
    });

    const fileType = await doWithRetries({
      functionToExecute: () => fileTypeFromBuffer(inputBuffer),
    });

    if (!fileType || !fileType.mime.startsWith("video/")) {
      throw new Error("Invalid file type");
    }

    const metadata = await doWithRetries({
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
          });
        }),
    });

    const { width: originalWidth, height: originalHeight } =
      metadata.streams[0] || {};

    if (!originalWidth || !originalHeight) {
      throw new Error("Unable to determine video dimensions");
    }

    const maxDimensions = { width: 320, height: 568 };
    const { targetWidth, targetHeight } = calculateTargetDimensions(
      originalWidth,
      originalHeight,
      maxDimensions.width,
      maxDimensions.height
    );

    const adjustedWidth = targetWidth - (targetWidth % 2);
    const adjustedHeight = targetHeight - (targetHeight % 2);

    await doWithRetries({
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          ffmpeg(tempFilePath)
            .outputOptions([
              `-vf scale=${adjustedWidth}:${adjustedHeight}`,
              "-preset veryfast",
            ])
            .on("end", resolve)
            .on("error", (err) => {
              console.error("Error occurred during FFmpeg processing:", err);
              reject(err);
            })
            .save(outputFilePath);
        }),
    });

    const resizedBuffer = await doWithRetries({
      functionToExecute: () => fs.promises.readFile(outputFilePath),
    });

    return resizedBuffer;
  } catch (error) {
    console.error("Error resizing video:", error);
    throw error;
  } finally {
    if (tempFile) tempFile.removeCallback();
    if (outputFile) outputFile.removeCallback();
  }
}
