// Stand-in for the two services the upload handler calls when the AI
// Cartographer is on, so the e2e profile can run an upload with it enabled
// without a Cloudflare AI Gateway token or a deployed PII classifier.
//
//   POST /v1/chat/completions
//     The OpenAI chat completions endpoint the `openai` client in
//     ai-data-analyst posts to (CF_AIG_URL is its base URL). Answers each of
//     the three prompts, title / attribution / column_intelligence, with JSON
//     that passes the prompt's own schema, derived from the request so a
//     journey can recognise its upload in the result.
//   POST /2015-03-31/functions/function/invocations
//     The Lambda Invoke path the aws-sdk Lambda client posts to when
//     GEOSTATS_PII_CLASSIFIER_ENDPOINT points here (the same path the Lambda
//     emulator serves). Returns the geostats marked assessed, with every
//     string attribute at zero risk. The real classifier is a Python Lambda
//     with spaCy models; nothing about PII detection is tested here.
//   GET /requests, DELETE /requests
//     What the mock has been asked, for a journey to assert on, and a reset.
//   GET /health
//
// Anything else, including an unknown prompt or a bad bearer token, is an
// error response, so a new prompt or a wiring change fails loudly in the
// upload rather than quietly producing no notes.
import http from "node:http";

const port = Number(process.env.AI_CARTOGRAPHER_MOCK_PORT || 18790);
const token = process.env.AI_CARTOGRAPHER_MOCK_TOKEN || "ai-cartographer-mock";
const requests = [];

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(new Error(`request body is not JSON: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text),
    ...headers,
  });
  res.end(text);
}

function stem(filename) {
  return String(filename).replace(/\.[^.]+$/, "");
}

/** The three prompts, by the JSON schema name the client asks for. */
const prompts = {
  title(userContent) {
    return {
      title: `${stem(userContent.trim())} (titled by the AI Cartographer mock)`,
    };
  },
  attribution() {
    return { attribution: "Attribution written by the AI Cartographer mock" };
  },
  column_intelligence(userContent) {
    const { geostats } = JSON.parse(userContent);
    const attributes = Array.isArray(geostats?.attributes) ? geostats.attributes : [];
    const junk = attributes
      .map((a) => a.attribute)
      .filter((name) => /^(objectid|fid|shape_(area|length)|globalid)$/i.test(name));
    const useful = attributes.filter((a) => !junk.includes(a.attribute));
    const label = useful.find((a) => a.type === "string")?.attribute ?? null;
    const numeric = useful.find((a) => a.type === "number")?.attribute ?? null;
    const geometry = String(geostats?.geometry ?? "");
    const presentation = /Point/.test(geometry)
      ? "SIMPLE_POINT"
      : /Line/.test(geometry)
        ? "SIMPLE_LINE"
        : "SIMPLE_POLYGON";
    return {
      best_label_column: label,
      best_category_column: null,
      best_numeric_column: numeric,
      best_date_column: null,
      best_popup_description_column: null,
      best_id_column: null,
      junk_columns: junk,
      chosen_presentation_type: presentation,
      chosen_presentation_column: null,
      palette: null,
      custom_palette: { default: "#1d4ed8" },
      reverse_palette: false,
      show_labels: label !== null,
      labels_min_zoom: label !== null ? 8 : null,
      interactivity_type: "ALL_PROPERTIES_POPUP",
      notes: `Written by the AI Cartographer mock. A single-colour ${presentation
        .replace("SIMPLE_", "")
        .toLowerCase()} style${label ? ` labelled by \`${label}\`` : ""}.`,
    };
  },
};

function filenameIn(name, userContent) {
  if (name === "title") {
    return userContent.trim();
  }
  if (name === "column_intelligence") {
    try {
      return JSON.parse(userContent).filename ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

async function chatCompletion(req, res) {
  if (req.headers.authorization !== `Bearer ${token}`) {
    send(res, 401, {
      error: { message: "The bearer token is not the AI Cartographer mock's" },
    });
    return;
  }
  const body = await readJson(req);
  const name = body.response_format?.json_schema?.name;
  const userContent = body.messages?.find((m) => m.role === "user")?.content;
  const prompt = prompts[name];
  if (!prompt || typeof userContent !== "string") {
    send(res, 400, {
      error: {
        message: `The AI Cartographer mock does not know the prompt ${JSON.stringify(name)}`,
      },
    });
    return;
  }
  const answer = prompt(userContent);
  requests.push({
    at: new Date().toISOString(),
    kind: "chat",
    prompt: name,
    model: body.model ?? null,
    filename: filenameIn(name, userContent),
    input: userContent.slice(0, 4000),
  });
  console.log(`chat completion: ${name} for ${filenameIn(name, userContent) ?? "(no filename)"}`);
  send(res, 200, {
    id: `chatcmpl-mock-${requests.length}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model ?? "mock",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: JSON.stringify(answer), refusal: null },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  });
}

async function classifyPii(req, res) {
  const body = await readJson(req);
  const geostats = body.geostats;
  if (!geostats || !Array.isArray(geostats.attributes)) {
    send(res, 200, { error: "The payload did not include geostats with attributes" }, {
      "x-amz-function-error": "Unhandled",
    });
    return;
  }
  requests.push({
    at: new Date().toISOString(),
    kind: "pii",
    prompt: null,
    model: null,
    filename: null,
    input: JSON.stringify(geostats).slice(0, 4000),
  });
  console.log(`pii classification: ${geostats.attributes.length} attributes`);
  send(res, 200, {
    geostats: {
      ...geostats,
      piiRiskWasAssessed: true,
      attributes: geostats.attributes.map((attribute) =>
        attribute.type === "string"
          ? { ...attribute, piiRisk: 0, piiRiskCategories: [] }
          : attribute
      ),
    },
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, { ok: true, requests: requests.length });
    } else if (req.method === "GET" && url.pathname === "/requests") {
      send(res, 200, requests);
    } else if (req.method === "DELETE" && url.pathname === "/requests") {
      requests.length = 0;
      send(res, 200, []);
    } else if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      await chatCompletion(req, res);
    } else if (
      req.method === "POST" &&
      url.pathname === "/2015-03-31/functions/function/invocations"
    ) {
      await classifyPii(req, res);
    } else {
      send(res, 404, {
        error: { message: `The AI Cartographer mock has no ${req.method} ${url.pathname}` },
      });
    }
  } catch (error) {
    console.error(error);
    send(res, 500, { error: { message: error.message } });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AI Cartographer mock listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
