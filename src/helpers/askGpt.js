import { openai } from "../init.js";

async function askGpt({ messages, maxTokens, isMini, seed, isJson = true }) {
  try {
    const options = {
      messages,
      seed,
      model: isMini ? process.env.MODEL_MINI : process.env.MODEL,
      temperature: 0,
      max_tokens: maxTokens,
    };

    if (isJson) options.response_format = { type: "json_object" };

    const completion = await openai.chat.completions.create(options);

    console.log("isMini", isMini || false, completion.usage.total_tokens);

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
