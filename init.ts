import * as dotenv from "dotenv";
dotenv.config();
import path from "path";
import { fileURLToPath } from "url";
import { BackendEnum, Human } from "@vladmandic/human";
import { MongoClient } from "mongodb";
import { S3Client } from "@aws-sdk/client-s3";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new MongoClient(process.env.DATABASE_URI!);
const db = client.db(process.env.USER_DATABASE_NAME);

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

const humanConfig = {
  backend: "tensorflow" as BackendEnum, 
  modelBasePath: "file://models/",
  debug: true,
  async: false,
  filter: {
    enabled: true,
    flip: true,
  },
  face: {
    enabled: true,
    detector: { enabled: true, rotation: true }, // Enable rotation estimation
    mesh: { enabled: true },
    iris: { enabled: true },
    description: { enabled: false },
    emotion: { enabled: false },
  },
  hand: {
    enabled: false,
  },
  body: {
    enabled: false,
  },
  object: {
    enabled: false,
  },
};

const human = new Human(humanConfig);

await human.tf.ready();

await human.load();

export { human, client, db, s3Client, openai, __dirname };
