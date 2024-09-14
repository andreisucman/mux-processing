import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import temp from "temp";
import path from "path";
import { promisify } from "util";
import uploadToSpaces from "../helpers/uploadToSpaces.js";
import doWithRetries from "../helpers/doWithRetries.js";

temp.track();

const tempOpen = promisify(temp.open);
const tempMkdir = promisify(temp.mkdir);

const extractFrames = async (videoBuffer) => {
  try {
    // Create a temporary file for the video
    const info = await tempOpen({ suffix: ".mp4" });
    const tempVideoPath = info.path;

    await fs.writeFile(tempVideoPath, videoBuffer);

    // Use ffprobe to get video duration
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    const duration = metadata.format.duration; // in seconds

    // Calculate the times to extract frames over the whole duration
    const frameTimes = [];
    for (let i = 0; i < 10; i++) {
      const time = (duration * i) / 9;
      frameTimes.push(time);
    }

    // Create a temporary directory for frames
    const tempDir = await tempMkdir("frames");

    // Use ffmpeg to extract frames at specified times
    await new Promise((resolve, reject) => {
      ffmpeg(tempVideoPath).on("end", resolve).on("error", reject).screenshots({
        timestamps: frameTimes,
        filename: "frame-%02i.webp",
        folder: tempDir,
        size: "640x?",
      });
    });

    // Read all frames from tempDir
    const files = await fs.readdir(tempDir);

    // Sort files to ensure correct order
    files.sort();

    // Read each frame file into buffer
    const frames = await Promise.all(
      files.map(async (file) => {
        const data = await fs.readFile(path.join(tempDir, file));
        return data;
      })
    );

    // Clean up temp files
    await fs.unlink(tempVideoPath);
    temp.cleanup();

    const uploadPromises = frames.map((frameBuffer) =>
      doWithRetries({
        operationName: "extractFrames - uploadPromises",
        functionToExecute: () =>
          uploadToSpaces({ buffer: frameBuffer, mimeType: "image/webp" }),
      })
    );

    const urls = await Promise.all(uploadPromises);

    return urls;
  } catch (err) {
    console.error("Error extracting frames:", err);
    throw err;
  }
};

export default extractFrames;
