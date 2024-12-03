import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { upperFirst } from "helpers/utils.js";
import { openai, __dirname } from "init.js";
import doWithRetries from "@/helpers/doWithRetries.js";

const route = Router();
const upload = multer();

route.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const audioFile = req.file;
      if (!audioFile) {
        res.status(400).json({ message: "No audio file provided" });
        return;
      }

      const tempFilePath = path.join(
        __dirname,
        `processing/temp/${nanoid()}.wav`
      );
      fs.writeFileSync(tempFilePath, audioFile.buffer);

      const transcription = await doWithRetries(() =>
        openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: "whisper-1",
        })
      );

      await fs.promises.unlink(tempFilePath);

      const formatted = transcription.text
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
