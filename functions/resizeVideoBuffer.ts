import fs from "fs";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import { calculateTargetDimensions } from "../helpers/utils.js";
import { fileTypeFromBuffer } from "file-type";
import doWithRetries from "../helpers/doWithRetries.js";

export default async function resizeVideoBuffer(inputBuffer: Buffer) {
  let tempFile;
  let outputFile;

  try {
    tempFile = tmp.fileSync({ postfix: ".mp4" });
    outputFile = tmp.fileSync({ postfix: ".mp4" });

    const tempFilePath = tempFile.name;
    const outputFilePath = outputFile.name;

    await doWithRetries({
      functionName: "resizeVideoBuffer - write",
      functionToExecute: () => fs.promises.writeFile(tempFilePath, inputBuffer),
    });

    const fileType = await doWithRetries({
      functionName: "resizeVideoBuffer - get file type",
      functionToExecute: () => fileTypeFromBuffer(inputBuffer),
    });

    if (!fileType || !fileType.mime.startsWith("video/")) {
      throw new Error("Invalid file type");
    }

    const metadata = await doWithRetries({
      functionName: "resizeVideoBuffer - ffmpeg",
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
          });
        }),
    });

    // Find the video stream
    const videoStream = (metadata as any).streams.find(
      (stream: any) => stream.codec_type === "video"
    );

    if (!videoStream) {
      throw new Error("No video stream found in the media file");
    }

    const originalWidth = videoStream.width || videoStream.coded_width;
    const originalHeight = videoStream.height || videoStream.coded_height;

    if (!originalWidth || !originalHeight) {
      throw new Error("Unable to determine video dimensions");
    }

    const { targetWidth, targetHeight } = calculateTargetDimensions(
      originalWidth,
      originalHeight
    );

    const adjustedWidth = targetWidth - (targetWidth % 2);
    const adjustedHeight = targetHeight - (targetHeight % 2);

    await doWithRetries({
      functionName: "resizeVideoBuffer - ffmpeg",
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
      functionName: "resizeVideoBuffer - read file",
      functionToExecute: () => fs.promises.readFile(outputFilePath),
    });

    return { resizedBuffer, targetHeight, targetWidth };
  } catch (error) {
    console.error("Error resizing video:", error);
    throw error;
  } finally {
    if (tempFile) tempFile.removeCallback();
    if (outputFile) outputFile.removeCallback();
  }
}
