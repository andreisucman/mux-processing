import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { openai } from "../init.js";
import tmp from "tmp";

export default async function transcribeVideoBuffer(videoBuffer) {
  let tempVideoFile;
  let tempAudioFile;

  try {
    tempVideoFile = tmp.fileSync({ postfix: ".mp4" });
    tempAudioFile = tmp.fileSync({ postfix: ".wav" });

    const videoFilePath = tempVideoFile.name;
    const audioFilePath = tempAudioFile.name;

    await fs.promises.writeFile(videoFilePath, videoBuffer);

    await new Promise((resolve, reject) => {
      ffmpeg(videoFilePath)
        .noVideo()
        .audioCodec("pcm_s16le")
        .format("wav")
        .on("end", resolve)
        .on("error", reject)
        .save(audioFilePath);
    });

    const response = await openai.createTranscription(
      fs.createReadStream(audioFilePath),
      "whisper-1"
    );

    const transcript = response.data.text;

    return transcript;
  } catch (error) {
    console.error("Error processing video:", error);
    throw error;
  } finally {
    if (tempVideoFile) tempVideoFile.removeCallback();
    if (tempAudioFile) tempAudioFile.removeCallback();
  }
}
