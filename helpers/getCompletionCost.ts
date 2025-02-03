import * as dotenv from "dotenv";
dotenv.config();

const {
  GPT_4O_MINI,
  GPT_4O_MINI_INPUT_PRICE,
  GPT_4O_MINI_OUTPUT_PRICE,

  GPT_4O_MINI_TUNED,
  GPT_4O_MINI_TUNED_INPUT_PRICE,
  GPT_4O_MINI_TUNED_OUTPUT_PRICE,
} = process.env;

const priceMap: { [key: string]: { input: number; output: number } } = {
  [GPT_4O_MINI]: {
    input: Number(GPT_4O_MINI_INPUT_PRICE),
    output: Number(GPT_4O_MINI_OUTPUT_PRICE),
  },
  [GPT_4O_MINI_TUNED]: {
    input: Number(GPT_4O_MINI_TUNED_INPUT_PRICE),
    output: Number(GPT_4O_MINI_TUNED_OUTPUT_PRICE),
  },
};

type GetCompletionCostProps = {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  divisor?: number;
};

export default function getCompletionCost({
  divisor = 1000000,
  modelName,
  inputTokens,
  outputTokens,
}: GetCompletionCostProps) {
  const price = priceMap[modelName];

  const units = inputTokens + outputTokens;
  const inputShare = inputTokens / (inputTokens + outputTokens);
  const weightedUnitCost =
    (inputShare * price.input + (1 - inputShare) * price.output) / divisor;

  return { units, unitCost: weightedUnitCost, cost: weightedUnitCost * units };
}
