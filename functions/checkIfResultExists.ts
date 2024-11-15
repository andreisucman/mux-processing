import { db } from "../init.js";
import { getBase64Keys } from "../helpers/utils.js";
import doWithRetries from "../helpers/doWithRetries.js";

type checkIfResultExistProps = {
  base64Keys: string[];
  blurType: string;
};

export default async function getExistingResults({
  blurType,
  base64Keys,
}: checkIfResultExistProps) {
  try {
    const resultRecords = await doWithRetries({
      functionName: "checkIfResultExists",
      functionToExecute: async () =>
        db
          .collection("BlurProcessingStatus")
          .find(
            { base64Key: { $in: base64Keys }, blurType },
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
