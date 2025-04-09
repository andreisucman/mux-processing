import * as dotenv from "dotenv";
dotenv.config();
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { S3Client } from "@aws-sdk/client-s3";
import * as promClient from "prom-client";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promClientRegister = new promClient.Registry();
const client = new MongoClient(process.env.DATABASE_URI!);
const db = client.db(process.env.DATABASE_NAME);
const adminDb = client.db(process.env.ADMIN_DATABASE_NAME);

const s3Client = new S3Client({
  region: process.env.DO_SPACES_REGION!,
  credentials: {
    accessKeyId: process.env.DO_SPACES_ACCESS_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET_KEY!,
  },
  endpoint: process.env.DO_SPACES_ENDPOINT,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const myConfig = {
  modelBasePath: "file://models/",
  debug: false,
  face: {
    emotion: { enabled: false },
    detector: {
      enabled: true,
      rotation: true,
      maxDetected: 2,
      minConfidence: 0.1,
    },
  }, // Enable rotation estimation
  body: { enabled: false },
  hand: { enabled: false },
  gesture: { enabled: false },
};

export { client, db, adminDb, s3Client, openai, __dirname, promClientRegister };
