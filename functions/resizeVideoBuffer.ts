import fs from "fs";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import { calculateTargetDimensions } from "helpers/utils.js";
import { fileTypeFromBuffer } from "file-type";
import doWithRetries from "helpers/doWithRetries.js";
import httpError from "@/helpers/httpError.js";

export default async function resizeVideoBuffer(inputBuffer: Buffer) {
  let tempFile;
  let outputFile;

  try {
    tempFile = tmp.fileSync({ postfix: ".mp4" });
    outputFile = tmp.fileSync({ postfix: ".mp4" });

    const tempFilePath = tempFile.name;
    const outputFilePath = outputFile.name;

    await doWithRetries(() => fs.promises.writeFile(tempFilePath, inputBuffer));

    const fileType = await doWithRetries(() => fileTypeFromBuffer(inputBuffer));

    if (!fileType || !fileType.mime.startsWith("video/")) {
      throw new Error("Invalid file type");
    }

    const metadata = await doWithRetries(
      () =>
        new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
          });
        })
    );

    // Find the video stream
    const videoStream = (metadata as any).streams.find(
      (stream: any) => stream.codec_type === "video"
    );

    if (!videoStream) {
      throw httpError("No video stream found in the media file");
    }

    const originalWidth = videoStream.width || videoStream.coded_width;
    const originalHeight = videoStream.height || videoStream.coded_height;

    if (!originalWidth || !originalHeight) {
      throw httpError("Unable to determine video dimensions");
    }

    const { targetWidth, targetHeight } = calculateTargetDimensions(
      originalWidth,
      originalHeight
    );

    const adjustedWidth = targetWidth - (targetWidth % 2);
    const adjustedHeight = targetHeight - (targetHeight % 2);

    await doWithRetries(
      () =>
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
        })
    );

    const resizedBuffer = await doWithRetries(() =>
      fs.promises.readFile(outputFilePath)
    );

    return {
      resizedBuffer,
      targetHeight,
      targetWidth,
      frameRate: videoStream.r_frame_rate,
    };
  } catch (err) {
    throw httpError(err);
  } finally {
    if (tempFile) tempFile.removeCallback();
    if (outputFile) outputFile.removeCallback();
  }
}
