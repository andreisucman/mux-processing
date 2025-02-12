import fs from "fs";
import blurEyes from "functions/blurEyes.js";
import {
  areLandmarksReliable,
  computeEyeCenter,
  computeEyeRadius,
} from "helpers/utils.js";
import { FaceResult } from "@vladmandic/human";
import { EyeDataType } from "types.js";
import httpError from "@/helpers/httpError.js";

export default async function processEye(
  detection: FaceResult,
  outputFramePath: string,
  orientedBuffer: Buffer
) {
  try {
    const yaw = detection.rotation.angle.yaw;

    const eyeData: EyeDataType = {
      leftEyeCenter: null,
      leftEyeRadius: null,
      rightEyeCenter: null,
      rightEyeRadius: null,
    };

    const confidenceThreshold = 0.5;

    if (yaw < 0.5) {
      const rightIrisLandmarks = detection.annotations.rightEyeIris;
      if (
        areLandmarksReliable(rightIrisLandmarks) &&
        detection.score > confidenceThreshold
      ) {
        const rightEyeCenter = computeEyeCenter(rightIrisLandmarks);
        const rightEyeRadius = computeEyeRadius(rightIrisLandmarks);
        eyeData.rightEyeCenter = rightEyeCenter;
        eyeData.rightEyeRadius = rightEyeRadius;
      }
    }
    if (yaw > -0.5) {
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
      fs.writeFileSync(outputFramePath, orientedBuffer);
      return;
    }

    return await blurEyes(orientedBuffer, eyeData, "png");
  } catch (err) {
    throw httpError(err);
  }
}
