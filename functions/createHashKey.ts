import crypto from "crypto";
import httpError from "@/helpers/httpError.js";
import fs from "fs/promises";

export default async function createHashKey(url: string) {
  try {
    let buffer: Buffer;

    if (url.startsWith("http")) {
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(
          `Failed to fetch ${url}: ${res.status} ${res.statusText}`
        );
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = await fs.readFile(url);
    }

    return crypto.createHash("sha256").update(buffer).digest("hex");
  } catch (err) {
    throw httpError(`Hashing error: ${err.message}`);
  }
}
