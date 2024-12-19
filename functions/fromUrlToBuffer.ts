import httpError from "@/helpers/httpError.js";
import doWithRetries from "@/helpers/doWithRetries.js";

export default async function fromUrlToBuffer(url: string) {
  try {
    const response = await doWithRetries(async () => fetch(url));

    if (!response.ok) {
      const body = await response.json();
      throw httpError(body);
    }

    const arrayBuffer = await response.arrayBuffer();

    return Buffer.from(arrayBuffer);
  } catch (err) {
    throw httpError(err);
  }
}
