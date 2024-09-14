import * as dotenv from "dotenv";
dotenv.config();
import { s3ClientAws } from "../init.js";
import { nanoid } from "nanoid";
import {
  RekognitionClient,
  StartContentModerationCommand,
  GetContentModerationCommand,
} from "@aws-sdk/client-rekognition";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import checkForProhibitedContent from "../helpers/checkForProhibitedContent.js";
import ffmpeg from "fluent-ffmpeg";
import doWithRetries from "../helpers/doWithRetries.js";

const rekognitionClient = new RekognitionClient({
  credentials: {
    accessKeyId: process.env.AWS_REKOGNITION_ACCESS_KEY,
    secretAccessKey: process.env.AWS_REKOGNITION_SECRET_KEY,
  },
  region: process.env.AWS_REGION,
});

async function deleteFile(fileKey) {
  try {
    await s3ClientAws.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_REKOGNITION_BUCKET_NAME,
        Key: fileKey,
      })
    );
  } catch (deleteErr) {
    console.error("Error deleting video from S3:", deleteErr);
    throw deleteErr;
  }
}

async function convertVideo(inputBuffer) {
  const tempDir = os.tmpdir();
  const inputFilePath = path.join(tempDir, `input-${nanoid()}`);
  const outputFilePath = path.join(tempDir, `output-${nanoid()}.mp4`);

  try {
    await fs.promises.writeFile(inputFilePath, inputBuffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputFilePath)
        .outputFormat("mp4")
        .on("end", resolve)
        .on("error", reject)
        .save(outputFilePath);
    });

    const outputBuffer = await fs.promises.readFile(outputFilePath);
    return outputBuffer;
  } finally {
    await Promise.allSettled([
      fs.promises.unlink(inputFilePath).catch(() => {}),
      fs.promises.unlink(outputFilePath).catch(() => {}),
    ]);
  }
}

export default async function checkVideoSafety(buffer) {
  const convertedVideo = await doWithRetries({
    functionName: "checkVideoSafety - analyzeVideo",
    functionToExecute: () => convertVideo(buffer),
  });

  const extension = "mp4";
  const fileKey = `${nanoid()}.${extension}`;

  try {
    try {
      await s3ClientAws.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_REKOGNITION_BUCKET_NAME,
          Key: fileKey,
          Body: convertedVideo,
        })
      );
      console.log("File uploaded", fileKey);
    } catch (err) {
      console.error("Error uploading video to S3:", err);
      throw err;
    }

    const moderationParams = {
      Video: {
        S3Object: {
          Bucket: process.env.AWS_REKOGNITION_BUCKET_NAME,
          Name: fileKey,
        },
      },
      MinConfidence: 80,
    };

    const moderationCommand = new StartContentModerationCommand(
      moderationParams
    );

    const moderationResponse = await rekognitionClient.send(moderationCommand);
    const jobId = moderationResponse.JobId;

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const moderationStatusParams = { JobId: jobId };
      const moderationStatusCommand = new GetContentModerationCommand(
        moderationStatusParams
      );
      const moderationStatusResponse = await rekognitionClient.send(
        moderationStatusCommand
      );
      const status = moderationStatusResponse.JobStatus;

      if (status === "SUCCEEDED") {
        const moderationLabels = moderationStatusResponse.ModerationLabels;

        const isProhibited = checkForProhibitedContent(moderationLabels);

        await deleteFile(fileKey);
        if (isProhibited) {
          return {
            status: false,
            message: "Video contains prohibited content",
          };
        }

        return {
          status: true,
        };
      } else if (status === "FAILED" || status === "STOPPED") {
        await deleteFile(fileKey);
        return { status: null, message: "Error during video processing" };
      }
    }
  } catch (err) {
    console.error("Error in checking video safety:", err);
    throw err;
  }
}
