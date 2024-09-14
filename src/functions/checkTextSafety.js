import askRepeatedly from "../helpers/askRepeatedly.js";
import doWithRetries from "../helpers/doWithRetries.js";

export default async function checkTextSafety(text) {
  try {
    const systemContent = `Please analyze the following text to determine if it contains any inappropriate content, including but not limited to: obscene language, defamatory statements, discriminatory remarks, racist comments, nationalistic ideologies, harassment, hate speech, or explicit violence. If "Yes," briefly explain which type of inappropriate content is present without quoting the offending material directly. Consider the context if it is provided, and maintain confidentiality regarding sensitive information. If yes, your verdict is true. If not your verdict is false.`;

    const runs = [
      {
        isMini: true,
        content: [{ type: "text", text }],
      },
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: "Have another look at the text. Is there anything that can make you revise your decision?",
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

    const response = await doWithRetries({
      functionToExecute: () =>
        askRepeatedly({
          runs,
          systemContent,
        }),
    });

    return response;
  } catch (err) {
    throw err;
  }
}
