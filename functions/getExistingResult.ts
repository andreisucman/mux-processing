import { db } from "../init.js";
import doWithRetries from "../helpers/doWithRetries.js";

type GetExistingResultsProps = {
  hash: string;
  blurType: string;
};

export default async function getExistingResult({
  blurType,
  hash,
}: GetExistingResultsProps) {
  try {
    const resultRecord = await doWithRetries({
      functionName: "getExistingResults",
      functionToExecute: async () =>
        db
          .collection("BlurProcessingStatus")
          .findOne({ hash, blurType }, { projection: { url: 1 } }),
    });

    return resultRecord?.url;
  } catch (err) {
    console.log("Error in getExistingResults: ", err);
    throw err;
  }
}
