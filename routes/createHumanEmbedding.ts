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

      const face = result.face[0];

      if (face && face.age <= 17) {
        res.status(400).json({ error: "minor" });
        return;
      }

      res.status(200).json({ message: face ? face.embedding : null });
    } catch (err) {
      next(err);
    }
  }
);

export default route;
