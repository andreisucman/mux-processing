import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import doWithRetries from "helpers/doWithRetries.js";
import httpError from "@/helpers/httpError.js";
import transcribeAudio from "./transcribeAudio.js";

type Props = {
  videoBuffer: Buffer;
  duration: number;
  userId: string;
};

export default async function transcribeVideoBuffer({
  userId,
  videoBuffer,
  duration,
}: Props) {
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

    const readStream = fs.createReadStream(audioFilePath);

    return await transcribeAudio({ duration, userId, readStream });
  } catch (err) {
    throw httpError(err);
  } finally {
    if (tempVideoFile) tempVideoFile.removeCallback();
    if (tempAudioFile) tempAudioFile.removeCallback();
  }
}
