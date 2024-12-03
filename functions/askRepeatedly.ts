import askGpt from "@/functions/askGpt.js";
import doWithRetries from "helpers/doWithRetries.js";
import { MessageType, RoleEnum, RunType } from "types.js";
import httpError from "@/helpers/httpError.js";

type Props = {
  runs: RunType[];
  seed?: number;
  systemContent: string;
  isResultString?: boolean;
};

async function askRepeatedly({ runs, systemContent, isResultString }: Props) {
  try {
    let result;
    let conversation: MessageType[] = [
      { role: "system" as RoleEnum, content: systemContent },
    ];

    for (let i = 0; i < runs.length; i++) {
      conversation.push({
        role: "user",
        content: runs[i].content,
      } as MessageType);

      const response = await doWithRetries(async () =>
        askGpt({
          model: runs[i].model,
          messages: conversation,
          isMini: runs[i].isMini,
          responseFormat: runs[i].responseFormat,
          isJson: isResultString ? false : i === runs.length - 1,
        })
      );

      result = response.result;

      conversation.push({
        role: "assistant" as RoleEnum,
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
