import { delayExecution, getExponentialBackoffDelay } from "./utils.js";
import { client } from "../init.js";

type DoWithRetriesProps<T> = {
  functionToExecute: () => Promise<T>;
  functionName: string;
  attempt?: number;
  maxAttempts?: number;
};

async function doWithRetries<T>({
  functionToExecute,
  functionName,
  attempt = 0,
  maxAttempts = 3,
}: DoWithRetriesProps<T>): Promise<T> {
  try {
    await client.connect();
    return functionToExecute();
  } catch (error) {
    if (attempt < maxAttempts) {
      const delayTime = getExponentialBackoffDelay(attempt);

      await delayExecution(delayTime);

      return await doWithRetries({
        functionToExecute,
        functionName,
        attempt: attempt + 1,
        maxAttempts,
      });
    } else {
      console.log(
        `Function call failed after maximum attempts. No more retries.`
      );
      throw error;
    }
  }
}

export default doWithRetries;
