import fs from "fs";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import { openai } from "../init.js";
import doWithRetries from "../helpers/doWithRetries.js";

export default async function transcribeVideoBuffer(videoBuffer: Buffer) {
  let tempVideoFile;
  let tempAudioFile;

  try {
    tempVideoFile = tmp.fileSync({ postfix: ".mp4" });
    tempAudioFile = tmp.fileSync({ postfix: ".wav" });

    const videoFilePath = tempVideoFile.name;
    const audioFilePath = tempAudioFile.name;

    await doWithRetries({
      functionName: "transcribeVideoBuffer - write video",
      functionToExecute: () =>
        fs.promises.writeFile(videoFilePath, videoBuffer),
    });

    await doWithRetries({
      functionName: "transcribeVideoBuffer - write ffmpeg",
      functionToExecute: () =>
        new Promise((resolve, reject) => {
          ffmpeg(videoFilePath)
            .noVideo()
            .audioCodec("pcm_s16le")
            .format("wav")
            .on("end", resolve)
            .on("error", reject)
            .save(audioFilePath);
        }),
    });

    const response = await doWithRetries({
      functionName: "transcribeVideoBuffer - transcribe",
      functionToExecute: () =>
        openai.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
          temperature: 0,
          prompt:
            "The audio may contain silence. Do not make up words or symbols.",
        }),
    });

    return response.text;
  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  } finally {
    if (tempVideoFile) tempVideoFile.removeCallback();
    if (tempAudioFile) tempAudioFile.removeCallback();
  }
}
