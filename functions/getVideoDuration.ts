import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { nanoid } from "nanoid";
import { promisify } from "util";
import httpError from "@/helpers/httpError.js";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

async function getVideoDuration(buffer: Buffer): Promise<number | unknown> {
  const tempFilePath = path.join(os.tmpdir(), `temp_file_${nanoid()}`);

  try {
    await writeFileAsync(tempFilePath, buffer);

    // Await the ffprobe call to ensure it completes before proceeding
    const duration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
        if (err) {
          return reject(httpError(err));
        }

        const duration = Number(metadata.format.duration);

        resolve(duration);
      });
    });

    return duration;
  } finally {
    await unlinkAsync(tempFilePath);
  }
}

export default getVideoDuration;
