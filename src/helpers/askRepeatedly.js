import askGpt from "./askGpt.js";
import doWithRetries from "./doWithRetries.js";

async function askRepeatedly({ runs, systemContent, isResultString }) {
  try {
    let result;
    let conversation = [{ role: "system", content: systemContent }];

    for (let i = 0; i < runs.length; i++) {
      conversation.push({ role: "user", content: runs[i].content });

      const response = await doWithRetries({
        functionName: "askRepeatedly - askGpt",
        functionToExecute: async () =>
          askGpt({
            messages: conversation,
            isMini: runs[i].isMini,
            isJson: isResultString ? false : i === runs.length - 1,
          }),
      });

      result = response.result;

      conversation.push({
        role: "assistant",
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      });
    }

    return result;
  } catch (error) {
    throw error;
  }
}

export default askRepeatedly;
