const prohibitedContent = [
  "Explicit Nudity",
  "Exposed Male Genitalia",
  "Exposed Female Genitalia",
  "Simulated Sexual Activity",
  "Graphic Male Nudity",
  "Graphic Female Nudity",
  "Sexual Activity",
  "Illustrated Explicit Nudity",
  "Adult Toys",
  "Violence",
  "Physical Violence",
  "Graphic Violence or Gore",
  "Self Harm",
  "Drugs",
  "Drug Use",
  "Hate Symbols",
  "Terrorism",
  "Extremist",
  "Hate Speech",
];

export default function checkProhibitedContent(input) {
  if (input.length === 0) return false;

  const incomingLabels = input
    .map((i) => [
      i?.ModerationLabel?.Name,
      i?.Name,
      i?.ModerationLabel?.ParentName,
      i?.ParentName,
    ])
    .flat();

  const includes = incomingLabels
    .filter((l) => l)
    .some((label) => prohibitedContent.includes(label));

  return includes;
}
