#!/bin/bash
# Connects to the maintenance bastion running in the production stack
# You will need AWS_REGION and privileged credentials. To manage them use
# [named profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html)
export $(node lib/getBastionProps.js)
aws ecs execute-command --cluster $CLUSTER --task $TASK --container Default --command "/bin/sh -l" --interactive