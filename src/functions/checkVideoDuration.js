import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

async function checkVideoDuration(buffer) {
  const tempFilePath = path.join(os.tmpdir(), `temp_video_${Date.now()}`);

  try {
    await writeFileAsync(tempFilePath, buffer);

    // Await the ffprobe call to ensure it completes before proceeding
    const result = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
        if (err) {
          return reject(err);
        }

        const duration = metadata.format.duration;

        if (duration >= 5 && duration <= 30) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    return result;
  } finally {
    // Delete the temporary file after ffprobe has finished
    await unlinkAsync(tempFilePath);
  }
}

export default checkVideoDuration;
