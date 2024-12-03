import blurFace from "functions/blurFace.js";
import { roundLandmarks } from "helpers/utils.js";
import { FaceResult } from "@vladmandic/human";
import httpError from "@/helpers/httpError.js";

export default async function processFace(
  detection: FaceResult,
  orientedBuffer: Buffer
) {
  try {
    const silhouetteLandmarks = detection.annotations.silhouette;
    const roundedLandmarks = roundLandmarks(silhouetteLandmarks);

    return await blurFace(orientedBuffer, roundedLandmarks, "png");
  } catch (err) {
    throw httpError(err);
  }
}
