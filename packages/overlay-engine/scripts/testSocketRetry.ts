import { Agent, Dispatcher, Pool, interceptors, setGlobalDispatcher } from "undici";

// Test runs open many range reads at once, and CI's path to the upload host
// resets sockets out from under them. Production pools are unchanged.
// One immediate retry, then the error still fails the test. HTTP statuses
// are not retried.
function retryOnce() {
  return interceptors.retry({
    maxRetries: 1,
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
  return new Pool(origin, poolOptions).compose(retryOnce());
}

export function installTestFetchDispatcher(): void {
  setGlobalDispatcher(new Agent(poolOptions).compose(retryOnce()));
}
