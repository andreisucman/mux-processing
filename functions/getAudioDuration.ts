import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { nanoid } from "nanoid";
import { promisify } from "util";
import httpError from "@/helpers/httpError.js";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

async function getAudioDuration(buffer: Buffer): Promise<number | unknown> {
  const tempFilePath = path.join(os.tmpdir(), `temp_file_${nanoid()}`);
  const tempWavPath = path.join(os.tmpdir(), `temp_file_${nanoid()}.wav`);

  try {
    // Write the buffer to a temporary file
    await writeFileAsync(tempFilePath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .output(tempWavPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempWavPath, (err, metadata) => {
        if (err) {
          return reject(httpError(err));
        }

        const duration = Number(metadata.format.duration);
        resolve(duration);
      });
    });

    return duration;
  } finally {
    // Clean up the temporary files
    await unlinkAsync(tempFilePath);
    await unlinkAsync(tempWavPath);
  }
}

export default getAudioDuration;
