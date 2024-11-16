import path from "path";
import fs from "fs";
import sharp from "sharp";
import { human } from "../init.js";
import processEye from "./processEye.js";
import processFace from "./processFace.js";

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

    if (!result.face.length) {
      return null;
    }

    const detection = result.face[0];

    return detection;
  } catch (err) {
    console.log("Error in detectWithHuman: ", err);
    throw err;
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

    const detection = await detectWithHuman(orientedBuffer);

    if (detection) {
      let resultBuffer;

      if (blurType === "face") {
        resultBuffer = await processFace(detection, orientedBuffer);
      } else {
        resultBuffer = await processEye(
          detection,
          outputFramePath,
          orientedBuffer
        );
      }
      fs.writeFileSync(outputFramePath, resultBuffer);
    } else {
      fs.writeFileSync(outputFramePath, orientedBuffer);
    }

    if (cb) cb();
    console.log("Processed frame:", outputFramePath);
  } catch (err) {
    console.error(`Error processing frame ${frameFile}:`, err);
    const framePath = path.join(framesDir, frameFile);
    const outputFramePath = path.join(processedFramesDir, frameFile);

    fs.copyFileSync(framePath, outputFramePath);
  }
}
