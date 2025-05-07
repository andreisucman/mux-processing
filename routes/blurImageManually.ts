import "dotenv/config";
import express, { Response, NextFunction } from "express";
import sharp from "sharp";
import { CustomRequest } from "@/types.js";
import { __dirname, adminDb, db } from "@/init.js";
import uploadToSpaces from "@/functions/uploadToSpaces.js";
import doWithRetries from "@/helpers/doWithRetries.js";
import createHashKey from "@/functions/createHashKey.js";
import getExistingResult from "@/functions/getExistingResult.js";

const route = express.Router();

type BlurDot = {
  originalWidth: number;
  originalHeight: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  x: number;
  y: number;
};

type Props = {
  blurDots: BlurDot[];
  url: string;
  resetOld?: boolean;
};

route.post("/", async (req: CustomRequest, res: Response, next: NextFunction) => {
  const { url, blurDots, resetOld }: Props = req.body;

  try {
    const hash = await createHashKey(url);

    if (!resetOld) {
      const existingResult = await getExistingResult({
        hash,
      });

      if (existingResult) {
        res.status(200).json({ message: existingResult });
        return;
      }
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const oriented = await sharp(Buffer.from(buffer)).rotate().ensureAlpha().toBuffer();

    const finalImage = await blurProcessor(oriented, blurDots);
    const resultUrl = await uploadToSpaces({
      buffer: finalImage,
      mimeType: "image/webp",
    });

    doWithRetries(() => adminDb.collection("BlurDataset").insertOne({ url, blurDots, numberOfDots: blurDots.length }));

    const toUpdate = {
      updatedAt: new Date(),
      isRunning: false,
      url: resultUrl,
    };

    doWithRetries(async () => db.collection("BlurProcessingStatus").updateOne({ hash }, { $set: toUpdate }));

    res.json({ message: resultUrl });
  } catch (err) {
    next(err);
  }
});

async function blurProcessor(imageBuffer: Buffer, masks: BlurDot[]) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  const overlay = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .toFormat("png")
    .toBuffer();

  const overlayComposites = [];

  for (const mask of masks) {
    const { x, y, originalWidth: maskWidth, originalHeight: maskHeight, scaleX, scaleY, angle } = mask;
    if (maskWidth <= 0 || maskHeight <= 0) {
      throw new Error(`Invalid mask dimensions: ${JSON.stringify(mask)}`);
    }

    const safeScaleX = Math.abs(scaleX);
    const safeScaleY = Math.abs(scaleY);

    const safeX = Math.round(x);
    const safeY = Math.round(y);
    const finalWidth = Math.max(1, Math.round(maskWidth * safeScaleX));
    const finalHeight = Math.max(1, Math.round(maskHeight * safeScaleY));

    if (safeX + finalWidth > width || safeY + finalHeight > height) {
      throw new Error(`Extraction area exceeds image bounds`);
    }

    const region = await sharp(imageBuffer)
      .extract({
        left: safeX,
        top: safeY,
        width: finalWidth,
        height: finalHeight,
      })
      .blur(50)
      .toFormat("png")
      .toBuffer();

    const svgMask = Buffer.from(`
        <svg viewBox="0 0 ${finalWidth} ${finalHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="${finalWidth}" height="${finalHeight}" fill="white"
          transform="rotate(${angle} ${finalWidth / 2} ${finalHeight / 2})"/>
        </svg>
      `);

    const maskedBlur = await sharp(region)
      .composite([{ input: svgMask, blend: "dest-in" }])
      .toFormat("png")
      .toBuffer();

    overlayComposites.push({
      input: maskedBlur,
      left: safeX,
      top: safeY,
    });
  }

  const finalOverlay = await sharp(overlay).composite(overlayComposites).toFormat("png").toBuffer();

  const resultBuffer = await image
    .composite([{ input: finalOverlay, blend: "over" }])
    .toFormat("png")
    .toBuffer();

  return resultBuffer;
}

export default route;
