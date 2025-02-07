import crypto from "crypto";
import httpError from "@/helpers/httpError.js";

export default async function createHashKey(url: string) {
  try {
    let base64String = "";

    if (url.startsWith("http")) {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `Failed to fetch ${url}: ${res.status} ${res.statusText}`
        );
      }
      const arrayBuffer = await res.arrayBuffer();
      base64String = Buffer.from(arrayBuffer).toString("base64");
    } else {
      base64String = url;
    }

    return crypto.createHash("sha256").update(base64String).digest("hex");
  } catch (err) {
    throw httpError(`Hashing error: ${err.message}`);
  }
}
