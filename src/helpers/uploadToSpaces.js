import * as dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { s3Client } from "../init.js";
import { nanoid } from "nanoid";
import { mimeToExtension } from "./utils.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

async function uploadToSpaces({
  url,
  buffer,
  mimeType,
  localUrl,
  spaceFolder,
  fileName = `MYO-${nanoid()}`,
  spaceName = process.env.DO_SPACES_BUCKET_NAME,
}) {
  try {
    if (url) {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to fetch: ${response.statusText}`);
      buffer = await response.arrayBuffer();
      mimeType = response.headers.get("content-type") || mimeType;
    }

    if (localUrl) buffer = await fs.promises.readFile(localUrl);

    const fileExtension = mimeType
      ? mimeToExtension(mimeType)
      : localUrl.split(".").pop();

    const filePath = `${
      spaceFolder ? `${spaceFolder}/` : ""
    }${fileName}.${fileExtension}`;

    const uploadParams = {
      Bucket: spaceName,
      Key: filePath,
      Body: buffer,
      ContentType: mimeType,
      ACL: "public-read",
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const domain = process.env.DO_SPACES_ENDPOINT.split("https://")[1];
    return `https://${spaceName}.${domain}/${filePath}`;
  } catch (error) {
    throw new Error(`Error processing upload: ${error.message}`);
  }
}

export default uploadToSpaces;
