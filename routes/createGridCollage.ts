import * as dotenv from "dotenv";
dotenv.config();
import express, { Response, NextFunction } from "express";
import { CustomRequest } from "types.js";
import { __dirname } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import uploadToSpaces from "@/functions/uploadToSpaces.js";
import createGridCollage from "@/functions/createGridCollage.js";

const route = express.Router();

type Props = { images: string[]; collageSize?: number };

route.post(
  "/",
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    const { images, collageSize = 1120 }: Props = req.body;

    if (!images || images.length === 0 || collageSize > 2048) {
      res.status(400).json({ error: "Bad request" });
      return;
    }

    try {
      const imagePromises = images.map((image) =>
        doWithRetries(async () => fetch(image))
      );

      const imageResponses = await Promise.all(imagePromises);

      const bufferPromises = imageResponses.map((imageResponse) =>
        doWithRetries(async () =>
          Buffer.from(await imageResponse.arrayBuffer())
        )
      );

      const imageBuffers = await Promise.all(bufferPromises);

      const combinedImage = await createGridCollage({
        imageBuffers,
        collageSize,
      });

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
