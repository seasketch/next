const HTML_PREFIX_BYTES = 4096;

const GRAPHQL_QUERY = `query ProductionProbe {
  projects: projectsConnection(first: 1) {
    totalCount
  }
  fiji: projectBySlug(slug: "fiji") {
    slug
    name
  }
  survey: survey(id: 23) {
    id
    name
    isDisabled
    project {
      slug
    }
  }
}`;

/**
 * Read-only checks against the live site and API.
 * Page fetches confirm the static app is served. GraphQL confirms Fiji and
 * the Blue Azores survey still exist. Nothing is signed in and nothing is written.
 *
 * @param {{ fetch?: typeof fetch, siteOrigin?: string, graphqlUrl?: string, timeoutMs?: number }} [options]
 */
export async function runProbe(options = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const siteOrigin = (options.siteOrigin ?? "https://www.seasketch.org").replace(/\/$/, "");
  const graphqlUrl = options.graphqlUrl ?? "https://api.seasket.ch/graphql";
  const timeoutMs = options.timeoutMs ?? 60_000;
  const signal = AbortSignal.timeout(timeoutMs);

  const [home, fijiPage, surveyPage, graphql] = await Promise.all([
    checkPage(fetchImpl, "homepage", `${siteOrigin}/`, signal),
    checkPage(fetchImpl, "fiji page", `${siteOrigin}/fiji`, signal),
    checkPage(fetchImpl, "blue azores survey page", `${siteOrigin}/blueazores/surveys/23/0`, signal),
    checkGraphql(fetchImpl, graphqlUrl, signal),
  ]);

  const checks = [home, fijiPage, surveyPage, ...graphql];
  return { ok: checks.every((check) => check.ok), checks };
}

async function checkPage(fetchImpl, name, url, signal) {
  try {
    const response = await fetchImpl(url, { signal, redirect: "follow" });
    if (!response.ok) {
      await response.body?.cancel();
      return { name, ok: false, detail: `${url} returned ${response.status}` };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      await response.body?.cancel();
      return { name, ok: false, detail: `${url} content-type ${contentType || "missing"}` };
    }
    const html = await readPrefix(response, HTML_PREFIX_BYTES);
    if (!html.includes("SeaSketch")) {
      return { name, ok: false, detail: `${url} HTML does not mention SeaSketch` };
    }
    return { name, ok: true, detail: `${response.status} ${url}` };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkGraphql(fetchImpl, url, signal) {
  let payload;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: GRAPHQL_QUERY }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return [fail("graphql", `${url} returned ${response.status}`)];
    }
    payload = await response.json();
  } catch (error) {
    return [fail("graphql", error instanceof Error ? error.message : String(error))];
  }

  if (payload?.errors?.length) {
    return [fail("graphql", payload.errors.map((error) => error.message).join("; "))];
  }

  const data = payload?.data ?? {};
  const totalCount = data.projects?.totalCount;
  const fiji = data.fiji;
  const survey = data.survey;
  return [
    typeof totalCount === "number" && totalCount > 1
      ? pass("project list", `${totalCount} projects`)
      : fail("project list", `totalCount ${totalCount}`),
    fiji?.slug === "fiji" && typeof fiji.name === "string" && fiji.name.length > 0
      ? pass("fiji project", fiji.name)
      : fail("fiji project", "projectBySlug(fiji) missing"),
    survey?.id === 23 &&
    survey.isDisabled === false &&
    survey.project?.slug === "blueazores" &&
    typeof survey.name === "string" &&
    survey.name.length > 0
      ? pass("blue azores survey", survey.name)
      : fail("blue azores survey", "survey 23 is not the Blue Azores survey"),
  ];
}

function pass(name, detail) {
  return { name, ok: true, detail };
}

function fail(name, detail) {
  return { name, ok: false, detail };
}

async function readPrefix(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }
  const chunks = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel();
  const merged = new Uint8Array(Math.min(size, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, merged.length - offset);
    if (take <= 0) {
      break;
    }
    merged.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return new TextDecoder().decode(merged);
}
