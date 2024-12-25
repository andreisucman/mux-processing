import * as dotenv from "dotenv";
dotenv.config();

import { openai } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import httpError from "@/helpers/httpError.js";
import { CategoryNameEnum, MessageType } from "@/types.js";
import updateSpend from "./updateSpend.js";

const {
  DEFAULT_4O_MINI_INPUT_PRICE,
  DEFAULT_4O_MINI_OUTPUT_PRICE,
  DEFAULT_4O_INPUT_PRICE,
  DEFAULT_4O_OUTPUT_PRICE,
  FINETUNED_4O_MINI_INPUT_PRICE,
  FINETUNED_4O_MINI_OUTPUT_PRICE,
  FINETUNED_4O_INPUT_PRICE,
  FINETUNED_4O_OUTPUT_PRICE,
} = process.env;

type AskOpenaiProps = {
  userId: string;
  model?: string;
  messages: MessageType[];
  responseFormat?: any;
  isMini: boolean;
  isJson: boolean;
  functionName: string;
  categoryName: CategoryNameEnum;
};

async function askOpenAi({
  messages,
  model,
  functionName,
  isMini,
  userId,
  responseFormat,
  categoryName,
  isJson = true,
}: AskOpenaiProps) {
  try {
    const finalModel = model
      ? model
      : isMini
      ? process.env.MODEL_MINI
      : process.env.MODEL;

    const options: { [key: string]: any } = {
      messages,
      model: finalModel,
      temperature: 0,
    };

    if (isJson) options.response_format = { type: "json_object" };
    if (responseFormat) options.response_format = responseFormat;

    const completion = await doWithRetries(async () =>
      openai.chat.completions.create(options as any)
    );

    const inputTokens = completion.usage.prompt_tokens;
    const outputTokens = completion.usage.completion_tokens;

    const inputPrice = isMini
      ? model
        ? FINETUNED_4O_MINI_INPUT_PRICE
        : DEFAULT_4O_MINI_INPUT_PRICE
      : model
      ? FINETUNED_4O_INPUT_PRICE
      : DEFAULT_4O_INPUT_PRICE;

    const outputPrice = isMini
      ? model
        ? FINETUNED_4O_MINI_OUTPUT_PRICE
        : DEFAULT_4O_MINI_OUTPUT_PRICE
      : model
      ? FINETUNED_4O_OUTPUT_PRICE
      : DEFAULT_4O_OUTPUT_PRICE;

    const unitCost =
      ((inputTokens / (inputTokens + outputTokens)) * Number(inputPrice) +
        (outputTokens / (inputTokens + outputTokens)) * Number(outputPrice)) /
      1000000;

    updateSpend({
      functionName,
      categoryName,
      modelName: model,
      unitCost,
      units: inputTokens + outputTokens,
      userId,
    });

    return isJson
      ? JSON.parse(completion.choices[0].message.content)
      : completion.choices[0].message.content;
  } catch (err) {
    throw httpError(err);
  }
}

export default askOpenAi;
