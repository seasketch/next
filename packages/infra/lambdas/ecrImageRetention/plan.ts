/**
 * Decides which ECR tags to add or remove. The lifecycle policy expires only
 * images carrying an `old-` tag, so a bug or a missed run keeps images rather
 * than deleting one that is still deployed.
 */

export const OLD_TAG_PREFIX = "old-";
export const RETENTION_DAYS = 30;

/** Last set of Lambda and ECS sources whose image lived in this repository. */
export const SOURCES_PARAMETER = "/seasketch/ecr-image-retention/sources";

export const LIFECYCLE_POLICY = {
  rules: [
    {
      rulePriority: 1,
      description: "Expire images explicitly marked old",
      selection: {
        tagStatus: "tagged",
        tagPrefixList: [OLD_TAG_PREFIX],
        countType: "sinceImagePushed",
        countUnit: "days",
        countNumber: 1,
      },
      action: { type: "expire" },
    },
  ],
};

export type RepoImage = {
  digest: string;
  pushedAt: Date | undefined;
  tags: string[];
};

export type ImageRef = {
  source: string;
  tag?: string;
  digest?: string;
};

export function imageRefInRepository(
  uri: string,
  repositoryName: string
): { tag?: string; digest?: string } | null {
  const slash = uri.indexOf("/");
  if (slash === -1) return null;
  const pathAndRef = uri.slice(slash + 1);
  if (!pathAndRef.startsWith(repositoryName)) return null;
  const rest = pathAndRef.slice(repositoryName.length);
  if (rest.startsWith(":")) {
    const tag = rest.slice(1);
    return tag.length > 0 ? { tag } : null;
  }
  if (rest.startsWith("@")) {
    const digest = rest.slice(1);
    return digest.length > 0 ? { digest } : null;
  }
  return null;
}

export function oldTagForDigest(digest: string): string {
  const hex = digest.startsWith("sha256:") ? digest.slice("sha256:".length) : digest;
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error(`Refusing to build an old- tag from digest ${digest}`);
  }
  return `${OLD_TAG_PREFIX}${hex}`;
}

export function sourceIds(input: {
  lambdaNamesFound: readonly string[];
  ecsServiceNames: readonly string[];
}): string[] {
  return [
    ...input.lambdaNamesFound.map((name) => `lambda:${name}`),
    ...input.ecsServiceNames.map((name) => `ecs:${name}`),
  ].sort();
}

/**
 * The running set is whatever image Lambdas and ECS services exist now, not a
 * fixed list. Additions are always accepted. A collapse of the previously
 * seen set is treated as a failed lookup, not as services that went away.
 */
export function assertSourcesStillPresent(input: {
  previous: readonly string[] | null;
  current: readonly string[];
}): void {
  if (input.current.length === 0) {
    throw new Error(
      "Refusing to mark images old. No running images were found in the repository."
    );
  }
  if (!input.previous || input.previous.length === 0) return;

  const current = new Set(input.current);
  const missing = input.previous.filter((source) => !current.has(source));
  const stillThere = input.previous.length - missing.length;
  if (stillThere * 2 < input.previous.length) {
    throw new Error(
      `Refusing to mark images old. Previously protected sources were not seen: ${missing.join(", ")}`
    );
  }
}

/**
 * Resolve deployed image URIs to digests. Throws if a deployed reference is
 * not in the repository, so a lookup failure cannot look like "unused".
 */
export function resolveRunningDigests(
  refs: readonly ImageRef[],
  images: readonly RepoImage[]
): Set<string> {
  const digestByTag = new Map<string, string>();
  const knownDigests = new Set<string>();
  for (const image of images) {
    knownDigests.add(image.digest);
    for (const tag of image.tags) {
      digestByTag.set(tag, image.digest);
    }
  }

  const running = new Set<string>();
  for (const ref of refs) {
    if (ref.digest) {
      if (!knownDigests.has(ref.digest)) {
        throw new Error(
          `${ref.source} is deployed from digest ${ref.digest}, which is not in the repository`
        );
      }
      running.add(ref.digest);
      continue;
    }
    if (!ref.tag) {
      throw new Error(`${ref.source} image URI has no tag or digest`);
    }
    const digest = digestByTag.get(ref.tag);
    if (!digest) {
      throw new Error(
        `${ref.source} is deployed from tag ${ref.tag}, which is not in the repository`
      );
    }
    running.add(digest);
  }
  return running;
}

export function planTagChanges(input: {
  runningDigests: ReadonlySet<string>;
  images: readonly RepoImage[];
  now: Date;
  retentionDays?: number;
}): {
  removeOldTags: { digest: string; tag: string }[];
  markOld: { digest: string; tag: string }[];
} {
  const retentionDays = input.retentionDays ?? RETENTION_DAYS;
  const cutoff = input.now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const removeOldTags: { digest: string; tag: string }[] = [];
  const markOld: { digest: string; tag: string }[] = [];

  for (const image of input.images) {
    const oldTags = image.tags.filter((tag) => tag.startsWith(OLD_TAG_PREFIX));
    if (input.runningDigests.has(image.digest)) {
      for (const tag of oldTags) {
        removeOldTags.push({ digest: image.digest, tag });
      }
      continue;
    }
    if (oldTags.length > 0) continue;
    if (!image.pushedAt || image.pushedAt.getTime() > cutoff) continue;
    markOld.push({
      digest: image.digest,
      tag: oldTagForDigest(image.digest),
    });
  }

  return { removeOldTags, markOld };
}
