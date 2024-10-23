import * as dotenv from "dotenv";
dotenv.config();
import { s3Client } from "../init.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

async function deleteFromSpaces(url: string) {
  const fileName = url.match(/\/([^\/]+)$/)[1];

  const params = {
    Bucket: process.env.DO_SPACES_BUCKET_NAME,
    Key: fileName,
  };

  try {
    const deleteObjectCommand = new DeleteObjectCommand(params);
    await s3Client.send(deleteObjectCommand);
  } catch (error) {
    console.log("Error in deleteFromSpaces", error);
  }
}

export default deleteFromSpaces;
