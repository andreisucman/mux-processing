import blurFace from "./blurFace.js";
import { roundLandmarks } from "../helpers/utils.js";
import { FaceResult } from "@vladmandic/human";

export default async function processFace(
  detection: FaceResult,
  orientedBuffer: Buffer
) {
  try {
    const silhouetteLandmarks = detection.annotations.silhouette;
    const roundedLandmarks = roundLandmarks(silhouetteLandmarks);

    const blurResponse = await blurFace(
      orientedBuffer,
      roundedLandmarks,
      "png"
    );

    return blurResponse.resultBuffer;
  } catch (err) {
    console.log("Error in processFace: ", err);
    throw err;
  }
}
