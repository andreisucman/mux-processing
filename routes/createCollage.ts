import * as dotenv from "dotenv";
dotenv.config();
import express, { Response, NextFunction } from "express";
import { CustomRequest } from "types.js";
import { __dirname } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import combineImages from "@/functions/combineImages.js";
import httpError from "@/helpers/httpError.js";
import uploadToSpaces from "@/functions/uploadToSpaces.js";

const route = express.Router();

route.post(
  "/",
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    if (req.header("authorization") !== process.env.PROCESSING_SECRET) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const { images } = req.body;

    if (!images || images.length > 4 || images.length === 0) {
      res.status(400).json({ error: "Bad request" });
      return;
    }

    try {
      const imagePromises = images.map((image: string) =>
        doWithRetries(async () => fetch(image))
      );

      const responses = await Promise.all(imagePromises);

      const notOkResponse = responses.find((response) => !response.ok);

      if (notOkResponse) {
        throw httpError(
          `Failed to fetch the first image: ${notOkResponse.statusText}`
        );
      }

      const buffers = await Promise.all(
        responses.map(async (response) => {
          return Buffer.from(await response.arrayBuffer());
        })
      );

      const combinedImage = await combineImages(buffers);

      const combinedUrl = await uploadToSpaces({
        buffer: combinedImage,
        mimeType: "image/webp",
      });

      res.status(200).json({ message: combinedUrl });
    } catch (err) {
      next(err);
    }
  }
);

export default route;
