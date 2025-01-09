import * as dotenv from "dotenv";
dotenv.config();

import httpError from "@/helpers/httpError.js";
import { openai } from "@/init.js";
import { ReadStream } from "fs";
import updateSpend from "./updateSpend.js";
import doWithRetries from "@/helpers/doWithRetries.js";

type Props = {
  duration: number;
  userId: string;
  readStream: ReadStream;
  categoryName: string;
};

export default async function transcribeAudio({
  duration,
  userId,
  readStream,
  categoryName,
}: Props) {
  try {
    const model = "whisper-1";

    const response = await doWithRetries(() =>
      openai.audio.transcriptions.create({
        file: readStream,
        model,
        temperature: 0,
        prompt:
          "The audio may contain silence. Do not make up words or symbols. Don't add anything additional.",
      })
    );

    const units = Math.round(duration);
    const unitCost = Number(process.env.TRANSCRIBE_COST) / 60;

    updateSpend({
      functionName: "transcribeAudio",
      modelName: model,
      unitCost,
      categoryName,
      units,
      userId,
    });

    return response.text;
  } catch (err) {
    throw httpError(err);
  }
}
