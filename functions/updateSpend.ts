import { ObjectId } from "mongodb";
import doWithRetries from "@/helpers/doWithRetries.js";
import httpError from "@/helpers/httpError.js";
import { adminDb, db } from "@/init.js";
import { setToUtcMidnight } from "@/helpers/utils.js";

type Props = {
  userId: string;
  functionName: string;
  categoryName: string;
  modelName: string;
  units: number;
  unitCost: number;
  userType: "user" | "client";
};

export default async function updateSpend({
  userId,
  functionName,
  categoryName,
  modelName,
  units,
  unitCost,
  userType,
}: Props) {
  const createdAt = setToUtcMidnight(new Date());

  const totalCost = units * unitCost;

  const incrementPayload = {
    [`overview.${userType}.accounting.totalCost`]: totalCost,
    [`accounting.${userType}.totalCost`]: totalCost,
    [`accounting.${userType}.totalUnits`]: units,
    [`accounting.${userType}.units.functions.${functionName}`]: units,
    [`accounting.${userType}.cost.functions.${functionName}`]: totalCost,
    [`accounting.${userType}.units.models.${modelName}`]: units,
    [`accounting.${userType}.cost.models.${modelName}`]: totalCost,
    [`accounting.${userType}.units.categories.${categoryName}`]: units,
    [`accounting.${userType}.cost.categories.${categoryName}`]: totalCost,
  };

  try {
    await doWithRetries(async () =>
      adminDb.collection("UserAnalytics").updateOne(
        { userId: new ObjectId(userId), createdAt, userType },
        {
          $inc: incrementPayload,
        },
        {
          upsert: true,
        }
      )
    );

    await doWithRetries(async () =>
      adminDb.collection("TotalAnalytics").updateOne(
        { createdAt, userType },
        {
          $inc: incrementPayload,
        },
        {
          upsert: true,
        }
      )
    );

    if (userType === "user")
      await doWithRetries(async () =>
        db.collection("User").updateOne(
          { _id: new ObjectId(userId) },
          {
            $inc: { netBenefit: totalCost * -1 },
          },
          {
            upsert: true,
          }
        )
      );
  } catch (err) {
    throw httpError(err);
  }
}
