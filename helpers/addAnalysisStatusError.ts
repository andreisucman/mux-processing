import { ObjectId } from "mongodb";
import doWithRetries from "./doWithRetries.js";
import { db } from "../init.js";

type Props = {
  contentId: ObjectId;
  blurType: string;
  message: string;
};

export default async function addAnalysisStatusError({
  contentId,
  blurType,
  message,
}: Props) {
  try {
    await doWithRetries({
      functionName: `addAnalysisStatusError`,
      functionToExecute: async () =>
        db
          .collection("BlurProcessingStatus")
          .updateOne(
            { contentId: new ObjectId(contentId), blurType },
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
