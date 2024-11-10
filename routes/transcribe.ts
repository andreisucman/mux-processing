import * as dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { Router, Request, Response } from "express";
import multer from "multer";
import { openai } from "../init.js";

const route = Router();
const upload = multer();

route.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const audioFile = req.file;
    if (!audioFile) {
      res.status(400).json({ message: "No audio file provided" });
      return;
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.path),
      model: "whisper-1",
    });

    res.status(200).json({ message: transcription.text });
  } catch (error) {
    res.status(500).json({ error: "Error transcribing audio" });
  }
});

export default route;
