import fs from "fs";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import { openai } from "../init.js";
import doWithRetries from "../helpers/doWithRetries.js";

export default async function transcribeVideoBuffer(videoBuffer) {
  let tempVideoFile;
  let tempAudioFile;

  try {
    tempVideoFile = tmp.fileSync({ postfix: ".mp4" });
    tempAudioFile = tmp.fileSync({ postfix: ".wav" });

    const videoFilePath = tempVideoFile.name;
    const audioFilePath = tempAudioFile.name;

    await doWithRetries({
      functionToExecute: () =>
        fs.promises.writeFile(videoFilePath, videoBuffer),
    });

    await doWithRetries({
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
      functionToExecute: () =>
        openai.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
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
