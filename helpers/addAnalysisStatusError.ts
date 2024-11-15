import { ObjectId } from "mongodb";
import doWithRetries from "./doWithRetries.js";
import { db } from "../init.js";

type Props = {
  analysisId: ObjectId;
  blurType: string;
  message: string;
};

export default async function addAnalysisStatusError({
  analysisId,
  blurType,
  message,
}: Props) {
  try {
    await doWithRetries({
      functionName: `addAnalysisStatusError`,
      functionToExecute: async () =>
        db.collection("BlurProcessingStatus").updateOne(
          { _id: new ObjectId(analysisId), blurType },
          {
            $set: {
              isRunning: false,
              isError: true,
              updatedAt: new Date(),
              message,
            },
          }
        ),
    });
  } catch (err) {
    console.log("Error in addAnalysisStatusError: ", err);
  }
}
