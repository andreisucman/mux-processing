import * as dotenv from "dotenv";
dotenv.config();
import express, { Response, NextFunction } from "express";
import { CustomRequest } from "types.js";
import { __dirname } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import createCollage from "@/functions/createCollage.js";
import uploadToSpaces from "@/functions/uploadToSpaces.js";

const route = express.Router();

type Props = { images: string[][] };

route.post(
  "/",
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    // if (req.header("authorization") !== process.env.PROCESSING_SECRET) {
    //   res.status(403).json({ message: "Access denied" });
    //   return;
    // }

    const { images }: Props = req.body;

    if (!images || images.length > 3 || images.length === 0) {
      res.status(400).json({ error: "Bad request" });
      return;
    }

    try {
      const bufferGroups = [];

      for (const group of images) {
        const promises = group.map((image) =>
          doWithRetries(async () => fetch(image))
        );
        const responses = await Promise.all(promises);

        const buffers = [];

        for (const response of responses) {
          buffers.push(Buffer.from(await response.arrayBuffer()));
        }

        bufferGroups.push(buffers);
      }

      const combinedImage = await createCollage({
        bufferGroups,
        collageSize: 1120,
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
