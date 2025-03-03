import * as dotenv from "dotenv";
dotenv.config();
import express, { Response, NextFunction } from "express";
import sharp from "sharp";
import { CustomRequest } from "types.js";
import { __dirname, db } from "init.js";
import uploadToSpaces from "functions/uploadToSpaces.js";
import { detectWithHuman } from "functions/processFrame.js";
import processEye from "functions/processEye.js";
import processFace from "functions/processFace.js";
import doWithRetries from "helpers/doWithRetries.js";
import getExistingResults from "functions/getExistingResult.js";
import createHashKey from "functions/createHashKey.js";
import httpError from "@/helpers/httpError.js";
import updateAnalytics from "@/functions/updateAnalytics.js";

const route = express.Router();

route.post(
  "/",
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    const { url, blurType } = req.body;

    if (!url || !["face", "eyes"].includes(blurType)) {
      res.status(400).json({ error: "Bad request" });
      return;
    }

    try {
      const hash = await createHashKey(url);

      const existingResult = await getExistingResults({
        blurType,
        hash,
      });

      if (existingResult) {
        res.status(200).json({ message: existingResult });
        return;
      }

      const response = await doWithRetries(async () => fetch(url));

      if (!response.ok) {
        throw httpError(`Failed to fetch the URL: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      const orientedBuffer = await sharp(buffer).rotate().toBuffer();
      const result = await detectWithHuman(orientedBuffer);

      let resultUrl;
      let resultBuffer;

      if (result && result.face.length > 0) {
        const incrementPayload: { [key: string]: number } = {
          "overview.usage.blur.total": 1,
        };

        if (blurType === "face") {
          resultBuffer = await processFace(result.face[0], orientedBuffer);
          incrementPayload["overview.usage.blur.blurType.face"] = 1;
        } else {
          resultBuffer = await processEye(result.face[0], orientedBuffer);
          incrementPayload["overview.usage.blur.blurType.eyes"] = 1;
        }

        updateAnalytics({
          userId: req.userId,
          incrementPayload,
        });
      } else {
        resultBuffer = orientedBuffer;
      }

      resultUrl = await uploadToSpaces({
        buffer: resultBuffer,
        mimeType: "image/webp",
      });

      const toInsert = {
        updatedAt: new Date(),
        isRunning: false,
        blurType,
        hash,
        url: resultUrl,
      };

      await doWithRetries(async () =>
        db.collection("BlurProcessingStatus").insertOne(toInsert)
      );

      res.status(200).json({ message: { url: resultUrl } });
    } catch (err) {
      next(err);
    }
  }
);

export default route;
