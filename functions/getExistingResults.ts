import { db } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import httpError from "@/helpers/httpError.js";

type GetExistingResultsProps = {
  hash: string;
  blurType: string;
};

export default async function getExistingResult({ blurType, hash }: GetExistingResultsProps) {
  try {
    const resultRecord = await doWithRetries(async () =>
      db.collection("BlurProcessingStatus").findOne({ hash, blurType }, { projection: { url: 1, thumbnail: 1 } })
    );

    return resultRecord;
  } catch (err) {
    throw httpError(err);
  }
}
