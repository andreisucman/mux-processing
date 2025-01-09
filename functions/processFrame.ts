import path from "path";
import fs from "fs";
import sharp from "sharp";
import { human } from "init.js";
import processEye from "functions/processEye.js";
import processFace from "functions/processFace.js";
import httpError from "@/helpers/httpError.js";

export async function detectWithHuman(orientedBuffer: Buffer) {
  try {
    const tensor = human.tf.tidy(() => {
      const decode = human.tf.node.decodeImage(orientedBuffer, 3);
      let expand;

      if (decode.shape[2] === 4) {
        const channels = human.tf.split(decode, 4, 2);
        const rgb = human.tf.stack([channels[0], channels[1], channels[2]], 2);
        expand = human.tf.reshape(rgb, [
          1,
          decode.shape[0],
          decode.shape[1],
          3,
        ]);
      } else {
        expand = human.tf.expandDims(decode, 0);
      }

      const cast = human.tf.cast(expand, "float32");
      return cast;
    });

    const result = await human.detect(tensor);
    human.tf.dispose(tensor);

    return result;
  } catch (err) {
    throw httpError(err);
  }
}

type ProcessFrameProps = {
  frameFile: string;
  framesDir: string;
  processedFramesDir: string;
  blurType: "face" | "eyes";
  cb?: () => void;
};

export async function processFrame({
  frameFile,
  framesDir,
  processedFramesDir,
  blurType,
  cb,
}: ProcessFrameProps) {
  try {
    const framePath = path.join(framesDir, frameFile);
    const outputFramePath = path.join(processedFramesDir, frameFile);

    const frameBuffer = fs.readFileSync(framePath);

    if (!frameBuffer || frameBuffer.length === 0) {
      console.warn(`Frame ${frameFile} is empty or corrupted.`);
      fs.copyFileSync(framePath, outputFramePath);
      return;
    }

    const orientedBuffer = await sharp(frameBuffer).rotate().toBuffer();

    const result = await detectWithHuman(orientedBuffer);

    if (result && result.face.length > 0) {
      let resultBuffer;

      if (blurType === "face") {
        resultBuffer = await processFace(result.face[0], orientedBuffer);
      } else {
        resultBuffer = await processEye(
          result.face[0],
          outputFramePath,
          orientedBuffer
        );
      }
      fs.writeFileSync(outputFramePath, resultBuffer);
    } else {
      fs.writeFileSync(outputFramePath, orientedBuffer);
    }

    if (cb) cb();
  } catch (err) {
    console.error(`Error processing frame ${frameFile}:`, err);
    const framePath = path.join(framesDir, frameFile);
    const outputFramePath = path.join(processedFramesDir, frameFile);

    fs.copyFileSync(framePath, outputFramePath);
  }
}
