import askRepeatedly from "../helpers/askRepeatedly.js";

export default async function checkTextSafety(text) {
  try {
    const systemContent = `Please analyze the following text to determine if it contains any inappropriate content, including but not limited to: obscene language, defamatory statements, discriminatory remarks, racist comments, nationalistic ideologies, harassment, hate speech, or explicit violence. Provide a clear "Yes" or "No" answer. If "Yes," briefly explain which type of inappropriate content is present without quoting the offending material directly. Consider the context if it is provided, and maintain confidentiality regarding sensitive information.`;

    const runs = [
      {
        isMini: true,
        content: [
          { type: "text", text },
          {
            type: "text",
            text: "Have another look at the text. Is there anything that can make you revise your decision?",
          },
          {
            type: "text",
            text: "Format your latest decision as a JSON object with this format: {verdict: true if the text save and false if not, reasoning: if text is not safe tell why, else leave empty}",
          },
        ],
      },
    ];

    const response = await askRepeatedly({ systemContent, runs });

    return response;
  } catch (err) {
    throw err;
  }
}
