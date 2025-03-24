import blurFace from "functions/blurFace.js";
// import { roundLandmarks } from "helpers/utils.js";
import { FaceResult } from "@vladmandic/human";
import httpError from "@/helpers/httpError.js";

export default async function processFace(
  detection: FaceResult,
  orientedBuffer: Buffer
) {
  try {
    const silhouetteLandmarks = detection.annotations.silhouette;
    const points = silhouetteLandmarks.map((point) => ({
      x: point[0],
      y: point[1],
    }));
    const confidenceThreshold = 0.75;

    if (detection.faceScore < confidenceThreshold) {
      return orientedBuffer;
    }
    return await blurFace(orientedBuffer, points, "png");
  } catch (err) {
    throw httpError(err);
  }
}
