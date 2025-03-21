import doWithRetries from "@/helpers/doWithRetries.js";
import { db } from "@/init.js";
import uploadToSpaces from "./uploadToSpaces.js";
import processEye from "./processEye.js";
import updateAnalytics from "./updateAnalytics.js";
import processFace from "./processFace.js";
import { detectWithHuman } from "./processFrame.js";
import sharp from "sharp";
import httpError from "@/helpers/httpError.js";
import getExistingResult from "./getExistingResult.js";
import createHashKey from "./createHashKey.js";

type Props = {
  url: string;
  blurType: string;
  userId: string;
};

export default async function blurImage({ userId, url, blurType }: Props) {
  try {
    const hash = await createHashKey(url);

    const existingResult = await getExistingResult({
      blurType,
      hash,
    });

    if (existingResult) return existingResult;

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
        userId,
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

    return resultUrl;
  } catch (err) {
    throw httpError(err);
  }
}
