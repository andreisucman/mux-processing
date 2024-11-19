import ffmpeg from "fluent-ffmpeg";
import { nanoid } from "nanoid";
import os from "os";
import fs from "fs";
import path from "path";

type ExtractFramesProps = {
  width?: number;
  height?: number;
  input: string | Buffer;
  timestamps: string[] | number[];
};

export default async function extractFrames({
  input,
  timestamps,
  width = 720,
  height = 1280,
}: ExtractFramesProps): Promise<string> {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `screenshots-${nanoid()}`)
  );

  let tempFilePath: string | undefined;

  try {
    if (Buffer.isBuffer(input)) {
      tempFilePath = path.join(tempDir, `temp-video-${nanoid()}.mp4`);
      fs.writeFileSync(tempFilePath, input);
      input = tempFilePath; // Reassign `input` as a string file path
    }

    if (typeof input !== "string") {
      throw new Error(
        "Invalid input type. Input must be a file path or Buffer."
      );
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg(input as any)
        .screenshots({
          timestamps,
          filename: "screenshot-%i.png",
          folder: tempDir,
          size: `${width}x${height}`,
        })
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    return tempDir;
  } catch (error) {
    console.error("Error in extractFrames:", error);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    throw error;
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}
