# Fragment worker deployment

When adding a new operation to this Lambda (e.g. `reconcile-overlap`), **deploy the FragmentWorker Lambda before deploying the API** that invokes it. Otherwise the API will call a function that does not yet handle the new `operation` value and mutations will fail until both are aligned.

1. Build and deploy the CDK stack that includes `FragmentWorker` (see `packages/infra/lib/FragmentWorkerLambdaStack.ts`).
2. Deploy the API server that sets `FRAGMENT_WORKER_LAMBDA_ARN` to the updated function.
