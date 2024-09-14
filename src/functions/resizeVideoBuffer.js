import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { calculateTargetDimensions } from "../helpers/utils.js";
import { fileTypeFromBuffer } from "file-type";
import tmp from "tmp";

export default async function resizeVideoBuffer(inputBuffer) {
  let tempFile;
  let outputFile;

  try {
    tempFile = tmp.fileSync({ postfix: ".mp4" });
    outputFile = tmp.fileSync({ postfix: ".mp4" });

    const tempFilePath = tempFile.name;
    const outputFilePath = outputFile.name;

    await fs.promises.writeFile(tempFilePath, inputBuffer);

    const fileType = await fileTypeFromBuffer(inputBuffer);
    if (!fileType || !fileType.mime.startsWith("video/")) {
      throw new Error("Invalid file type");
    }

    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    const { width: originalWidth, height: originalHeight } =
      metadata.streams[0] || {};

    if (!originalWidth || !originalHeight) {
      throw new Error("Unable to determine video dimensions");
    }

    const maxDimensions = { width: 1080, height: 1920 };
    const { targetWidth, targetHeight } = calculateTargetDimensions(
      originalWidth,
      originalHeight,
      maxDimensions.width,
      maxDimensions.height
    );

    const adjustedWidth = targetWidth - (targetWidth % 2);
    const adjustedHeight = targetHeight - (targetHeight % 2);

    await new Promise((resolve, reject) => {
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
    });

    const resizedBuffer = await fs.promises.readFile(outputFilePath);

    return resizedBuffer;
  } catch (error) {
    console.error("Error resizing video:", error);
    throw error;
  } finally {
    if (tempFile) tempFile.removeCallback();
    if (outputFile) outputFile.removeCallback();
  }
}
