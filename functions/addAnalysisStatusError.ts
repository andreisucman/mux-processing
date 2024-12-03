import { ObjectId } from "mongodb";
import doWithRetries from "helpers/doWithRetries.js";
import { db } from "init.js";
import httpError from "@/helpers/httpError.js";

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
    await doWithRetries(async () =>
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
      )
    );
  } catch (err) {
    throw httpError(err);
  }
}
