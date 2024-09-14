import { delayExecution, getExponentialBackoffDelay } from "./utils.js";
import { client } from "../init.js";

async function doWithRetries({
  functionToExecute,
  operationName,
  attempt = 0,
  maxAttempts = 3,
}) {
  try {
    await client.connect();
    const result = await functionToExecute();
    return result;
  } catch (error) {
    if (attempt < maxAttempts) {
      const delayTime = getExponentialBackoffDelay(attempt);
      await delayExecution(delayTime);

      return await doWithRetries({
        functionToExecute,
        operationName,
        attempt: attempt + 1,
        maxAttempts,
      });
    } else {
      console.log("Error:", error);
      throw new Error(error);
    }
  }
}

export default doWithRetries;
