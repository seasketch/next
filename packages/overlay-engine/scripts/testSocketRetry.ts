import { Agent, Dispatcher, Pool, interceptors, setGlobalDispatcher } from "undici";

// Test runs open many range reads at once, and CI's path to the upload host
// resets sockets out from under them. Production pools are unchanged.
// One retry was not enough: a CI run still failed with `read ECONNRESET`
// after the second socket was reset too. A few immediate retries, then the
// error still fails the test. HTTP statuses are not retried.
export const socketResetRetries = 3;

function retrySocketResets() {
  return interceptors.retry({
    maxRetries: socketResetRetries,
    minTimeout: 0,
    maxTimeout: 0,
    timeoutFactor: 1,
    methods: ["GET", "HEAD"],
    statusCodes: [],
    errorCodes: ["ECONNRESET", "EPIPE", "ECONNREFUSED", "UND_ERR_SOCKET"],
  });
}

const poolOptions = {
  connections: 8,
  bodyTimeout: 10 * 1000,
};

export function testRangeDispatcher(origin: string): Dispatcher {
  return new Pool(origin, poolOptions).compose(retrySocketResets());
}

export function installTestFetchDispatcher(): void {
  setGlobalDispatcher(new Agent(poolOptions).compose(retrySocketResets()));
}
