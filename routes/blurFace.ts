import * as dotenv from "dotenv";
dotenv.config();
import express, { Response } from "express";
import sharp from "sharp";
import blurFace from "../functions/blurFace.js";
import { CustomRequest } from "../types.js";
import { roundLandmarks } from "../helpers/utils.js";
import { __dirname, human } from "../init.js";

const route = express.Router();

route.post("/", async (req: CustomRequest, res: Response) => {
  try {
    const { url } = req.body;

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
        ]); // move extra dim from the end of tensor and use it as batch number instead
      } else {
        expand = human.tf.expandDims(decode, 0);
      }
      const cast = human.tf.cast(expand, "float32");
      return cast;
    });

    const result = await human.detect(tensor);

    human.tf.dispose(tensor);

    if (!result.face.length) {
      res.status(200).json({ message: url });
      return;
    }

    const detection = result.face[0];
    const silhouetteLandmarks = detection.annotations.silhouette;
    const roundedLandmarks = roundLandmarks(silhouetteLandmarks);

    const resultUrl = await blurFace(orientedBuffer, roundedLandmarks);
    res.status(200).json({ message: resultUrl });
  } catch (error) {
    console.error("Error processing image:", error);
    res
      .status(500)
      .send({ message: "Error processing image", error: error.message });
  }
});

export default route;
