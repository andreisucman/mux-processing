import fs from "fs";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import { openai } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import httpError from "@/helpers/httpError.js";

export default async function transcribeVideoBuffer(videoBuffer: Buffer) {
  let tempVideoFile;
  let tempAudioFile;

  try {
    tempVideoFile = tmp.fileSync({ postfix: ".mp4" });
    tempAudioFile = tmp.fileSync({ postfix: ".wav" });

    const videoFilePath = tempVideoFile.name;
    const audioFilePath = tempAudioFile.name;

    await doWithRetries(() =>
      fs.promises.writeFile(videoFilePath, videoBuffer)
    );

    await doWithRetries(
      () =>
        new Promise((resolve, reject) => {
          ffmpeg(videoFilePath)
            .noVideo()
            .audioCodec("pcm_s16le")
            .format("wav")
            .on("end", resolve)
            .on("error", reject)
            .save(audioFilePath);
        })
    );

    const response = await doWithRetries(() =>
      openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: "whisper-1",
        temperature: 0,
        prompt:
          "The audio may contain silence. Do not make up words or symbols.",
      })
    );

    return response.text;
  } catch (err) {
    throw httpError(err);
  } finally {
    if (tempVideoFile) tempVideoFile.removeCallback();
    if (tempAudioFile) tempAudioFile.removeCallback();
  }
}
