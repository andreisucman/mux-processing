import fs from "fs";
import crypto from "crypto";
import doWithRetries from "@/helpers/doWithRetries.js";
import httpError from "@/helpers/httpError.js";

export default async function createHashKey(url: string) {
  try {
    const arrayBuffer = await doWithRetries(async () => {
      if (url.startsWith("http")) {
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(
            `Failed to fetch ${url}: ${res.status} ${res.statusText}`
          );
        }
        return await res.arrayBuffer();
      } else {
        return await fs.promises.readFile(url);
      }
    });

    const base64String = Buffer.from(arrayBuffer).toString("base64");
    const base64Uri = base64String.split(",").pop();
    return crypto.createHash("sha256").update(base64Uri).digest("hex");
  } catch (err) {
    throw httpError(err);
  }
}
