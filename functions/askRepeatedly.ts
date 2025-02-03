import askOpenAi from "@/functions/askOpenAi.js";
import doWithRetries from "helpers/doWithRetries.js";
import { RunType } from "types.js";
import httpError from "@/helpers/httpError.js";

type Props = {
  runs: RunType[];
  userId: string;
  categoryName: string;
  functionName: string;
  systemContent: string;
  isResultString?: boolean;
};

async function askRepeatedly({
  runs,
  userId,
  functionName,
  systemContent,
  isResultString,
  categoryName,
}: Props) {
  try {
    if (!userId) throw httpError("Missing userId");

    let result;

    let conversation: any[] = [{ role: "system", content: systemContent }];

    for (let i = 0; i < runs.length; i++) {
      conversation.push({
        role: "user",
        content: runs[i].content,
      });

      result = await doWithRetries(async () =>
        askOpenAi({
          userId,
          functionName,
          categoryName,
          model: runs[i].model,
          messages: conversation,
          isMini: runs[i].isMini,
          responseFormat: runs[i].responseFormat,
          isJson: isResultString ? false : i === runs.length - 1,
        })
      );

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
  } catch (err) {
    throw httpError(err);
  }
}

export default askRepeatedly;
