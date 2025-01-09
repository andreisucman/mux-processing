import * as dotenv from "dotenv";
dotenv.config();
import express, { Response, NextFunction } from "express";
import sharp from "sharp";
import { CustomRequest } from "types.js";
import { __dirname } from "init.js";
import { detectWithHuman } from "functions/processFrame.js";
import doWithRetries from "helpers/doWithRetries.js";
import httpError from "@/helpers/httpError.js";

const route = express.Router();

route.post(
  "/",
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    if (req.header("authorization") !== process.env.PROCESSING_SECRET) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const { image } = req.body;

    if (!image) {
      res.status(400).json({ error: "Bad request" });
      return;
    }

    try {
      const response = await doWithRetries(async () => fetch(image));

      if (!response.ok) {
        throw httpError(
          `Failed to fetch the first image: ${response.statusText}`
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      const orientedBuffer = await sharp(buffer).rotate().toBuffer();

      const result = await detectWithHuman(orientedBuffer);

      if (!result || !result.face || result.face.length === 0) {
        throw new Error("Can't see any people on the image.");
      }

      if (result.face.length > 1) {
        throw new Error("Not more than one person on the image.");
      }

      if (result.face[0].age <= 17) {
        throw new Error("The person on the image appears to be a minor.");
      }

      res.status(200).json({ message: result.face[0].embedding });
    } catch (err) {
      next(err);
    }
  }
);

export default route;
