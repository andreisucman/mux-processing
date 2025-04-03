import "dotenv/config";
import express, { Response, NextFunction } from "express";
import sharp from "sharp";
import { CustomRequest } from "@/types.js";
import { __dirname, adminDb } from "@/init.js";
import uploadToSpaces from "@/functions/uploadToSpaces.js";
import doWithRetries from "@/helpers/doWithRetries.js";

const route = express.Router();

type BlurDot = {
  originalWidth: number;
  originalHeight: number;
  scale: number;
  angle: number;
  x: number;
  y: number;
};

type Props = {
  blurDots: BlurDot[];
  url: string;
};

function computeScaledRadii(finalWidth, finalHeight, angle) {
  const angleRad = (angle * Math.PI) / 180;
  const rx = finalWidth / 2;
  const ry = finalHeight / 2;

  const denominator1 = Math.sqrt(
    (rx * Math.cos(angleRad)) ** 2 + (ry * Math.sin(angleRad)) ** 2
  );
  const s1 = rx / denominator1;

  const denominator2 = Math.sqrt(
    (rx * Math.sin(angleRad)) ** 2 + (ry * Math.cos(angleRad)) ** 2
  );
  const s2 = ry / denominator2;

  const s = Math.min(s1, s2);

  return {
    scaledRx: rx * s,
    scaledRy: ry * s,
  };
}

route.post(
  "/",
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    const { url, blurDots }: Props = req.body;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      const oriented = await sharp(Buffer.from(buffer))
        .rotate()
        .ensureAlpha()
        .toBuffer();

      const finalImage = await blurProcessor(oriented, blurDots);
      const resultUrl = await uploadToSpaces({
        buffer: finalImage,
        mimeType: "image/webp",
      });

      doWithRetries(() =>
        adminDb
          .collection("BlurDataset")
          .insertOne({ url, blurDots, numberOfDots: blurDots.length })
      );

      res.json({ url: resultUrl });
    } catch (err) {
      next(err);
    }
  }
);

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
    const {
      x,
      y,
      originalWidth: maskWidth,
      originalHeight: maskHeight,
      scale,
      angle,
    } = mask;
    const safeX = Math.round(x);
    const safeY = Math.round(y);
    const finalWidth = Math.round(maskWidth * scale);
    const finalHeight = Math.round(maskHeight * scale);

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

    const { scaledRx, scaledRy } = computeScaledRadii(
      finalWidth,
      finalHeight,
      angle
    );

    const svgMask = Buffer.from(`
        <svg viewBox="0 0 ${finalWidth} ${finalHeight}" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="${finalWidth / 2}" cy="${finalHeight / 2}" 
                   rx="${scaledRx}" ry="${scaledRy}" 
                   fill="white"
                   transform="rotate(${angle} ${finalWidth / 2} ${
      finalHeight / 2
    })"/>
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

  const finalOverlay = await sharp(overlay)
    .composite(overlayComposites)
    .toFormat("png")
    .toBuffer();

  const resultBuffer = await image
    .composite([{ input: finalOverlay, blend: "over" }])
    .toFormat("png")
    .toBuffer();

  return resultBuffer;
}

export default route;
