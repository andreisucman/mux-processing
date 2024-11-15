import { db } from "../init.js";
import doWithRetries from "../helpers/doWithRetries.js";

type checkIfResultExistProps = {
  hashes: string[];
  blurType: string;
};

export default async function getExistingResults({
  blurType,
  hashes,
}: checkIfResultExistProps) {
  try {
    const resultRecords = await doWithRetries({
      functionName: "checkIfResultExists",
      functionToExecute: async () =>
        db
          .collection("BlurProcessingStatus")
          .find(
            { hash: { $in: hashes }, blurType },
            { projection: { originalUrl: 1, resultUrl: 1, contentKey: 1 } }
          )
          .toArray(),
    });

    return resultRecords;
  } catch (err) {
    console.log("Error in getExistingResults: ", err);
    throw err;
  }
}
