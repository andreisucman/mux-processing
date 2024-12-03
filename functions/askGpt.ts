import * as dotenv from "dotenv";
dotenv.config();

import { openai } from "init.js";
import { MessageType } from "types.js";
import httpError from "helpers/httpError.js";

type Props = {
  messages: MessageType[];
  model?: string;
  isMini: boolean;
  responseFormat?: string | { type: string };
  isJson: boolean;
};

async function askGpt({
  messages,
  model,
  isMini,
  responseFormat,
  isJson = true,
}: Props) {
  try {
    const finalModel = model
      ? model
      : isMini
      ? process.env.MODEL_MINI
      : process.env.MODEL;

    const options = {
      messages,
      seed: 1234567890123,
      model: finalModel,
      temperature: 0,
      response_format: responseFormat,
    };

    if (isJson) options.response_format = { type: "json_object" };

    const completion = await openai.chat.completions.create(options as any);

    return {
      result: isJson
        ? JSON.parse(completion.choices[0].message.content || "")
        : completion.choices[0].message.content,
      tokens: completion?.usage?.total_tokens,
    };
  } catch (err) {
    throw httpError(err);
  }
}

export default askGpt;
