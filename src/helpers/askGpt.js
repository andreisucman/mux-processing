import * as dotenv from "dotenv";
dotenv.config();
import { openai } from "../init.js";

async function askGpt({ messages, maxTokens, isMini, isJson = true }) {
  try {
    const options = {
      messages,
      model: isMini ? process.env.MODEL_MINI : process.env.MODEL,
      temperature: 0,
      max_tokens: maxTokens,
    };

    if (isJson) options.response_format = { type: "json_object" };

    const completion = await openai.chat.completions.create(options);

    return {
      result: isJson
        ? JSON.parse(completion.choices[0].message.content)
        : completion.choices[0].message.content,
      tokens: completion.usage.total_tokens,
    };
  } catch (error) {
    throw error;
  }
}

export default askGpt;
