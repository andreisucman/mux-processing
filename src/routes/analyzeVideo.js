import * as dotenv from "dotenv";
dotenv.config();
import express from "express";
import checkVideoSafety from "../functions/checkVideoSafety.js";
import resizeVideoBuffer from "../functions/resizeVideoBuffer.js";
import transcribeVideoBuffer from "../functions/transcribeVideoBuffer.js";
import checkVideoDuration from "../functions/checkVideoDuration.js";
import checkTextSafety from "../functions/checkTextSafety.js";
import extractFrames from "../functions/extractFrames.js";

const route = express.Router();

route.post(
  "/",
  express.raw({ type: "application/octet-stream", limit: "100mb" }),
  async (req, res) => {
    if (req.header("Secret") !== process.env.SECRET) {
      return res.status(403).end();
    }

    try {
      const resizedVideoBuffer = await resizeVideoBuffer(req.body);
      const durationIsValid = await checkVideoDuration(resizedVideoBuffer);

      if (!durationIsValid) {
        return res.status(400).json({
          message: "Video must be between 5 and 30 seconds in length.",
        });
      }

      const { status: videoIsSafe } = await checkVideoSafety(
        resizedVideoBuffer
      );

      if (!videoIsSafe) {
        return res
          .status(400)
          .json({ message: "Video contains prohibited content" });
      }

      const transcription = await transcribeVideoBuffer(resizedVideoBuffer);
      const { verdict: textIsSafe } = await checkTextSafety(transcription);

      if (!textIsSafe) {
        return res
          .status(400)
          .json({ message: "Speech contains prohibited content" });
      }

      const urls = await extractFrames(resizedVideoBuffer);

      res.status(200).json({ message: urls });
    } catch (error) {
      console.error("Error processing video:", error);
      res
        .status(500)
        .send({ message: "Error processing video", error: error.message });
    }
  }
);

export default route;
