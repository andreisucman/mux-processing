import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import tmp from "tmp";
import path from "path";
import uploadToSpaces from "../helpers/uploadToSpaces.js";
import doWithRetries from "../helpers/doWithRetries.js";

const extractFrames = async (videoBuffer) => {
  let cleanupTempVideo;
  let cleanupTempDir;

  try {
    // Create a temporary file for the video
    const {
      name: tempVideoPath,
      fd,
      removeCallback: cleanupVideo,
    } = await doWithRetries({
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          tmp.file({ postfix: ".mp4" }, (err, name, fd, removeCallback) => {
            if (err) reject(err);
            else resolve({ name, fd, removeCallback });
          });
        }),
    });

    cleanupTempVideo = cleanupVideo;

    await doWithRetries({
      functionToExecute: () => fs.writeFile(tempVideoPath, videoBuffer),
    });

    // Use ffprobe to get video duration
    const metadata = await doWithRetries({
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata);
          });
        }),
    });

    const duration = metadata.format.duration; // in seconds

    // Calculate the times to extract frames over the whole duration
    const frameTimes = [];
    for (let i = 0; i < 5; i++) {
      const time = (duration * i) / 5;
      frameTimes.push(time);
    }

    // Create a temporary directory for frames
    const { name: tempDir, removeCallback: cleanupDir } = await doWithRetries({
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          tmp.dir({ prefix: "frames-" }, (err, name, removeCallback) => {
            if (err) reject(err);
            else resolve({ name, removeCallback });
          });
        }),
    });

    cleanupTempDir = cleanupDir;

    // Use ffmpeg to extract frames at specified times
    await doWithRetries({
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          ffmpeg(tempVideoPath)
            .on("end", resolve)
            .on("error", reject)
            .screenshots({
              timestamps: frameTimes,
              filename: "frame-%02i.png",
              folder: tempDir,
            });
        }),
    });

    // Read all frames from tempDir
    const files = await doWithRetries({
      functionToExecute: () => fs.readdir(tempDir),
    });

    // Sort files to ensure correct order
    files.sort();

    // Read each frame file into buffer
    const frames = await doWithRetries({
      functionToExecute: () =>
        Promise.all(
          files.map(async (file) => {
            const data = await fs.readFile(path.join(tempDir, file));
            return data;
          })
        ),
    });

    // Upload frames and get URLs
    const uploadPromises = frames.map((frameBuffer) =>
      doWithRetries({
        operationName: "extractFrames - uploadPromises",
        functionToExecute: () =>
          uploadToSpaces({ buffer: frameBuffer, mimeType: "image/webp" }),
      })
    );

    const urls = await doWithRetries({
      functionToExecute: () => Promise.all(uploadPromises),
    });

    return urls;
  } catch (err) {
    console.error("Error extracting frames:", err);
    throw err;
  } finally {
    // Clean up temp files and directories
    if (cleanupTempVideo) cleanupTempVideo();
    if (cleanupTempDir) cleanupTempDir();
  }
};

export default extractFrames;
