import ffmpeg from "fluent-ffmpeg";
import { nanoid } from "nanoid";
import os from "os";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

function bufferToStream(buffer: Buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

type ExtractFramesProps = {
  input: string | Buffer;
  timestamps: string[] | number[];
};

export default async function extractFrames({
  input,
  timestamps,
}: ExtractFramesProps) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `screenshots-${nanoid()}`)
  );

  try {
    let finalInput;

    if (Buffer.isBuffer(input)) {
      finalInput = bufferToStream(input);
    } else {
      finalInput = input;
    }

    await new Promise((res, rej) => {
      ffmpeg(finalInput)
        .screenshots({
          timestamps,
          filename: "screenshot-%i.png",
          folder: tempDir,
          size: "720x1280",
        })
        .on("end", () => res("Screenshots created successfully"))
        .on("error", (err) => rej(err));
    });

    return tempDir;
  } catch (err) {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log("Error in extractFrames: ", err);
    throw err;
  }
}
