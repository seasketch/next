/**
 * HTML form shown when a /v2 preview page is requested without a valid
 * map-access token (or with an invalid one). Submitting reloads the same URL
 * with ?access_token=…
 */
export function renderTokenPrompt(options: {
  error?: string | null;
  hadToken?: boolean;
}): string {
  const error = options.error
    ? escapeHtml(options.error)
    : options.hadToken
      ? "That token was rejected. Paste a fresh mapAccessToken and try again."
      : null;
  const heading = options.hadToken
    ? "Token required"
    : "Map access token required";
  const blurb = options.hadToken
    ? "This tileset is protected. Provide a valid SeaSketch map access token."
    : "This tileset is protected. Paste a SeaSketch <code>mapAccessToken</code> (from the GraphQL API) or open this page with <code>?access_token=…</code>.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      background: #0f172a; color: #e2e8f0;
    }
    .card {
      width: min(440px, calc(100vw - 32px));
      background: #1e293b; border: 1px solid #334155; border-radius: 12px;
      padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,.35);
    }
    h1 { font-size: 1.15rem; margin: 0 0 8px; font-weight: 600; }
    p { margin: 0 0 16px; font-size: 0.9rem; line-height: 1.45; color: #94a3b8; }
    code { font-size: 0.85em; color: #7dd3fc; }
    label { display: block; font-size: 0.8rem; margin-bottom: 6px; color: #cbd5e1; }
    textarea {
      width: 100%; box-sizing: border-box; min-height: 110px; resize: vertical;
      border-radius: 8px; border: 1px solid #475569; background: #0f172a;
      color: #f8fafc; padding: 10px 12px; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    textarea:focus { outline: 2px solid #38bdf8; outline-offset: 1px; }
    .error {
      margin: 0 0 12px; padding: 10px 12px; border-radius: 8px;
      background: #450a0a; color: #fecaca; font-size: 0.85rem;
    }
    button {
      margin-top: 14px; width: 100%; border: 0; border-radius: 8px;
      padding: 10px 14px; font-weight: 600; cursor: pointer;
      background: #0ea5e9; color: #0f172a;
    }
    button:hover { background: #38bdf8; }
    .hint { margin-top: 12px; font-size: 0.75rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    <p>${blurb}</p>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form id="token-form">
      <label for="access_token">access_token</label>
      <textarea id="access_token" name="access_token" required spellcheck="false" placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9…"></textarea>
      <button type="submit">Open preview</button>
    </form>
    <p class="hint">Token is added to the URL as a query parameter and kept in sessionStorage for this tab.</p>
  </div>
  <script>
    (function () {
      var KEY = "ss_map_access_token";
      var ta = document.getElementById("access_token");
      try {
        var saved = sessionStorage.getItem(KEY);
        if (saved) ta.value = saved;
      } catch (e) {}
      document.getElementById("token-form").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var token = (ta.value || "").trim();
        if (!token) return;
        try { sessionStorage.setItem(KEY, token); } catch (e) {}
        var u = new URL(location.href);
        u.searchParams.set("access_token", token);
        location.replace(u.toString());
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
