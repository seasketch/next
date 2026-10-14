import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import {
  BatchDeleteImageCommand,
  BatchGetImageCommand,
  DescribeImagesCommand,
  ECRClient,
  ImageAlreadyExistsException,
  PutImageCommand,
} from "@aws-sdk/client-ecr";
import {
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
} from "@aws-sdk/client-ecs";
import {
  GetFunctionCommand,
  LambdaClient,
  ListFunctionsCommand,
} from "@aws-sdk/client-lambda";
import { GetParameterCommand, PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import {
  ImageRef,
  RepoImage,
  SOURCES_PARAMETER,
  assertSourcesStillPresent,
  imageRefInRepository,
  planTagChanges,
  resolveRunningDigests,
  sourceIds,
} from "./plan";

const METRIC_NAMESPACE = "SeaSketch/EcrImageRetention";

export async function handler(): Promise<{
  running: number;
  removedOldTags: number;
  markedOld: number;
}> {
  const repositoryName = process.env.REPOSITORY_NAME;
  if (!repositoryName) {
    throw new Error("REPOSITORY_NAME is not set");
  }
  const retentionDays = Number(process.env.RETENTION_DAYS ?? "30");
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error(`RETENTION_DAYS is invalid: ${process.env.RETENTION_DAYS}`);
  }

  const ecr = new ECRClient({});
  const ssm = new SSMClient({});
  const images = await listImages(ecr, repositoryName);
  const discovery = await discoverRunningImages(repositoryName);
  const currentSources = sourceIds(discovery);
  assertSourcesStillPresent({
    previous: await readPreviousSources(ssm),
    current: currentSources,
  });
  const runningDigests = resolveRunningDigests(discovery.refs, images);

  const plan = planTagChanges({
    runningDigests,
    images,
    now: new Date(),
    retentionDays,
  });

  await removeOldTags(ecr, repositoryName, plan.removeOldTags.map((item) => item.tag));
  await markOld(ecr, repositoryName, plan.markOld);
  await ssm.send(
    new PutParameterCommand({
      Name: SOURCES_PARAMETER,
      Value: JSON.stringify(currentSources),
      Type: "String",
      Overwrite: true,
    })
  );

  await new CloudWatchClient({}).send(
    new PutMetricDataCommand({
      Namespace: METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: "SyncSuccess",
          Value: 1,
          Unit: "Count",
        },
      ],
    })
  );

  console.log(
    JSON.stringify({
      running: runningDigests.size,
      removedOldTags: plan.removeOldTags.length,
      markedOld: plan.markOld.length,
    })
  );
  return {
    running: runningDigests.size,
    removedOldTags: plan.removeOldTags.length,
    markedOld: plan.markOld.length,
  };
}

async function readPreviousSources(ssm: SSMClient): Promise<string[] | null> {
  try {
    const parameter = await ssm.send(
      new GetParameterCommand({ Name: SOURCES_PARAMETER })
    );
    const raw = parameter.Parameter?.Value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      throw new Error(`${SOURCES_PARAMETER} is not a list of source names`);
    }
    return parsed;
  } catch (error) {
    if ((error as { name?: string }).name === "ParameterNotFound") return null;
    throw error;
  }
}

async function listImages(ecr: ECRClient, repositoryName: string): Promise<RepoImage[]> {
  const images: RepoImage[] = [];
  let nextToken: string | undefined;
  do {
    const page = await ecr.send(
      new DescribeImagesCommand({
        repositoryName,
        nextToken,
        maxResults: 1000,
      })
    );
    for (const image of page.imageDetails ?? []) {
      if (!image.imageDigest) continue;
      images.push({
        digest: image.imageDigest,
        pushedAt: image.imagePushedAt,
        tags: image.imageTags ?? [],
      });
    }
    nextToken = page.nextToken;
  } while (nextToken);
  return images;
}

async function discoverRunningImages(repositoryName: string): Promise<{
  lambdaNamesFound: string[];
  ecsServiceNames: string[];
  refs: ImageRef[];
}> {
  const lambdaNamesFound: string[] = [];
  const ecsServiceNames: string[] = [];
  const refs: ImageRef[] = [];

  const lambda = new LambdaClient({});
  let marker: string | undefined;
  do {
    const page = await lambda.send(
      new ListFunctionsCommand({ Marker: marker, MaxItems: 50 })
    );
    for (const fn of page.Functions ?? []) {
      if (fn.PackageType !== "Image" || !fn.FunctionName) continue;
      const full = await lambda.send(
        new GetFunctionCommand({ FunctionName: fn.FunctionName })
      );
      const uri = full.Code?.ImageUri;
      if (!uri) {
        throw new Error(`Image Lambda ${fn.FunctionName} has no image URI`);
      }
      const ref = imageRefInRepository(uri, repositoryName);
      if (!ref) continue;
      lambdaNamesFound.push(fn.FunctionName);
      refs.push({ source: `lambda ${fn.FunctionName}`, ...ref });
    }
    marker = page.NextMarker;
  } while (marker);

  const ecs = new ECSClient({});
  let clusterToken: string | undefined;
  do {
    const clusters = await ecs.send(
      new ListClustersCommand({ nextToken: clusterToken })
    );
    for (const cluster of clusters.clusterArns ?? []) {
      let serviceToken: string | undefined;
      do {
        const services = await ecs.send(
          new ListServicesCommand({
            cluster,
            nextToken: serviceToken,
            maxResults: 10,
          })
        );
        const arns = services.serviceArns ?? [];
        if (arns.length > 0) {
          const described = await ecs.send(
            new DescribeServicesCommand({ cluster, services: arns })
          );
          for (const service of described.services ?? []) {
            if (service.status !== "ACTIVE" || !service.serviceName || !service.taskDefinition) {
              continue;
            }
            const taskDef = await ecs.send(
              new DescribeTaskDefinitionCommand({
                taskDefinition: service.taskDefinition,
              })
            );
            let matched = false;
            for (const container of taskDef.taskDefinition?.containerDefinitions ?? []) {
              if (!container.image) continue;
              const ref = imageRefInRepository(container.image, repositoryName);
              if (!ref) continue;
              matched = true;
              refs.push({
                source: `ecs ${service.serviceName}/${container.name ?? "container"}`,
                ...ref,
              });
            }
            if (matched) ecsServiceNames.push(service.serviceName);
          }
        }
        serviceToken = services.nextToken;
      } while (serviceToken);
    }
    clusterToken = clusters.nextToken;
  } while (clusterToken);

  return { lambdaNamesFound, ecsServiceNames, refs };
}

async function removeOldTags(
  ecr: ECRClient,
  repositoryName: string,
  tags: string[]
): Promise<void> {
  for (const chunk of chunks(tags, 100)) {
    const result = await withRetry(() =>
      ecr.send(
        new BatchDeleteImageCommand({
          repositoryName,
          imageIds: chunk.map((imageTag) => ({ imageTag })),
        })
      )
    );
    const failures = (result.failures ?? []).filter(
      (failure) => failure.failureCode !== "ImageNotFound"
    );
    if (failures.length > 0) {
      throw new Error(
        `Failed to remove old- tags: ${failures
          .map((failure) => `${failure.imageId?.imageTag} ${failure.failureReason}`)
          .join("; ")}`
      );
    }
  }
}

async function markOld(
  ecr: ECRClient,
  repositoryName: string,
  images: { digest: string; tag: string }[]
): Promise<void> {
  for (const chunk of chunks(images, 100)) {
    const manifests = await withRetry(() =>
      ecr.send(
        new BatchGetImageCommand({
          repositoryName,
          imageIds: chunk.map((image) => ({ imageDigest: image.digest })),
        })
      )
    );
    if ((manifests.failures ?? []).length > 0) {
      throw new Error(
        `Failed to read manifests to mark old: ${manifests.failures
          ?.map((failure) => failure.failureReason)
          .join("; ")}`
      );
    }
    const manifestByDigest = new Map(
      (manifests.images ?? []).map((image) => [image.imageId?.imageDigest, image.imageManifest])
    );
    for (const image of chunk) {
      const manifest = manifestByDigest.get(image.digest);
      if (!manifest) {
        throw new Error(`No manifest returned for ${image.digest}`);
      }
      try {
        await withRetry(() =>
          ecr.send(
            new PutImageCommand({
              repositoryName,
              imageManifest: manifest,
              imageTag: image.tag,
            })
          )
        );
      } catch (error) {
        if (error instanceof ImageAlreadyExistsException) continue;
        const name = (error as { name?: string }).name;
        if (name === "ImageAlreadyExistsException" || name === "ImageTagAlreadyExistsException") {
          continue;
        }
        throw error;
      }
    }
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let waitMs = 200;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const name = (error as { name?: string }).name;
      const throttled = name === "ThrottlingException" || name === "TooManyRequestsException";
      if (!throttled || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      waitMs *= 2;
    }
  }
  throw new Error("retry loop ended");
}
