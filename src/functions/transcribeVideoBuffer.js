import fs from "fs";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import { openai } from "../init.js";
import doWithRetries from "../helpers/doWithRetries.js";

export default async function transcribeVideoBuffer(videoBuffer) {
  let tempVideoFile;
  let tempAudioFile;

  try {
    console.log("transcribeVideoBuffer line 12");
    tempVideoFile = tmp.fileSync({ postfix: ".mp4" });
    tempAudioFile = tmp.fileSync({ postfix: ".wav" });

    const videoFilePath = tempVideoFile.name;
    const audioFilePath = tempAudioFile.name;

    await doWithRetries({
      functionToExecute: () =>
        fs.promises.writeFile(videoFilePath, videoBuffer),
    });
    console.log("transcribeVideoBuffer line 23");

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

    console.log("transcribeVideoBuffer line 38");

    const response = await doWithRetries({
      functionToExecute: () =>
        openai.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
          temperature: 0,
          prompt:
            "The audio may contain silence. Do not make up words or symbols.",
        }),
    });
    console.log("transcribeVideoBuffer line 50");

    return response.text;
  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  } finally {
    if (tempVideoFile) tempVideoFile.removeCallback();
    if (tempAudioFile) tempAudioFile.removeCallback();
  }
}
