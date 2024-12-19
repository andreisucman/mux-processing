import httpError from "@/helpers/httpError.js";
import askRepeatedly from "@/functions/askRepeatedly.js";
import doWithRetries from "helpers/doWithRetries.js";
import { RunType } from "types.js";

type Props = {
  userId: string;
  text: string;
};

export default async function checkTextSafety({ text, userId }: Props) {
  try {
    const systemContent = `Please analyze the following text to determine if it contains any inappropriate content, including but not limited to: obscene language, defamatory statements, discriminatory remarks, racist comments, nationalistic ideologies, harassment, hate speech, or explicit violence. If "Yes," briefly explain which type of inappropriate content is present without quoting the offending material directly. Consider the context if it is provided, and maintain confidentiality regarding sensitive information. If yes, your verdict is true. Ignore emojis, consider words ony. If not your verdict is false.`;

    const runs: RunType[] = [
      {
        isMini: true,
        content: [{ type: "text", text }],
      },
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: "Have another look at the text. Is there anything that can make you revise your decision? Ignore emojis consider words only. ",
          },
        ],
      },
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: "Format your final verdict as a JSON with this format: {verdict: true if the text is safe and false if not, explanation: if the text is not safe exply why you think so, else leave empty string}",
          },
        ],
      },
    ];

    const response = await doWithRetries(() =>
      askRepeatedly({
        runs,
        userId,
        systemContent,
        functionName: "checkTextSafety",
      })
    );

    return response;
  } catch (err) {
    throw httpError(err);
  }
}
