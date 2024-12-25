import * as dotenv from "dotenv";
dotenv.config();

import { openai } from "@/init.js";
import { ModerationMultiModalInput } from "openai/resources/moderations.mjs";
import httpError from "@/helpers/httpError.js";
import doWithRetries from "@/helpers/doWithRetries.js";

type Props = {
  content: ModerationMultiModalInput[];
};

export default async function moderateContent({ content }: Props) {
  let isSafe = true;

  try {
    const moderation = await doWithRetries(async () =>
      openai.moderations.create({
        model: "omni-moderation-latest",
        input: content,
      })
    );

    const { results } = moderation;

    for (const result of results) {
      const { category_scores } = result;
      const values = Object.values(category_scores);

      for (const value of values) {
        if (value >= Number(process.env.MODERATION_TRESHOLD)) {
          isSafe = false;
        }
      }
    }
  } catch (err) {
    isSafe = false;
    throw httpError(err);
  } finally {
    return isSafe;
  }
}
