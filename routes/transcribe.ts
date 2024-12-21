import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import os from "os";
import path from "path";
import { nanoid } from "nanoid";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { upperFirst } from "helpers/utils.js";
import { __dirname } from "init.js";
import transcribeAudio from "@/functions/transcribeAudio.js";
import getAudioDuration from "@/functions/getAudioDuration.js";
import fromUrlToBuffer from "@/functions/fromUrlToBuffer.js";
import httpError from "@/helpers/httpError.js";

const route = Router();
const upload = multer();

route.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.header("authorization") !== process.env.SECRET) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const userId = req.header("userid");

    if (!userId) {
      res.status(400).json({ message: "Bad request" });
      return;
    }

    const tempFilePath = path.join(os.tmpdir(), `temp_file_${nanoid()}.wav`);

    try {
      let audioFile = req.file;

      if (!audioFile) audioFile = req.body.audioFile;

      if (!audioFile) {
        res.status(400).json({ message: "No audio file provided" });
        return;
      }

      let audioBuffer = audioFile.buffer;

      if (typeof audioFile === "string") {
        const validOrigin = (audioFile as string).startsWith(
          `https://${process.env.DO_SPACES_BUCKET_NAME}`
        );

        if (!validOrigin) throw httpError(`Invalid audio origin: ${audioFile}`);
        
        audioBuffer = await fromUrlToBuffer(audioFile);
      }

      const duration = (await getAudioDuration(audioBuffer)) as number | null;

      if (!duration || duration > 300)
        throw httpError(`Duration is too long: ${duration}`);

      fs.writeFileSync(tempFilePath, audioBuffer);

      const readStream = fs.createReadStream(tempFilePath);

      const transcription = await transcribeAudio({
        duration,
        readStream,
        userId,
      });

      await fs.promises.unlink(tempFilePath);

      const formatted = transcription
        .toLowerCase()
        .split(".")
        .map((part) => upperFirst(part))
        .join(".");

      res.status(200).json({ message: formatted });
    } catch (err) {
      next(err);
    }
  }
);

export default route;
