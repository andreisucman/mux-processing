import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { nanoid } from "nanoid";
import { promisify } from "util";
import httpError from "@/helpers/httpError.js";

const writeFileAsync = promisify(fs.writeFile);

async function safeDelete(file: string): Promise<void> {
  try {
    await fs.promises.rm(file, { force: true });
  } catch {}
}

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
    await Promise.all([safeDelete(tempFilePath), safeDelete(tempWavPath)]);
  }
}

export default getAudioDuration;
