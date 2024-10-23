import * as dotenv from "dotenv";
dotenv.config();
import express, { Response } from "express";
import sharp from "sharp";
import blurEyes from "../functions/blurEyes.js";
import { CustomRequest, EyeDataType } from "../types.js";
import {
  areLandmarksReliable,
  computeEyeCenter,
  computeEyeRadius,
} from "../helpers/utils.js";
import deleteFromSpaces from "../functions/deleteFromSpaces.js";
import { __dirname, human } from "../init.js";

const route = express.Router();

route.post("/", async (req: CustomRequest, res: Response) => {
  const { url } = req.body;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const orientedBuffer = await sharp(buffer).rotate().toBuffer();

    const tensor = human.tf.tidy(() => {
      const decode = human.tf.node.decodeImage(buffer, 3);
      let expand;
      if (decode.shape[2] === 4) {
        // input is in rgba format, need to convert to rgb
        const channels = human.tf.split(decode, 4, 2); // tf.split(tensor, 4, 2); // split rgba to channels
        const rgb = human.tf.stack([channels[0], channels[1], channels[2]], 2); // stack channels back to rgb and ignore alpha
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
      res.status(404).json({ error: "No faces found in the image." });
      return;
    }

    const detection = result.face[0];
    const yaw = detection.rotation.angle.yaw;

    const eyeData: EyeDataType = {
      leftEyeCenter: null,
      leftEyeRadius: null,
      rightEyeCenter: null,
      rightEyeRadius: null,
    };

    const confidenceThreshold = 0.5;

    if (yaw < 0.4) {
      // Face is facing forward or to the left (from the viewer's perspective)
      // Process right eye
      const rightIrisLandmarks = detection.annotations.rightEyeIris;
      if (
        areLandmarksReliable(rightIrisLandmarks) &&
        detection.score > confidenceThreshold
      ) {
        // Compute right eye data
        const rightEyeCenter = computeEyeCenter(rightIrisLandmarks);
        const rightEyeRadius = computeEyeRadius(rightIrisLandmarks);
        eyeData.rightEyeCenter = rightEyeCenter;
        eyeData.rightEyeRadius = rightEyeRadius;
      }
    }
    if (yaw > -0.4) {
      // Face is facing forward or to the right
      // Process left eye
      const leftIrisLandmarks = detection.annotations.leftEyeIris;
      if (
        areLandmarksReliable(leftIrisLandmarks) &&
        detection.score > confidenceThreshold
      ) {
        const leftEyeCenter = computeEyeCenter(leftIrisLandmarks);
        const leftEyeRadius = computeEyeRadius(leftIrisLandmarks);
        eyeData.leftEyeCenter = leftEyeCenter;
        eyeData.leftEyeRadius = leftEyeRadius;
      }
    }

    if (!eyeData.leftEyeCenter && !eyeData.rightEyeCenter) {
      res.status(404).json({ error: "No visible eyes found in the image." });
      return;
    }

    const resultUrl = await blurEyes(orientedBuffer, eyeData);
    deleteFromSpaces(url);

    res.status(200).json({ message: resultUrl });
  } catch (error) {
    deleteFromSpaces(url);
    console.error("Error processing image:", error);
    res
      .status(500)
      .send({ message: "Error processing image", error: error.message });
  }
});

export default route;
