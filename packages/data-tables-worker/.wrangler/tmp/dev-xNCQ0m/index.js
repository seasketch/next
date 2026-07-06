var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = /* @__PURE__ */ __name((arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
}, "bufferToFormData");

// node_modules/hono/dist/utils/body.js
var isRawRequest = /* @__PURE__ */ __name((request) => "headers" in request, "isRawRequest");
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey2 = `${label}#${next}`;
    if (!patternCache[cacheKey2]) {
      if (match2[2]) {
        patternCache[cacheKey2] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey2, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey2] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey2];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder4) => {
  try {
    return decoder4(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder4(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// node_modules/hyparquet/src/constants.js
var ParquetTypes = [
  "BOOLEAN",
  "INT32",
  "INT64",
  "INT96",
  // deprecated
  "FLOAT",
  "DOUBLE",
  "BYTE_ARRAY",
  "FIXED_LEN_BYTE_ARRAY"
];
var Encodings = [
  "PLAIN",
  "GROUP_VAR_INT",
  // deprecated
  "PLAIN_DICTIONARY",
  "RLE",
  "BIT_PACKED",
  // deprecated
  "DELTA_BINARY_PACKED",
  "DELTA_LENGTH_BYTE_ARRAY",
  "DELTA_BYTE_ARRAY",
  "RLE_DICTIONARY",
  "BYTE_STREAM_SPLIT"
];
var FieldRepetitionTypes = [
  "REQUIRED",
  "OPTIONAL",
  "REPEATED"
];
var ConvertedTypes = [
  "UTF8",
  "MAP",
  "MAP_KEY_VALUE",
  "LIST",
  "ENUM",
  "DECIMAL",
  "DATE",
  "TIME_MILLIS",
  "TIME_MICROS",
  "TIMESTAMP_MILLIS",
  "TIMESTAMP_MICROS",
  "UINT_8",
  "UINT_16",
  "UINT_32",
  "UINT_64",
  "INT_8",
  "INT_16",
  "INT_32",
  "INT_64",
  "JSON",
  "BSON",
  "INTERVAL"
];
var CompressionCodecs = [
  "UNCOMPRESSED",
  "SNAPPY",
  "GZIP",
  "LZO",
  "BROTLI",
  "LZ4",
  "ZSTD",
  "LZ4_RAW"
];
var PageTypes = [
  "DATA_PAGE",
  "INDEX_PAGE",
  "DICTIONARY_PAGE",
  "DATA_PAGE_V2"
];
var EdgeInterpolationAlgorithms = [
  "SPHERICAL",
  "VINCENTY",
  "THOMAS",
  "ANDOYER",
  "KARNEY"
];

// node_modules/hyparquet/src/wkb.js
function wkbToGeojson(reader) {
  const flags = getFlags(reader);
  if (flags.type === 1) {
    return { type: "Point", coordinates: readPosition(reader, flags) };
  } else if (flags.type === 2) {
    return { type: "LineString", coordinates: readLine(reader, flags) };
  } else if (flags.type === 3) {
    return { type: "Polygon", coordinates: readPolygon(reader, flags) };
  } else if (flags.type === 4) {
    const points = [];
    for (let i = 0; i < flags.count; i++) {
      points.push(readPosition(reader, getFlags(reader)));
    }
    return { type: "MultiPoint", coordinates: points };
  } else if (flags.type === 5) {
    const lines = [];
    for (let i = 0; i < flags.count; i++) {
      lines.push(readLine(reader, getFlags(reader)));
    }
    return { type: "MultiLineString", coordinates: lines };
  } else if (flags.type === 6) {
    const polygons = [];
    for (let i = 0; i < flags.count; i++) {
      polygons.push(readPolygon(reader, getFlags(reader)));
    }
    return { type: "MultiPolygon", coordinates: polygons };
  } else if (flags.type === 7) {
    const geometries = [];
    for (let i = 0; i < flags.count; i++) {
      geometries.push(wkbToGeojson(reader));
    }
    return { type: "GeometryCollection", geometries };
  } else {
    throw new Error(`Unsupported geometry type: ${flags.type}`);
  }
}
__name(wkbToGeojson, "wkbToGeojson");
function getFlags(reader) {
  const { view } = reader;
  const littleEndian = view.getUint8(reader.offset++) === 1;
  const rawType = view.getUint32(reader.offset, littleEndian);
  reader.offset += 4;
  const type = rawType % 1e3;
  const flags = Math.floor(rawType / 1e3);
  let count = 0;
  if (type > 1 && type <= 7) {
    count = view.getUint32(reader.offset, littleEndian);
    reader.offset += 4;
  }
  let dim = 2;
  if (flags) dim++;
  if (flags === 3) dim++;
  return { littleEndian, type, dim, count };
}
__name(getFlags, "getFlags");
function readPosition(reader, flags) {
  const points = [];
  for (let i = 0; i < flags.dim; i++) {
    const coord = reader.view.getFloat64(reader.offset, flags.littleEndian);
    reader.offset += 8;
    points.push(coord);
  }
  return points;
}
__name(readPosition, "readPosition");
function readLine(reader, flags) {
  const points = [];
  for (let i = 0; i < flags.count; i++) {
    points.push(readPosition(reader, flags));
  }
  return points;
}
__name(readLine, "readLine");
function readPolygon(reader, flags) {
  const { view } = reader;
  const rings = [];
  for (let r = 0; r < flags.count; r++) {
    const count = view.getUint32(reader.offset, flags.littleEndian);
    reader.offset += 4;
    rings.push(readLine(reader, { ...flags, count }));
  }
  return rings;
}
__name(readPolygon, "readPolygon");

// node_modules/hyparquet/src/convert.js
var decoder = new TextDecoder();
var DEFAULT_PARSERS = {
  timestampFromMilliseconds(millis) {
    return new Date(Number(millis));
  },
  timestampFromMicroseconds(micros) {
    return new Date(Number(micros / 1000n));
  },
  timestampFromNanoseconds(nanos) {
    return new Date(Number(nanos / 1000000n));
  },
  dateFromDays(days) {
    return new Date(days * 864e5);
  },
  stringFromBytes(bytes) {
    return bytes && decoder.decode(bytes);
  },
  jsonFromBytes(bytes) {
    return bytes && JSON.parse(decoder.decode(bytes));
  },
  geometryFromBytes(bytes) {
    return bytes && wkbToGeojson({ view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), offset: 0 });
  },
  geographyFromBytes(bytes) {
    return bytes && wkbToGeojson({ view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), offset: 0 });
  },
  uuidFromBytes(bytes) {
    if (!bytes) return void 0;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32);
  }
};
function convertWithDictionary(data, dictionary, encoding, columnDecoder) {
  if (dictionary && encoding.endsWith("_DICTIONARY")) {
    let output = data;
    if (data instanceof Uint8Array && !(dictionary instanceof Uint8Array)) {
      output = new dictionary.constructor(data.length);
    }
    for (let i = 0; i < data.length; i++) {
      output[i] = dictionary[data[i]];
    }
    return output;
  } else {
    return convert(data, columnDecoder);
  }
}
__name(convertWithDictionary, "convertWithDictionary");
function convert(data, columnDecoder) {
  const { element, parsers, utf8 = true, schemaPath } = columnDecoder;
  const { type, converted_type: ctype, logical_type: ltype } = element;
  const nullable = element.repetition_type !== "REQUIRED";
  const isVariant = schemaPath?.some((s) => s.element.logical_type?.type === "VARIANT");
  if (isVariant && type === "BYTE_ARRAY" && ctype !== "UTF8" && ltype?.type !== "STRING") {
    return data;
  }
  if (ctype === "DECIMAL") {
    const scale = element.scale || 0;
    const factor = 10 ** -scale;
    const arr = new Array(data.length);
    for (let i = 0; i < arr.length; i++) {
      if (data[i] instanceof Uint8Array) {
        arr[i] = parseDecimal(data[i]) * factor;
      } else {
        arr[i] = Number(data[i]) * factor;
      }
    }
    return arr;
  }
  if (!ctype && type === "INT96") {
    return Array.from(data).map((v) => parsers.timestampFromNanoseconds(parseInt96Nanos(v)));
  }
  if (ctype === "DATE") {
    return Array.from(data).map((v) => parsers.dateFromDays(v));
  }
  if (ctype === "TIMESTAMP_MILLIS") {
    return Array.from(data).map((v) => parsers.timestampFromMilliseconds(v));
  }
  if (ctype === "TIMESTAMP_MICROS") {
    return Array.from(data).map((v) => parsers.timestampFromMicroseconds(v));
  }
  if (ctype === "JSON") {
    return data.map((v) => parsers.jsonFromBytes(v));
  }
  if (ctype === "BSON") {
    throw new Error("parquet bson not supported");
  }
  if (ctype === "INTERVAL") {
    throw new Error("parquet interval not supported");
  }
  if (ltype?.type === "GEOMETRY") {
    return data.map((v) => parsers.geometryFromBytes(v));
  }
  if (ltype?.type === "GEOGRAPHY") {
    return data.map((v) => parsers.geographyFromBytes(v));
  }
  if (ltype?.type === "UUID") {
    return data.map((v) => parsers.uuidFromBytes(v));
  }
  if (ctype === "UTF8" || ltype?.type === "STRING" || utf8 && type === "BYTE_ARRAY") {
    return data.map((v) => parsers.stringFromBytes(v));
  }
  if (ctype === "UINT_64" || ltype?.type === "INTEGER" && ltype.bitWidth === 64 && !ltype.isSigned) {
    if (data instanceof BigInt64Array) return new BigUint64Array(data.buffer, data.byteOffset, data.length);
    const arr = nullable ? new Array(data.length) : new BigUint64Array(data.length);
    for (let i = 0; i < arr.length; i++) arr[i] = data[i];
    return arr;
  }
  if (ctype === "UINT_32" || ltype?.type === "INTEGER" && ltype.bitWidth === 32 && !ltype.isSigned) {
    if (data instanceof Int32Array) return new Uint32Array(data.buffer, data.byteOffset, data.length);
    const arr = nullable ? new Array(data.length) : new Uint32Array(data.length);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = data[i] < 0 ? 4294967296 + data[i] : data[i];
    }
    return arr;
  }
  if (ltype?.type === "FLOAT16") {
    return Array.from(data).map(parseFloat16);
  }
  if (ltype?.type === "TIMESTAMP") {
    const { unit } = ltype;
    let parser = parsers.timestampFromMilliseconds;
    if (unit === "MICROS") parser = parsers.timestampFromMicroseconds;
    if (unit === "NANOS") parser = parsers.timestampFromNanoseconds;
    const arr = new Array(data.length);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = parser(data[i]);
    }
    return arr;
  }
  return data;
}
__name(convert, "convert");
function parseDecimal(bytes) {
  if (!bytes.length) return 0;
  let value = 0n;
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte);
  }
  const bits = bytes.length * 8;
  if (value >= 2n ** BigInt(bits - 1)) {
    value -= 2n ** BigInt(bits);
  }
  return Number(value);
}
__name(parseDecimal, "parseDecimal");
function parseInt96Nanos(value) {
  const days = (value >> 64n) - 2440588n;
  const nano = value & 0xffffffffffffffffn;
  return days * 86400000000000n + nano;
}
__name(parseInt96Nanos, "parseInt96Nanos");
function parseFloat16(bytes) {
  if (!bytes) return void 0;
  const int16 = bytes[1] << 8 | bytes[0];
  const sign = int16 >> 15 ? -1 : 1;
  const exp = int16 >> 10 & 31;
  const frac = int16 & 1023;
  if (exp === 0) return sign * 2 ** -14 * (frac / 1024);
  if (exp === 31) return frac ? NaN : sign * Infinity;
  return sign * 2 ** (exp - 15) * (1 + frac / 1024);
}
__name(parseFloat16, "parseFloat16");

// node_modules/hyparquet/src/schema.js
function schemaTree(schema, rootIndex, path) {
  const element = schema[rootIndex];
  const children = [];
  let count = 1;
  if (element.num_children) {
    while (children.length < element.num_children) {
      const childElement = schema[rootIndex + count];
      const child = schemaTree(schema, rootIndex + count, [...path, childElement.name]);
      count += child.count;
      children.push(child);
    }
  }
  return { count, element, children, path };
}
__name(schemaTree, "schemaTree");
function getSchemaPath(schema, name) {
  let tree = schemaTree(schema, 0, []);
  const path = [tree];
  for (const part of name) {
    const child = tree.children.find((child2) => child2.element.name === part);
    if (!child) throw new Error(`parquet schema element not found: ${name}`);
    path.push(child);
    tree = child;
  }
  return path;
}
__name(getSchemaPath, "getSchemaPath");
function getPhysicalColumns(schemaTree2) {
  const columns = [];
  function traverse(node) {
    if (node.children.length) {
      for (const child of node.children) {
        traverse(child);
      }
    } else {
      columns.push(node.path.join("."));
    }
  }
  __name(traverse, "traverse");
  traverse(schemaTree2);
  return columns;
}
__name(getPhysicalColumns, "getPhysicalColumns");
function getMaxRepetitionLevel(schemaPath) {
  let maxLevel = 0;
  for (const { element } of schemaPath) {
    if (element.repetition_type === "REPEATED") {
      maxLevel++;
    }
  }
  return maxLevel;
}
__name(getMaxRepetitionLevel, "getMaxRepetitionLevel");
function getMaxDefinitionLevel(schemaPath) {
  let maxLevel = 0;
  for (const { element } of schemaPath.slice(1)) {
    if (element.repetition_type !== "REQUIRED") {
      maxLevel++;
    }
  }
  return maxLevel;
}
__name(getMaxDefinitionLevel, "getMaxDefinitionLevel");
function isListLike(schema) {
  if (!schema) return false;
  if (schema.element.converted_type !== "LIST") return false;
  if (schema.children.length > 1) return false;
  const firstChild = schema.children[0];
  if (firstChild.children.length > 1) return false;
  if (firstChild.element.repetition_type !== "REPEATED") return false;
  return true;
}
__name(isListLike, "isListLike");
function isMapLike(schema) {
  if (!schema) return false;
  if (schema.element.converted_type !== "MAP") return false;
  if (schema.children.length > 1) return false;
  const firstChild = schema.children[0];
  if (firstChild.children.length !== 2) return false;
  if (firstChild.element.repetition_type !== "REPEATED") return false;
  const keyChild = firstChild.children.find((child) => child.element.name === "key");
  if (keyChild?.element.repetition_type === "REPEATED") return false;
  const valueChild = firstChild.children.find((child) => child.element.name === "value");
  if (valueChild?.element.repetition_type === "REPEATED") return false;
  return true;
}
__name(isMapLike, "isMapLike");
function isFlatColumn(schemaPath) {
  if (schemaPath.length !== 2) return false;
  const [, column] = schemaPath;
  if (column.element.repetition_type === "REPEATED") return false;
  if (column.children.length) return false;
  return true;
}
__name(isFlatColumn, "isFlatColumn");

// node_modules/hyparquet/src/thrift.js
var STOP = 0;
var TRUE = 1;
var FALSE = 2;
var BYTE = 3;
var I16 = 4;
var I32 = 5;
var I64 = 6;
var DOUBLE = 7;
var BINARY = 8;
var LIST = 9;
var STRUCT = 12;
function deserializeTCompactProtocol(reader) {
  const value = {};
  let fid = 0;
  while (reader.offset < reader.view.byteLength) {
    const byte = reader.view.getUint8(reader.offset++);
    const type = byte & 15;
    if (type === STOP) break;
    const delta = byte >> 4;
    fid = delta ? fid + delta : readZigZag(reader);
    value[`field_${fid}`] = readElement(reader, type);
  }
  return value;
}
__name(deserializeTCompactProtocol, "deserializeTCompactProtocol");
function readElement(reader, type) {
  switch (type) {
    case TRUE:
      return true;
    case FALSE:
      return false;
    case BYTE:
      return reader.view.getInt8(reader.offset++);
    case I16:
    case I32:
      return readZigZag(reader);
    case I64:
      return readZigZagBigInt(reader);
    case DOUBLE: {
      const value = reader.view.getFloat64(reader.offset, true);
      reader.offset += 8;
      return value;
    }
    case BINARY: {
      const stringLength = readVarInt(reader);
      const strBytes = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, stringLength);
      reader.offset += stringLength;
      return strBytes;
    }
    case LIST: {
      const byte = reader.view.getUint8(reader.offset++);
      const elemType = byte & 15;
      let listSize = byte >> 4;
      if (listSize === 15) {
        listSize = readVarInt(reader);
      }
      const boolType = elemType === TRUE || elemType === FALSE;
      const values = new Array(listSize);
      for (let i = 0; i < listSize; i++) {
        values[i] = boolType ? readElement(reader, BYTE) === 1 : readElement(reader, elemType);
      }
      return values;
    }
    case STRUCT:
      return deserializeTCompactProtocol(reader);
    default:
      throw new Error(`thrift unhandled type: ${type}`);
  }
}
__name(readElement, "readElement");
function readVarInt(reader) {
  let result = 0;
  let shift = 0;
  while (true) {
    const byte = reader.view.getUint8(reader.offset++);
    result |= (byte & 127) << shift;
    if (!(byte & 128)) {
      return result;
    }
    shift += 7;
  }
}
__name(readVarInt, "readVarInt");
function readVarBigInt(reader) {
  let result = 0n;
  let shift = 0n;
  while (true) {
    const byte = reader.view.getUint8(reader.offset++);
    result |= BigInt(byte & 127) << shift;
    if (!(byte & 128)) {
      return result;
    }
    shift += 7n;
  }
}
__name(readVarBigInt, "readVarBigInt");
function readZigZag(reader) {
  const zigzag = readVarInt(reader);
  return zigzag >>> 1 ^ -(zigzag & 1);
}
__name(readZigZag, "readZigZag");
function readZigZagBigInt(reader) {
  const zigzag = readVarBigInt(reader);
  return zigzag >> 1n ^ -(zigzag & 1n);
}
__name(readZigZagBigInt, "readZigZagBigInt");

// node_modules/hyparquet/src/geoparquet.js
function markGeoColumns(schema, key_value_metadata) {
  const columns = /* @__PURE__ */ new Map();
  const geo = key_value_metadata?.find(({ key }) => key === "geo")?.value;
  const decodedColumns = (geo && JSON.parse(geo)?.columns) ?? {};
  for (const [name, column] of Object.entries(decodedColumns)) {
    if (column.encoding !== "WKB") continue;
    const type = column.edges === "spherical" ? "GEOGRAPHY" : "GEOMETRY";
    const id = column.crs?.id ?? column.crs?.ids?.[0];
    const crs = id ? `${id.authority}:${id.code.toString()}` : void 0;
    columns.set(name, { type, crs });
  }
  for (let i = 1; i < schema.length; i++) {
    const { logical_type, name, num_children, type } = schema[i];
    if (num_children) {
      i += num_children;
      continue;
    }
    if (type === "BYTE_ARRAY" && !logical_type) {
      schema[i].logical_type = columns.get(name);
    }
  }
}
__name(markGeoColumns, "markGeoColumns");

// node_modules/hyparquet/src/metadata.js
var defaultInitialFetchSize = 1 << 19;
var decoder2 = new TextDecoder();
function decode(value) {
  return value && decoder2.decode(value);
}
__name(decode, "decode");
async function parquetMetadataAsync(asyncBuffer, { parsers, initialFetchSize = defaultInitialFetchSize, geoparquet = true } = {}) {
  if (!asyncBuffer || !(asyncBuffer.byteLength >= 0)) throw new Error("parquet expected AsyncBuffer");
  const footerOffset = Math.max(0, asyncBuffer.byteLength - initialFetchSize);
  const footerBuffer = await asyncBuffer.slice(footerOffset, asyncBuffer.byteLength);
  const footerView = new DataView(footerBuffer);
  if (footerView.getUint32(footerBuffer.byteLength - 4, true) !== 827474256) {
    throw new Error("parquet file invalid (footer != PAR1)");
  }
  const metadataLength = footerView.getUint32(footerBuffer.byteLength - 8, true);
  if (metadataLength > asyncBuffer.byteLength - 8) {
    throw new Error(`parquet metadata length ${metadataLength} exceeds available buffer ${asyncBuffer.byteLength - 8}`);
  }
  if (metadataLength + 8 > initialFetchSize) {
    const metadataOffset = asyncBuffer.byteLength - metadataLength - 8;
    const metadataBuffer = await asyncBuffer.slice(metadataOffset, footerOffset);
    const combinedBuffer = new ArrayBuffer(metadataLength + 8);
    const combinedView = new Uint8Array(combinedBuffer);
    combinedView.set(new Uint8Array(metadataBuffer));
    combinedView.set(new Uint8Array(footerBuffer), footerOffset - metadataOffset);
    return parquetMetadata(combinedBuffer, { parsers, geoparquet });
  } else {
    return parquetMetadata(footerBuffer, { parsers, geoparquet });
  }
}
__name(parquetMetadataAsync, "parquetMetadataAsync");
function parquetMetadata(arrayBuffer, { parsers, geoparquet = true } = {}) {
  if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error("parquet expected ArrayBuffer");
  const view = new DataView(arrayBuffer);
  parsers = { ...DEFAULT_PARSERS, ...parsers };
  if (view.byteLength < 8) {
    throw new Error("parquet file is too short");
  }
  if (view.getUint32(view.byteLength - 4, true) !== 827474256) {
    throw new Error("parquet file invalid (footer != PAR1)");
  }
  const metadataLengthOffset = view.byteLength - 8;
  const metadataLength = view.getUint32(metadataLengthOffset, true);
  if (metadataLength > view.byteLength - 8) {
    throw new Error(`parquet metadata length ${metadataLength} exceeds available buffer ${view.byteLength - 8}`);
  }
  const metadataOffset = metadataLengthOffset - metadataLength;
  const reader = { view, offset: metadataOffset };
  const metadata = deserializeTCompactProtocol(reader);
  const version = metadata.field_1;
  const schema = metadata.field_2.map((field) => ({
    type: ParquetTypes[field.field_1],
    type_length: field.field_2,
    repetition_type: FieldRepetitionTypes[field.field_3],
    name: decode(field.field_4),
    num_children: field.field_5,
    converted_type: ConvertedTypes[field.field_6],
    scale: field.field_7,
    precision: field.field_8,
    field_id: field.field_9,
    logical_type: logicalType(field.field_10)
  }));
  const columnSchema = schema.filter((e) => e.type);
  const num_rows = metadata.field_3;
  const row_groups = metadata.field_4.map((rowGroup) => ({
    columns: rowGroup.field_1.map((column, columnIndex) => ({
      file_path: decode(column.field_1),
      file_offset: column.field_2,
      meta_data: column.field_3 && {
        type: ParquetTypes[column.field_3.field_1],
        encodings: column.field_3.field_2?.map((e) => Encodings[e]),
        path_in_schema: column.field_3.field_3.map(decode),
        codec: CompressionCodecs[column.field_3.field_4],
        num_values: column.field_3.field_5,
        total_uncompressed_size: column.field_3.field_6,
        total_compressed_size: column.field_3.field_7,
        key_value_metadata: column.field_3.field_8?.map((kv) => ({
          key: decode(kv.field_1),
          value: decode(kv.field_2)
        })),
        data_page_offset: column.field_3.field_9,
        index_page_offset: column.field_3.field_10,
        dictionary_page_offset: column.field_3.field_11,
        statistics: convertStats(column.field_3.field_12, columnSchema[columnIndex], parsers),
        encoding_stats: column.field_3.field_13?.map((encodingStat) => ({
          page_type: PageTypes[encodingStat.field_1],
          encoding: Encodings[encodingStat.field_2],
          count: encodingStat.field_3
        })),
        bloom_filter_offset: column.field_3.field_14,
        bloom_filter_length: column.field_3.field_15,
        size_statistics: column.field_3.field_16 && {
          unencoded_byte_array_data_bytes: column.field_3.field_16.field_1,
          repetition_level_histogram: column.field_3.field_16.field_2,
          definition_level_histogram: column.field_3.field_16.field_3
        },
        geospatial_statistics: column.field_3.field_17 && {
          bbox: column.field_3.field_17.field_1 && {
            xmin: column.field_3.field_17.field_1.field_1,
            xmax: column.field_3.field_17.field_1.field_2,
            ymin: column.field_3.field_17.field_1.field_3,
            ymax: column.field_3.field_17.field_1.field_4,
            zmin: column.field_3.field_17.field_1.field_5,
            zmax: column.field_3.field_17.field_1.field_6,
            mmin: column.field_3.field_17.field_1.field_7,
            mmax: column.field_3.field_17.field_1.field_8
          },
          geospatial_types: column.field_3.field_17.field_2
        }
      },
      offset_index_offset: column.field_4,
      offset_index_length: column.field_5,
      column_index_offset: column.field_6,
      column_index_length: column.field_7,
      crypto_metadata: column.field_8,
      encrypted_column_metadata: column.field_9
    })),
    total_byte_size: rowGroup.field_2,
    num_rows: rowGroup.field_3,
    sorting_columns: rowGroup.field_4?.map((sortingColumn) => ({
      column_idx: sortingColumn.field_1,
      descending: sortingColumn.field_2,
      nulls_first: sortingColumn.field_3
    })),
    file_offset: rowGroup.field_5,
    total_compressed_size: rowGroup.field_6,
    ordinal: rowGroup.field_7
  }));
  const key_value_metadata = metadata.field_5?.map((kv) => ({
    key: decode(kv.field_1),
    value: decode(kv.field_2)
  }));
  const created_by = decode(metadata.field_6);
  if (geoparquet) {
    markGeoColumns(schema, key_value_metadata);
  }
  return {
    version,
    schema,
    num_rows,
    row_groups,
    key_value_metadata,
    created_by,
    metadata_length: metadataLength
  };
}
__name(parquetMetadata, "parquetMetadata");
function parquetSchema({ schema }) {
  return getSchemaPath(schema, [])[0];
}
__name(parquetSchema, "parquetSchema");
function logicalType(logicalType2) {
  if (logicalType2?.field_1) return { type: "STRING" };
  if (logicalType2?.field_2) return { type: "MAP" };
  if (logicalType2?.field_3) return { type: "LIST" };
  if (logicalType2?.field_4) return { type: "ENUM" };
  if (logicalType2?.field_5) return {
    type: "DECIMAL",
    scale: logicalType2.field_5.field_1,
    precision: logicalType2.field_5.field_2
  };
  if (logicalType2?.field_6) return { type: "DATE" };
  if (logicalType2?.field_7) return {
    type: "TIME",
    isAdjustedToUTC: logicalType2.field_7.field_1,
    unit: timeUnit(logicalType2.field_7.field_2)
  };
  if (logicalType2?.field_8) return {
    type: "TIMESTAMP",
    isAdjustedToUTC: logicalType2.field_8.field_1,
    unit: timeUnit(logicalType2.field_8.field_2)
  };
  if (logicalType2?.field_10) return {
    type: "INTEGER",
    bitWidth: logicalType2.field_10.field_1,
    isSigned: logicalType2.field_10.field_2
  };
  if (logicalType2?.field_11) return { type: "NULL" };
  if (logicalType2?.field_12) return { type: "JSON" };
  if (logicalType2?.field_13) return { type: "BSON" };
  if (logicalType2?.field_14) return { type: "UUID" };
  if (logicalType2?.field_15) return { type: "FLOAT16" };
  if (logicalType2?.field_16) return {
    type: "VARIANT",
    specification_version: logicalType2.field_16.field_1
  };
  if (logicalType2?.field_17) return {
    type: "GEOMETRY",
    crs: decode(logicalType2.field_17.field_1)
  };
  if (logicalType2?.field_18) return {
    type: "GEOGRAPHY",
    crs: decode(logicalType2.field_18.field_1),
    algorithm: EdgeInterpolationAlgorithms[logicalType2.field_18.field_2]
  };
  return logicalType2;
}
__name(logicalType, "logicalType");
function timeUnit(unit) {
  if (unit.field_1) return "MILLIS";
  if (unit.field_2) return "MICROS";
  if (unit.field_3) return "NANOS";
  throw new Error("parquet time unit required");
}
__name(timeUnit, "timeUnit");
function convertStats(stats, schema, parsers) {
  return stats && {
    max: convertMetadata(stats.field_1, schema, parsers),
    min: convertMetadata(stats.field_2, schema, parsers),
    null_count: stats.field_3,
    distinct_count: stats.field_4,
    max_value: convertMetadata(stats.field_5, schema, parsers),
    min_value: convertMetadata(stats.field_6, schema, parsers),
    is_max_value_exact: stats.field_7,
    is_min_value_exact: stats.field_8
  };
}
__name(convertStats, "convertStats");
function convertMetadata(value, schema, parsers) {
  const { type, converted_type, logical_type } = schema;
  if (value === void 0) return value;
  if (type === "BOOLEAN") return value[0] === 1;
  if (type === "BYTE_ARRAY") return parsers.stringFromBytes(value);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  if (type === "FLOAT" && view.byteLength === 4) return view.getFloat32(0, true);
  if (type === "DOUBLE" && view.byteLength === 8) return view.getFloat64(0, true);
  if (type === "INT32" && converted_type === "DATE") return parsers.dateFromDays(view.getInt32(0, true));
  if (type === "INT64" && converted_type === "TIMESTAMP_MILLIS") return parsers.timestampFromMilliseconds(view.getBigInt64(0, true));
  if (type === "INT64" && converted_type === "TIMESTAMP_MICROS") return parsers.timestampFromMicroseconds(view.getBigInt64(0, true));
  if (type === "INT64" && logical_type?.type === "TIMESTAMP" && logical_type?.unit === "NANOS") return parsers.timestampFromNanoseconds(view.getBigInt64(0, true));
  if (type === "INT64" && logical_type?.type === "TIMESTAMP" && logical_type?.unit === "MICROS") return parsers.timestampFromMicroseconds(view.getBigInt64(0, true));
  if (type === "INT64" && logical_type?.type === "TIMESTAMP") return parsers.timestampFromMilliseconds(view.getBigInt64(0, true));
  if (type === "INT32" && view.byteLength === 4) return view.getInt32(0, true);
  if (type === "INT64" && view.byteLength === 8) return view.getBigInt64(0, true);
  if (converted_type === "DECIMAL") return parseDecimal(value) * 10 ** -(schema.scale || 0);
  if (logical_type?.type === "FLOAT16") return parseFloat16(value);
  if (logical_type?.type === "UUID") return parsers.uuidFromBytes(value);
  if (type === "FIXED_LEN_BYTE_ARRAY") return value;
  return value;
}
__name(convertMetadata, "convertMetadata");

// node_modules/hyparquet/src/indexes.js
function readOffsetIndex(reader) {
  const thrift = deserializeTCompactProtocol(reader);
  return {
    // @ts-ignore
    page_locations: thrift.field_1.map((loc) => ({
      offset: loc.field_1,
      compressed_page_size: loc.field_2,
      first_row_index: loc.field_3
    })),
    unencoded_byte_array_data_bytes: thrift.field_2
  };
}
__name(readOffsetIndex, "readOffsetIndex");

// node_modules/hyparquet/src/xxhash.js
var MASK = 0xffffffffffffffffn;
var PRIME1 = 0x9e3779b185ebca87n;
var PRIME2 = 0xc2b2ae3d27d4eb4fn;
var PRIME3 = 0x165667b19e3779f9n;
var PRIME4 = 0x85ebca77c2b2ae63n;
var PRIME5 = 0x27d4eb2f165667c5n;
function rotl64(x, r) {
  return (x << r | x >> 64n - r) & MASK;
}
__name(rotl64, "rotl64");
function round(acc, val) {
  acc = acc + val * PRIME2 & MASK;
  acc = rotl64(acc, 31n);
  return acc * PRIME1 & MASK;
}
__name(round, "round");
function mergeRound(acc, val) {
  acc ^= round(0n, val);
  return acc * PRIME1 + PRIME4 & MASK;
}
__name(mergeRound, "mergeRound");
function xxhash64(input, seed = 0n) {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const len = input.byteLength;
  let offset = 0;
  let h64;
  if (len >= 32) {
    let v1 = seed + PRIME1 + PRIME2 & MASK;
    let v2 = seed + PRIME2 & MASK;
    let v3 = seed;
    let v4 = seed - PRIME1 & MASK;
    while (offset + 32 <= len) {
      v1 = round(v1, view.getBigUint64(offset, true));
      offset += 8;
      v2 = round(v2, view.getBigUint64(offset, true));
      offset += 8;
      v3 = round(v3, view.getBigUint64(offset, true));
      offset += 8;
      v4 = round(v4, view.getBigUint64(offset, true));
      offset += 8;
    }
    h64 = rotl64(v1, 1n) + rotl64(v2, 7n) + rotl64(v3, 12n) + rotl64(v4, 18n) & MASK;
    h64 = mergeRound(h64, v1);
    h64 = mergeRound(h64, v2);
    h64 = mergeRound(h64, v3);
    h64 = mergeRound(h64, v4);
  } else {
    h64 = seed + PRIME5 & MASK;
  }
  h64 = h64 + BigInt(len) & MASK;
  while (offset + 8 <= len) {
    h64 ^= round(0n, view.getBigUint64(offset, true));
    h64 = rotl64(h64, 27n) * PRIME1 + PRIME4 & MASK;
    offset += 8;
  }
  if (offset + 4 <= len) {
    h64 ^= BigInt(view.getUint32(offset, true)) * PRIME1 & MASK;
    h64 = rotl64(h64, 23n) * PRIME2 + PRIME3 & MASK;
    offset += 4;
  }
  while (offset < len) {
    h64 ^= BigInt(view.getUint8(offset)) * PRIME5 & MASK;
    h64 = rotl64(h64, 11n) * PRIME1 & MASK;
    offset += 1;
  }
  h64 ^= h64 >> 33n;
  h64 = h64 * PRIME2 & MASK;
  h64 ^= h64 >> 29n;
  h64 = h64 * PRIME3 & MASK;
  h64 ^= h64 >> 32n;
  return h64;
}
__name(xxhash64, "xxhash64");

// node_modules/hyparquet/src/bloom.js
var textEncoder = new TextEncoder();
var SALT = new Uint32Array([
  1203114875,
  1150766481,
  2284105051,
  2729912477,
  1884591559,
  770785867,
  2667333959,
  1550580529
]);
function blockIndex(hash, numBlocks) {
  return Number((hash >> 32n) * BigInt(numBlocks) >> 32n);
}
__name(blockIndex, "blockIndex");
function blockMask(hash) {
  const m = new Uint32Array(8);
  const low = Number(hash & 0xffffffffn) | 0;
  for (let i = 0; i < 8; i++) {
    m[i] = 1 << (Math.imul(low, SALT[i]) >>> 27);
  }
  return m;
}
__name(blockMask, "blockMask");
function sbbfContains(blocks, hash) {
  const offset = blockIndex(hash, blocks.length >> 3) << 3;
  const m = blockMask(hash);
  for (let i = 0; i < 8; i++) {
    if ((blocks[offset + i] & m[i]) === 0) return false;
  }
  return true;
}
__name(sbbfContains, "sbbfContains");
function readBloomFilter(reader) {
  const header = deserializeTCompactProtocol(reader);
  const numBytes = header.field_1;
  if (typeof numBytes !== "number" || numBytes <= 0 || numBytes % 32 !== 0) return void 0;
  if (!header.field_2?.field_1) return void 0;
  if (!header.field_3?.field_1) return void 0;
  if (!header.field_4?.field_1) return void 0;
  const { view, offset } = reader;
  if (offset + numBytes > view.byteLength) {
    throw new Error(`parquet bloom filter truncated: need ${numBytes} bytes, have ${view.byteLength - offset}`);
  }
  const blocks = new Uint32Array(numBytes >> 2);
  for (let i = 0; i < blocks.length; i++) {
    blocks[i] = view.getUint32(offset + i * 4, true);
  }
  reader.offset = offset + numBytes;
  return { numBytes, blocks };
}
__name(readBloomFilter, "readBloomFilter");
function hashParquetValue(value, element) {
  if (value === null || value === void 0) return void 0;
  const { type, converted_type, logical_type } = element;
  if (type === "BOOLEAN") {
    if (typeof value !== "boolean") return void 0;
    return xxhash64(new Uint8Array([value ? 1 : 0]));
  }
  if (type === "FLOAT") {
    if (typeof value !== "number") return void 0;
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    return xxhash64(new Uint8Array(buf));
  }
  if (type === "DOUBLE") {
    if (typeof value !== "number") return void 0;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    return xxhash64(new Uint8Array(buf));
  }
  if (type === "INT32") {
    if (converted_type === "DATE" || converted_type === "DECIMAL" || converted_type === "TIME_MILLIS") return void 0;
    if (logical_type?.type === "DATE" || logical_type?.type === "TIME" || logical_type?.type === "DECIMAL") return void 0;
    if (typeof value !== "number" || !Number.isInteger(value)) return void 0;
    const buf = new ArrayBuffer(4);
    new DataView(buf).setInt32(0, value | 0, true);
    return xxhash64(new Uint8Array(buf));
  }
  if (type === "INT64") {
    if (converted_type === "TIMESTAMP_MILLIS" || converted_type === "TIMESTAMP_MICROS") return void 0;
    if (converted_type === "TIME_MICROS" || converted_type === "DECIMAL") return void 0;
    if (logical_type?.type === "TIMESTAMP" || logical_type?.type === "TIME" || logical_type?.type === "DECIMAL") return void 0;
    let bigValue;
    if (typeof value === "bigint") bigValue = value;
    else if (typeof value === "number" && Number.isSafeInteger(value)) bigValue = BigInt(value);
    else return void 0;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, BigInt.asUintN(64, bigValue), true);
    return xxhash64(new Uint8Array(buf));
  }
  if (type === "BYTE_ARRAY") {
    if (converted_type === "JSON" || converted_type === "BSON" || converted_type === "DECIMAL") return void 0;
    if (logical_type?.type === "JSON" || logical_type?.type === "BSON" || logical_type?.type === "VARIANT") return void 0;
    if (logical_type?.type === "GEOMETRY" || logical_type?.type === "GEOGRAPHY") return void 0;
    if (typeof value === "string") return xxhash64(textEncoder.encode(value));
    if (value instanceof Uint8Array) return xxhash64(value);
    return void 0;
  }
  if (type === "FIXED_LEN_BYTE_ARRAY") {
    if (converted_type === "DECIMAL" || converted_type === "INTERVAL") return void 0;
    if (logical_type?.type === "DECIMAL" || logical_type?.type === "UUID" || logical_type?.type === "FLOAT16") return void 0;
    if (logical_type?.type === "GEOMETRY" || logical_type?.type === "GEOGRAPHY") return void 0;
    if (value instanceof Uint8Array) return xxhash64(value);
    return void 0;
  }
  return void 0;
}
__name(hashParquetValue, "hashParquetValue");
function bloomEligibleColumns(filter) {
  const out = /* @__PURE__ */ new Set();
  walkBloomEligible(filter, out);
  return out;
}
__name(bloomEligibleColumns, "bloomEligibleColumns");
function walkBloomEligible(filter, out) {
  if (!filter) return;
  if ("$and" in filter && Array.isArray(filter.$and)) {
    for (const sub of filter.$and) walkBloomEligible(sub, out);
    return;
  }
  if ("$or" in filter && Array.isArray(filter.$or)) {
    for (const sub of filter.$or) walkBloomEligible(sub, out);
    return;
  }
  if ("$nor" in filter) return;
  for (const [field, condition] of Object.entries(filter)) {
    if (field.startsWith("$")) continue;
    if (typeof condition === "object" && condition !== null && !Array.isArray(condition)) {
      if ("$eq" in condition || "$in" in condition) out.add(field);
    } else {
      out.add(field);
    }
  }
}
__name(walkBloomEligible, "walkBloomEligible");

// node_modules/hyparquet/src/utils.js
function concat(aaa, bbb) {
  const chunk = 1e4;
  for (let i = 0; i < bbb.length; i += chunk) {
    aaa.push(...bbb.slice(i, i + chunk));
  }
}
__name(concat, "concat");
function equals(a, b, strict = true) {
  if (strict ? a === b : a == b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!equals(a[i], b[i], strict)) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const k of aKeys) {
    if (!equals(a[k], b[k], strict)) return false;
  }
  return true;
}
__name(equals, "equals");
function cachedAsyncBuffer({ byteLength, slice }, { minSize = defaultInitialFetchSize } = {}) {
  if (byteLength < minSize) {
    const buffer = slice(0, byteLength);
    return {
      byteLength,
      async slice(start, end) {
        return (await buffer).slice(start, end);
      }
    };
  }
  const cache = /* @__PURE__ */ new Map();
  return {
    byteLength,
    /**
     * @param {number} start
     * @param {number} [end]
     * @returns {Awaitable<ArrayBuffer>}
     */
    slice(start, end) {
      const key = cacheKey(start, end, byteLength);
      const cached = cache.get(key);
      if (cached) return cached;
      const promise = slice(start, end);
      cache.set(key, promise);
      return promise;
    }
  };
}
__name(cachedAsyncBuffer, "cachedAsyncBuffer");
function cacheKey(start, end, size) {
  if (start < 0) {
    if (end !== void 0) throw new Error(`invalid suffix range [${start}, ${end}]`);
    if (size === void 0) return `${start},`;
    return `${size + start},${size}`;
  } else if (end !== void 0) {
    if (start > end) throw new Error(`invalid empty range [${start}, ${end}]`);
    return `${start},${end}`;
  } else if (size === void 0) {
    return `${start},`;
  } else {
    return `${start},${size}`;
  }
}
__name(cacheKey, "cacheKey");
function flatten(chunks) {
  if (!chunks) return [];
  if (chunks.length === 1) return chunks[0];
  const output = [];
  for (const chunk of chunks) {
    concat(output, chunk);
  }
  return output;
}
__name(flatten, "flatten");

// node_modules/hyparquet/src/filter.js
function columnsNeededForFilter(filter) {
  if (!filter) return [];
  const columns = [];
  if ("$and" in filter && Array.isArray(filter.$and)) {
    columns.push(...filter.$and.flatMap(columnsNeededForFilter));
  } else if ("$or" in filter && Array.isArray(filter.$or)) {
    columns.push(...filter.$or.flatMap(columnsNeededForFilter));
  } else if ("$nor" in filter && Array.isArray(filter.$nor)) {
    columns.push(...filter.$nor.flatMap(columnsNeededForFilter));
  } else {
    columns.push(...Object.keys(filter).map((key) => key.split(".")[0]));
  }
  return [...new Set(columns)];
}
__name(columnsNeededForFilter, "columnsNeededForFilter");
function matchFilter(record, filter, strict = true) {
  if ("$and" in filter && Array.isArray(filter.$and)) {
    return filter.$and.every((subQuery) => matchFilter(record, subQuery, strict));
  }
  if ("$or" in filter && Array.isArray(filter.$or)) {
    return filter.$or.some((subQuery) => matchFilter(record, subQuery, strict));
  }
  if ("$nor" in filter && Array.isArray(filter.$nor)) {
    return !filter.$nor.some((subQuery) => matchFilter(record, subQuery, strict));
  }
  return Object.entries(filter).every(([field, condition]) => {
    const value = resolve(record, field);
    if (typeof condition !== "object" || condition === null || Array.isArray(condition)) {
      return equals(value, condition, strict);
    }
    return Object.entries(condition || {}).every(([operator, target]) => {
      if (operator === "$gt") return value > target;
      if (operator === "$gte") return value >= target;
      if (operator === "$lt") return value < target;
      if (operator === "$lte") return value <= target;
      if (operator === "$eq") return equals(value, target, strict);
      if (operator === "$ne") return !equals(value, target, strict);
      if (operator === "$in") return Array.isArray(target) && target.includes(value);
      if (operator === "$nin") return Array.isArray(target) && !target.includes(value);
      if (operator === "$not") return !matchFilter({ [field]: value }, { [field]: target }, strict);
      return true;
    });
  });
}
__name(matchFilter, "matchFilter");
function canSkipRowGroup({ rowGroup, physicalColumns, filter, strict = true, bloomFilters, schemaElements }) {
  if (!filter) return false;
  if ("$and" in filter && Array.isArray(filter.$and)) {
    return filter.$and.some((subFilter) => canSkipRowGroup({ rowGroup, physicalColumns, filter: subFilter, strict, bloomFilters, schemaElements }));
  }
  if ("$or" in filter && Array.isArray(filter.$or)) {
    return filter.$or.every((subFilter) => canSkipRowGroup({ rowGroup, physicalColumns, filter: subFilter, strict, bloomFilters, schemaElements }));
  }
  if ("$nor" in filter && Array.isArray(filter.$nor)) {
    return false;
  }
  for (const [field, condition] of Object.entries(filter)) {
    const columnIndex = physicalColumns.indexOf(field);
    if (columnIndex === -1) continue;
    const stats = rowGroup.columns[columnIndex].meta_data?.statistics;
    const { min, max, min_value, max_value } = stats || {};
    const minVal = min_value !== void 0 ? min_value : min;
    const maxVal = max_value !== void 0 ? max_value : max;
    const haveStats = minVal !== void 0 && maxVal !== void 0;
    const bloom = bloomFilters?.[field];
    const element = schemaElements?.[field];
    for (const [operator, target] of Object.entries(condition || {})) {
      if (haveStats) {
        if (operator === "$gt" && maxVal <= target) return true;
        if (operator === "$gte" && maxVal < target) return true;
        if (operator === "$lt" && minVal >= target) return true;
        if (operator === "$lte" && minVal > target) return true;
        if (operator === "$eq" && (target < minVal || target > maxVal)) return true;
        if (operator === "$ne" && equals(minVal, maxVal, strict) && equals(minVal, target, strict)) return true;
        if (operator === "$in" && Array.isArray(target) && target.every((v) => v < minVal || v > maxVal)) return true;
        if (operator === "$nin" && Array.isArray(target) && equals(minVal, maxVal, strict) && target.includes(minVal)) return true;
      }
      if (bloom && element) {
        if (operator === "$eq") {
          const hash = hashParquetValue(target, element);
          if (hash !== void 0 && !sbbfContains(bloom.blocks, hash)) return true;
        }
        if (operator === "$in" && Array.isArray(target) && target.length > 0) {
          let allAbsent = true;
          for (const v of target) {
            const h = hashParquetValue(v, element);
            if (h === void 0 || sbbfContains(bloom.blocks, h)) {
              allAbsent = false;
              break;
            }
          }
          if (allAbsent) return true;
        }
      }
    }
  }
  return false;
}
__name(canSkipRowGroup, "canSkipRowGroup");
function resolve(record, path) {
  let value = record;
  for (const part of path.split(".")) {
    value = value?.[part];
  }
  return value;
}
__name(resolve, "resolve");

// node_modules/hyparquet/src/plan.js
var runLimit = 1 << 21;
function parquetPlan({ metadata, rowStart = 0, rowEnd = Infinity, columns, filter, filterStrict = true, useOffsetIndex = false, bloomFiltersByGroup, schemaElements }) {
  if (!metadata) throw new Error("parquetPlan requires metadata");
  const groups = [];
  const fetches = [];
  const indexes = [];
  const physicalColumns = getPhysicalColumns(parquetSchema(metadata));
  let groupStart = 0;
  let rgIdx = 0;
  for (const rowGroup of metadata.row_groups) {
    const groupRows = Number(rowGroup.num_rows);
    const groupEnd = groupStart + groupRows;
    const bloomFilters = bloomFiltersByGroup?.[rgIdx];
    if (groupRows > 0 && groupEnd > rowStart && groupStart < rowEnd && !canSkipRowGroup({ rowGroup, physicalColumns, filter, strict: filterStrict, bloomFilters, schemaElements })) {
      const chunks = [];
      let groupStartByte = Infinity;
      let groupEndByte = -Infinity;
      for (const chunk of rowGroup.columns) {
        const meta = chunk.meta_data;
        if (chunk.file_path) throw new Error("parquet file_path not supported");
        if (!meta) throw new Error("parquet column metadata is undefined");
        if (!columns || columns.includes(meta.path_in_schema[0])) {
          const columnOffset = meta.dictionary_page_offset || meta.data_page_offset;
          const startByte = Number(columnOffset);
          const endByte = Number(columnOffset + meta.total_compressed_size);
          if (startByte < groupStartByte) groupStartByte = startByte;
          if (endByte > groupEndByte) groupEndByte = endByte;
          if (useOffsetIndex && chunk.offset_index_offset && chunk.offset_index_length && (rowStart > groupStart || rowEnd < groupEnd)) {
            const offsetIndexStart = Number(chunk.offset_index_offset);
            chunks.push({
              columnMetadata: meta,
              offsetIndex: {
                startByte: offsetIndexStart,
                endByte: offsetIndexStart + chunk.offset_index_length
              },
              range: { startByte, endByte }
            });
          } else {
            chunks.push({
              columnMetadata: meta,
              range: { startByte, endByte }
            });
          }
        }
      }
      const selectStart = Math.max(rowStart - groupStart, 0);
      const selectEnd = Math.min(rowEnd - groupStart, groupRows);
      groups.push({ chunks, rowGroup, groupStart, groupRows, selectStart, selectEnd });
      let run;
      for (const chunk of chunks) {
        if ("offsetIndex" in chunk) {
          indexes.push(chunk.offsetIndex);
        } else {
          const { range } = chunk;
          if (columns) {
            fetches.push(range);
          } else if (run && range.endByte - run.startByte <= runLimit) {
            run.endByte = range.endByte;
          } else {
            if (run) fetches.push(run);
            run = { ...range };
          }
        }
      }
      if (run) fetches.push(run);
    }
    groupStart = groupEnd;
    rgIdx++;
  }
  if (!isFinite(rowEnd)) rowEnd = groupStart;
  fetches.push(...indexes);
  return { metadata, rowStart, rowEnd, columns, fetches, groups };
}
__name(parquetPlan, "parquetPlan");
async function prefetchBloomFilters({ file, metadata, filter, filterStrict = true }) {
  const result = metadata.row_groups.map(() => (
    /** @type {Record<string, BloomFilter>} */
    {}
  ));
  const eligibleCols = bloomEligibleColumns(filter);
  if (eligibleCols.size === 0) return result;
  const physicalColumns = getPhysicalColumns(parquetSchema(metadata));
  const tasks = [];
  metadata.row_groups.forEach((rowGroup, rgIdx) => {
    if (canSkipRowGroup({ rowGroup, physicalColumns, filter, strict: filterStrict })) return;
    for (const colName of eligibleCols) {
      const columnIdx = physicalColumns.indexOf(colName);
      if (columnIdx === -1) continue;
      const meta = rowGroup.columns[columnIdx]?.meta_data;
      if (!meta?.bloom_filter_offset || !meta.bloom_filter_length) continue;
      const start = Number(meta.bloom_filter_offset);
      const end = start + meta.bloom_filter_length;
      tasks.push((async () => {
        const buffer = await file.slice(start, end);
        const bloom = readBloomFilter({ view: new DataView(buffer), offset: 0 });
        if (bloom) result[rgIdx][colName] = bloom;
      })());
    }
  });
  if (tasks.length) await Promise.all(tasks);
  return result;
}
__name(prefetchBloomFilters, "prefetchBloomFilters");
function prefetchAsyncBuffer(file, { fetches }) {
  const promises = fetches.map(({ startByte, endByte }) => file.slice(startByte, endByte));
  return {
    byteLength: file.byteLength,
    slice(start, end = file.byteLength) {
      const index = fetches.findIndex(({ startByte, endByte }) => startByte <= start && end <= endByte);
      if (index < 0) {
        return file.slice(start, end);
      }
      if (fetches[index].startByte !== start || fetches[index].endByte !== end) {
        const startOffset = start - fetches[index].startByte;
        const endOffset = end - fetches[index].startByte;
        if (promises[index] instanceof Promise) {
          return promises[index].then((buffer) => buffer.slice(startOffset, endOffset));
        } else {
          return promises[index].slice(startOffset, endOffset);
        }
      } else {
        return promises[index];
      }
    }
  };
}
__name(prefetchAsyncBuffer, "prefetchAsyncBuffer");

// node_modules/hyparquet/src/variant.js
var decoder3 = new TextDecoder();
var metadataCache = /* @__PURE__ */ new WeakMap();
function decodeVariantColumn(value, parsers = DEFAULT_PARSERS) {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeVariantColumn(entry, parsers));
  }
  if (typeof value !== "object") return value;
  if ("metadata" in value) {
    const metadata = parseVariantMetadata(value.metadata);
    const shreddedFields = value.typed_value && decodeTypedValue(value.typed_value, metadata, parsers);
    const binaryValue = value.value && readVariant(makeReader(value.value), metadata, parsers);
    if (shreddedFields && binaryValue) {
      return { ...binaryValue, ...shreddedFields };
    }
    return shreddedFields ?? binaryValue;
  }
  return value;
}
__name(decodeVariantColumn, "decodeVariantColumn");
function decodeTypedValue(typedValue, metadata, parsers) {
  if (typedValue instanceof Date) return typedValue;
  if (typedValue && typeof typedValue === "object" && !Array.isArray(typedValue) && !(typedValue instanceof Uint8Array)) {
    if ("typed_value" in typedValue && typedValue.typed_value !== null && typedValue.typed_value !== void 0) {
      return decodeTypedValue(typedValue.typed_value, metadata, parsers);
    }
    if ("value" in typedValue && typedValue.value instanceof Uint8Array) {
      return readVariant(makeReader(typedValue.value), metadata, parsers);
    }
    if ("typed_value" in typedValue || "value" in typedValue) {
      return null;
    }
    const result = {};
    for (const [key, field] of Object.entries(typedValue)) {
      if (!metadata.dictionary.includes(key)) continue;
      result[key] = decodeTypedValue(field, metadata, parsers);
    }
    return result;
  }
  if (typedValue instanceof Uint8Array) {
    return readVariant(makeReader(typedValue), metadata, parsers);
  }
  if (Array.isArray(typedValue)) {
    return typedValue.map((element) => decodeTypedValue(element, metadata, parsers));
  }
  return typedValue;
}
__name(decodeTypedValue, "decodeTypedValue");
function makeReader(bytes) {
  return { view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), offset: 0 };
}
__name(makeReader, "makeReader");
function parseVariantMetadata(bytes) {
  let bufferCache = metadataCache.get(bytes.buffer);
  if (!bufferCache) {
    bufferCache = /* @__PURE__ */ new Map();
    metadataCache.set(bytes.buffer, bufferCache);
  }
  const key = `${bytes.byteOffset}:${bytes.byteLength}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;
  const reader = makeReader(bytes);
  const header = reader.view.getUint8(reader.offset++);
  const version = header & 15;
  if (version !== 1) throw new Error(`parquet unsupported variant metadata version: ${version}`);
  const sorted = (header >> 4 & 1) === 1;
  const offsetSize = (header >> 6 & 3) + 1;
  const dictionarySize = readUnsigned(reader, offsetSize);
  const offsets = new Array(dictionarySize + 1);
  for (let i = 0; i < offsets.length; i++) {
    offsets[i] = readUnsigned(reader, offsetSize);
  }
  const base = reader.offset;
  const dictionary = new Array(dictionarySize);
  for (let i = 0; i < dictionarySize; i++) {
    const start = offsets[i];
    const end = offsets[i + 1];
    const strBytes = new Uint8Array(bytes.buffer, bytes.byteOffset + base + start, end - start);
    dictionary[i] = decoder3.decode(strBytes);
  }
  const metadata = { dictionary, sorted };
  bufferCache.set(key, metadata);
  return metadata;
}
__name(parseVariantMetadata, "parseVariantMetadata");
function readUnsigned(reader, byteWidth2) {
  let value = 0;
  for (let i = 0; i < byteWidth2; i++) {
    value |= reader.view.getUint8(reader.offset + i) << i * 8;
  }
  reader.offset += byteWidth2;
  return value;
}
__name(readUnsigned, "readUnsigned");
function readVariant(reader, metadata, parsers) {
  const typeByte = reader.view.getUint8(reader.offset++);
  const basicType = typeByte & 3;
  const header = typeByte >> 2;
  if (basicType === 0) return readVariantPrimitive(reader, header, parsers);
  if (basicType === 2) return readVariantObject(reader, header, metadata, parsers);
  if (basicType === 3) return readVariantArray(reader, header, metadata, parsers);
  const bytes = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, header);
  reader.offset += header;
  return decoder3.decode(bytes);
}
__name(readVariant, "readVariant");
function readVariantPrimitive(reader, typeId, parsers) {
  switch (typeId) {
    case 0:
      return null;
    case 1:
      return true;
    case 2:
      return false;
    case 3: {
      const value = reader.view.getInt8(reader.offset);
      reader.offset += 1;
      return value;
    }
    case 4: {
      const value = reader.view.getInt16(reader.offset, true);
      reader.offset += 2;
      return value;
    }
    case 5: {
      const value = reader.view.getInt32(reader.offset, true);
      reader.offset += 4;
      return value;
    }
    case 6: {
      const value = reader.view.getBigInt64(reader.offset, true);
      reader.offset += 8;
      return value;
    }
    case 7: {
      const value = reader.view.getFloat64(reader.offset, true);
      reader.offset += 8;
      return value;
    }
    case 8:
      return readVariantDecimal(reader, 4);
    case 9:
      return readVariantDecimal(reader, 8);
    case 10:
      return readVariantDecimal(reader, 16);
    case 11: {
      const value = reader.view.getInt32(reader.offset, true);
      reader.offset += 4;
      return parsers.dateFromDays(value);
    }
    case 12:
    // timestamp_micros (utc)
    case 13: {
      const value = reader.view.getBigInt64(reader.offset, true);
      reader.offset += 8;
      return parsers.timestampFromMicroseconds(value);
    }
    case 14: {
      const value = reader.view.getFloat32(reader.offset, true);
      reader.offset += 4;
      return value;
    }
    case 15:
      return readVariantBinary(reader);
    case 16: {
      const bytes = readVariantBinary(reader);
      return decoder3.decode(bytes);
    }
    case 17: {
      const value = reader.view.getBigInt64(reader.offset, true);
      reader.offset += 8;
      return value;
    }
    case 18:
    // timestamp_nanos (utc)
    case 19: {
      const value = reader.view.getBigInt64(reader.offset, true);
      reader.offset += 8;
      return parsers.timestampFromNanoseconds(value);
    }
    case 20: {
      const bytes = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, 16);
      reader.offset += 16;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    default:
      throw new Error(`parquet unsupported variant primitive type: ${typeId}`);
  }
}
__name(readVariantPrimitive, "readVariantPrimitive");
function readVariantObject(reader, header, metadata, parsers) {
  const offsetWidth = (header & 3) + 1;
  const idWidth = (header >> 2 & 3) + 1;
  const isLarge = header >> 4 & 1;
  const numElements = isLarge ? readUnsigned(reader, 4) : reader.view.getUint8(reader.offset++);
  const fieldIds = new Array(numElements);
  for (let i = 0; i < numElements; i++) {
    fieldIds[i] = readUnsigned(reader, idWidth);
  }
  const offsets = new Array(numElements + 1);
  for (let i = 0; i < offsets.length; i++) {
    offsets[i] = readUnsigned(reader, offsetWidth);
  }
  const out = {};
  for (let i = 0; i < numElements; i++) {
    const key = metadata.dictionary[fieldIds[i]];
    const valueReader = {
      view: reader.view,
      offset: reader.offset + offsets[i]
    };
    out[key] = readVariant(valueReader, metadata, parsers);
  }
  reader.offset += offsets[offsets.length - 1];
  return out;
}
__name(readVariantObject, "readVariantObject");
function readVariantArray(reader, header, metadata, parsers) {
  const fieldOffsetSize = header & 3;
  const isLarge = header >> 2 & 1;
  const offsetWidth = fieldOffsetSize + 1;
  const numElements = readUnsigned(reader, isLarge ? 4 : 1);
  const offsets = new Array(numElements + 1);
  for (let i = 0; i < offsets.length; i++) {
    offsets[i] = readUnsigned(reader, offsetWidth);
  }
  const valuesStart = reader.offset;
  const result = new Array(numElements);
  for (let i = 0; i < numElements; i++) {
    const valueReader = {
      view: reader.view,
      offset: valuesStart + offsets[i]
    };
    result[i] = readVariant(valueReader, metadata, parsers);
  }
  reader.offset = valuesStart + offsets[offsets.length - 1];
  return result;
}
__name(readVariantArray, "readVariantArray");
function readVariantDecimal(reader, width) {
  const scale = reader.view.getUint8(reader.offset);
  reader.offset += 1;
  let unscaled;
  if (width === 4) {
    unscaled = BigInt(reader.view.getInt32(reader.offset, true));
    reader.offset += 4;
  } else if (width === 8) {
    unscaled = reader.view.getBigInt64(reader.offset, true);
    reader.offset += 8;
  } else {
    const low = reader.view.getBigUint64(reader.offset, true);
    const high = reader.view.getBigInt64(reader.offset + 8, true);
    unscaled = high << 64n | low;
    reader.offset += 16;
  }
  return Number(unscaled) * 10 ** -scale;
}
__name(readVariantDecimal, "readVariantDecimal");
function readVariantBinary(reader) {
  const length = reader.view.getUint32(reader.offset, true);
  reader.offset += 4;
  const bytes = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, length);
  reader.offset += length;
  return bytes;
}
__name(readVariantBinary, "readVariantBinary");

// node_modules/hyparquet/src/assemble.js
function assembleLists(output, definitionLevels, repetitionLevels, values, schemaPath) {
  const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
  if (!definitionLevels?.length && !repetitionLevels.length) {
    if (!maxDefinitionLevel || !values.length) return values;
    definitionLevels = new Array(values.length).fill(maxDefinitionLevel);
  }
  const n = definitionLevels?.length || repetitionLevels.length;
  const repetitionPath = schemaPath.map(({ element }) => element.repetition_type);
  let valueIndex = 0;
  const containerStack = [output];
  let currentContainer = output;
  let currentDepth = 0;
  let currentDefLevel = 0;
  let currentRepLevel = 0;
  if (repetitionLevels[0]) {
    while (currentDepth < repetitionPath.length - 2 && currentRepLevel < repetitionLevels[0]) {
      currentDepth++;
      if (repetitionPath[currentDepth] !== "REQUIRED") {
        currentContainer = currentContainer.at(-1);
        containerStack.push(currentContainer);
        currentDefLevel++;
      }
      if (repetitionPath[currentDepth] === "REPEATED") currentRepLevel++;
    }
  }
  for (let i = 0; i < n; i++) {
    const def = definitionLevels?.length ? definitionLevels[i] : maxDefinitionLevel;
    const rep = repetitionLevels[i];
    while (currentDepth && (rep < currentRepLevel || repetitionPath[currentDepth] !== "REPEATED")) {
      if (repetitionPath[currentDepth] !== "REQUIRED") {
        containerStack.pop();
        currentDefLevel--;
      }
      if (repetitionPath[currentDepth] === "REPEATED") currentRepLevel--;
      currentDepth--;
    }
    currentContainer = containerStack.at(-1);
    while ((currentDepth < repetitionPath.length - 2 || repetitionPath[currentDepth + 1] === "REPEATED") && (currentDefLevel < def || repetitionPath[currentDepth + 1] === "REQUIRED")) {
      currentDepth++;
      if (repetitionPath[currentDepth] !== "REQUIRED") {
        const newList = [];
        currentContainer.push(newList);
        currentContainer = newList;
        containerStack.push(newList);
        currentDefLevel++;
      }
      if (repetitionPath[currentDepth] === "REPEATED") currentRepLevel++;
    }
    if (def === maxDefinitionLevel) {
      currentContainer.push(values[valueIndex++]);
    } else if (currentDepth === repetitionPath.length - 2) {
      currentContainer.push(null);
    } else {
      currentContainer.push([]);
    }
  }
  if (!output.length) {
    for (let i = 0; i < maxDefinitionLevel; i++) {
      const newList = [];
      currentContainer.push(newList);
      currentContainer = newList;
    }
  }
  return output;
}
__name(assembleLists, "assembleLists");
function assembleNested(subcolumnData, schema, parsers, depth = 0) {
  const path = schema.path.join(".");
  const optional = schema.element.repetition_type === "OPTIONAL";
  const nextDepth = optional ? depth + 1 : depth;
  if (isListLike(schema)) {
    let sublist = schema.children[0];
    let subDepth = nextDepth;
    if (sublist.children.length === 1) {
      sublist = sublist.children[0];
      subDepth++;
    }
    assembleNested(subcolumnData, sublist, parsers, subDepth);
    const subcolumn = sublist.path.join(".");
    const values = subcolumnData.get(subcolumn);
    if (!values) throw new Error("parquet list column missing values");
    if (optional) flattenAtDepth(values, depth);
    subcolumnData.set(path, values);
    subcolumnData.delete(subcolumn);
    return;
  }
  if (isMapLike(schema)) {
    const mapName = schema.children[0].element.name;
    assembleNested(subcolumnData, schema.children[0].children[0], parsers, nextDepth + 1);
    assembleNested(subcolumnData, schema.children[0].children[1], parsers, nextDepth + 1);
    const keys = subcolumnData.get(`${path}.${mapName}.key`);
    const values = subcolumnData.get(`${path}.${mapName}.value`);
    if (!keys) throw new Error("parquet map column missing keys");
    if (!values) throw new Error("parquet map column missing values");
    if (keys.length !== values.length) {
      throw new Error("parquet map column key/value length mismatch");
    }
    const out = assembleMaps(keys, values, nextDepth);
    if (optional) flattenAtDepth(out, depth);
    subcolumnData.delete(`${path}.${mapName}.key`);
    subcolumnData.delete(`${path}.${mapName}.value`);
    subcolumnData.set(path, out);
    return;
  }
  if (schema.children.length) {
    const invertDepth = schema.element.repetition_type === "REQUIRED" ? depth : depth + 1;
    const struct = {};
    for (const child of schema.children) {
      assembleNested(subcolumnData, child, parsers, invertDepth);
      const childData = subcolumnData.get(child.path.join("."));
      if (!childData) throw new Error("parquet struct missing child data");
      struct[child.element.name] = childData;
    }
    for (const child of schema.children) {
      subcolumnData.delete(child.path.join("."));
    }
    let inverted = invertStruct(struct, invertDepth);
    if (schema.element.logical_type?.type === "VARIANT") {
      inverted = decodeVariantColumn(inverted, parsers);
    }
    if (optional) flattenAtDepth(inverted, depth);
    subcolumnData.set(path, inverted);
  }
}
__name(assembleNested, "assembleNested");
function flattenAtDepth(arr, depth) {
  for (let i = 0; i < arr.length; i++) {
    if (depth) {
      flattenAtDepth(arr[i], depth - 1);
    } else {
      arr[i] = arr[i][0];
    }
  }
}
__name(flattenAtDepth, "flattenAtDepth");
function assembleMaps(keys, values, depth) {
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    if (depth) {
      out.push(assembleMaps(keys[i], values[i], depth - 1));
    } else {
      if (keys[i]) {
        const obj = {};
        for (let j = 0; j < keys[i].length; j++) {
          const value = values[i][j];
          obj[keys[i][j]] = value === void 0 ? null : value;
        }
        out.push(obj);
      } else {
        out.push(void 0);
      }
    }
  }
  return out;
}
__name(assembleMaps, "assembleMaps");
function invertStruct(struct, depth) {
  const keys = Object.keys(struct);
  const length = struct[keys[0]]?.length;
  const out = [];
  for (let i = 0; i < length; i++) {
    const obj = {};
    for (const key of keys) {
      if (struct[key].length !== length) throw new Error("parquet struct parsing error");
      obj[key] = struct[key][i];
    }
    if (depth) {
      out.push(invertStruct(obj, depth - 1));
    } else {
      out.push(obj);
    }
  }
  return out;
}
__name(invertStruct, "invertStruct");

// node_modules/hyparquet/src/delta.js
function deltaBinaryUnpack(reader, count, output) {
  const int32 = output instanceof Int32Array;
  const blockSize = readVarInt(reader);
  const miniblockPerBlock = readVarInt(reader);
  readVarInt(reader);
  let value = readZigZagBigInt(reader);
  let outputIndex = 0;
  output[outputIndex++] = int32 ? Number(value) : value;
  const valuesPerMiniblock = blockSize / miniblockPerBlock;
  while (outputIndex < count) {
    const minDelta = readZigZagBigInt(reader);
    const bitWidths = new Uint8Array(miniblockPerBlock);
    for (let i = 0; i < miniblockPerBlock; i++) {
      bitWidths[i] = reader.view.getUint8(reader.offset++);
    }
    for (let i = 0; i < miniblockPerBlock && outputIndex < count; i++) {
      const bitWidth2 = BigInt(bitWidths[i]);
      if (bitWidth2) {
        let bitpackPos = 0n;
        let miniblockCount = valuesPerMiniblock;
        const mask = (1n << bitWidth2) - 1n;
        while (miniblockCount && outputIndex < count) {
          let bits = BigInt(reader.view.getUint8(reader.offset)) >> bitpackPos & mask;
          bitpackPos += bitWidth2;
          while (bitpackPos >= 8) {
            bitpackPos -= 8n;
            reader.offset++;
            if (bitpackPos) {
              bits |= BigInt(reader.view.getUint8(reader.offset)) << bitWidth2 - bitpackPos & mask;
            }
          }
          const delta = minDelta + bits;
          value += delta;
          output[outputIndex++] = int32 ? Number(value) : value;
          miniblockCount--;
        }
        if (miniblockCount) {
          reader.offset += Math.ceil((miniblockCount * Number(bitWidth2) + Number(bitpackPos)) / 8);
        }
      } else {
        for (let j = 0; j < valuesPerMiniblock && outputIndex < count; j++) {
          value += minDelta;
          output[outputIndex++] = int32 ? Number(value) : value;
        }
      }
    }
  }
}
__name(deltaBinaryUnpack, "deltaBinaryUnpack");
function deltaLengthByteArray(reader, count, output) {
  const lengths = new Int32Array(count);
  deltaBinaryUnpack(reader, count, lengths);
  for (let i = 0; i < count; i++) {
    output[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, lengths[i]);
    reader.offset += lengths[i];
  }
}
__name(deltaLengthByteArray, "deltaLengthByteArray");
function deltaByteArray(reader, count, output) {
  const prefixData = new Int32Array(count);
  deltaBinaryUnpack(reader, count, prefixData);
  const suffixData = new Int32Array(count);
  deltaBinaryUnpack(reader, count, suffixData);
  for (let i = 0; i < count; i++) {
    const suffix = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, suffixData[i]);
    if (prefixData[i]) {
      output[i] = new Uint8Array(prefixData[i] + suffixData[i]);
      output[i].set(output[i - 1].subarray(0, prefixData[i]));
      output[i].set(suffix, prefixData[i]);
    } else {
      output[i] = suffix;
    }
    reader.offset += suffixData[i];
  }
}
__name(deltaByteArray, "deltaByteArray");

// node_modules/hyparquet/src/encoding.js
function readRleBitPackedHybrid(reader, width, output, length) {
  if (length === void 0) {
    length = reader.view.getUint32(reader.offset, true);
    reader.offset += 4;
  }
  const startOffset = reader.offset;
  let seen = 0;
  while (seen < output.length) {
    const header = readVarInt(reader);
    if (header & 1) {
      seen = readBitPacked(reader, header, width, output, seen);
    } else {
      const count = header >>> 1;
      readRle(reader, count, width, output, seen);
      seen += count;
    }
  }
  reader.offset = startOffset + length;
}
__name(readRleBitPackedHybrid, "readRleBitPackedHybrid");
function readRle(reader, count, bitWidth2, output, seen) {
  const width = bitWidth2 + 7 >> 3;
  let value = 0;
  for (let i = 0; i < width; i++) {
    value |= reader.view.getUint8(reader.offset++) << (i << 3);
  }
  for (let i = 0; i < count; i++) {
    output[seen + i] = value;
  }
}
__name(readRle, "readRle");
function readBitPacked(reader, header, bitWidth2, output, seen) {
  let count = header >> 1 << 3;
  const mask = (1 << bitWidth2) - 1;
  let data = 0;
  if (reader.offset < reader.view.byteLength) {
    data = reader.view.getUint8(reader.offset++);
  } else if (mask) {
    throw new Error(`parquet bitpack offset ${reader.offset} out of range`);
  }
  let left = 8;
  let right = 0;
  while (count) {
    if (right > 8) {
      right -= 8;
      left -= 8;
      data >>>= 8;
    } else if (left - right < bitWidth2) {
      data |= reader.view.getUint8(reader.offset) << left;
      reader.offset++;
      left += 8;
    } else {
      if (seen < output.length) {
        output[seen++] = data >> right & mask;
      }
      count--;
      right += bitWidth2;
    }
  }
  return seen;
}
__name(readBitPacked, "readBitPacked");
function byteStreamSplit(reader, count, type, typeLength) {
  const width = byteWidth(type, typeLength);
  const bytes = new Uint8Array(count * width);
  for (let b = 0; b < width; b++) {
    for (let i = 0; i < count; i++) {
      bytes[i * width + b] = reader.view.getUint8(reader.offset++);
    }
  }
  if (type === "FLOAT") return new Float32Array(bytes.buffer);
  else if (type === "DOUBLE") return new Float64Array(bytes.buffer);
  else if (type === "INT32") return new Int32Array(bytes.buffer);
  else if (type === "INT64") return new BigInt64Array(bytes.buffer);
  else if (type === "FIXED_LEN_BYTE_ARRAY") {
    const split = new Array(count);
    for (let i = 0; i < count; i++) {
      split[i] = bytes.subarray(i * width, (i + 1) * width);
    }
    return split;
  }
  throw new Error(`parquet byte_stream_split unsupported type: ${type}`);
}
__name(byteStreamSplit, "byteStreamSplit");
function byteWidth(type, typeLength) {
  switch (type) {
    case "INT32":
    case "FLOAT":
      return 4;
    case "INT64":
    case "DOUBLE":
      return 8;
    case "FIXED_LEN_BYTE_ARRAY":
      if (!typeLength) throw new Error("parquet byteWidth missing type_length");
      return typeLength;
    default:
      throw new Error(`parquet unsupported type: ${type}`);
  }
}
__name(byteWidth, "byteWidth");

// node_modules/hyparquet/src/plain.js
function readPlain(reader, type, count, fixedLength) {
  if (count === 0) return [];
  if (type === "BOOLEAN") {
    return readPlainBoolean(reader, count);
  } else if (type === "INT32") {
    return readPlainInt32(reader, count);
  } else if (type === "INT64") {
    return readPlainInt64(reader, count);
  } else if (type === "INT96") {
    return readPlainInt96(reader, count);
  } else if (type === "FLOAT") {
    return readPlainFloat(reader, count);
  } else if (type === "DOUBLE") {
    return readPlainDouble(reader, count);
  } else if (type === "BYTE_ARRAY") {
    return readPlainByteArray(reader, count);
  } else if (type === "FIXED_LEN_BYTE_ARRAY") {
    if (!fixedLength) throw new Error("parquet missing fixed length");
    return readPlainByteArrayFixed(reader, count, fixedLength);
  } else {
    throw new Error(`parquet unhandled type: ${type}`);
  }
}
__name(readPlain, "readPlain");
function readPlainBoolean(reader, count) {
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    const byteOffset = reader.offset + (i / 8 | 0);
    const bitOffset = i % 8;
    const byte = reader.view.getUint8(byteOffset);
    values[i] = (byte & 1 << bitOffset) !== 0;
  }
  reader.offset += Math.ceil(count / 8);
  return values;
}
__name(readPlainBoolean, "readPlainBoolean");
function readPlainInt32(reader, count) {
  const values = (reader.view.byteOffset + reader.offset) % 4 ? new Int32Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 4)) : new Int32Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
  reader.offset += count * 4;
  return values;
}
__name(readPlainInt32, "readPlainInt32");
function readPlainInt64(reader, count) {
  const values = (reader.view.byteOffset + reader.offset) % 8 ? new BigInt64Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 8)) : new BigInt64Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
  reader.offset += count * 8;
  return values;
}
__name(readPlainInt64, "readPlainInt64");
function readPlainInt96(reader, count) {
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    const low = reader.view.getBigInt64(reader.offset + i * 12, true);
    const high = reader.view.getInt32(reader.offset + i * 12 + 8, true);
    values[i] = BigInt(high) << 64n | low;
  }
  reader.offset += count * 12;
  return values;
}
__name(readPlainInt96, "readPlainInt96");
function readPlainFloat(reader, count) {
  const values = (reader.view.byteOffset + reader.offset) % 4 ? new Float32Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 4)) : new Float32Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
  reader.offset += count * 4;
  return values;
}
__name(readPlainFloat, "readPlainFloat");
function readPlainDouble(reader, count) {
  const values = (reader.view.byteOffset + reader.offset) % 8 ? new Float64Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 8)) : new Float64Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
  reader.offset += count * 8;
  return values;
}
__name(readPlainDouble, "readPlainDouble");
function readPlainByteArray(reader, count) {
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    const length = reader.view.getUint32(reader.offset, true);
    reader.offset += 4;
    values[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, length);
    reader.offset += length;
  }
  return values;
}
__name(readPlainByteArray, "readPlainByteArray");
function readPlainByteArrayFixed(reader, count, fixedLength) {
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, fixedLength);
    reader.offset += fixedLength;
  }
  return values;
}
__name(readPlainByteArrayFixed, "readPlainByteArrayFixed");
function align(buffer, offset, size) {
  const aligned = new ArrayBuffer(size);
  new Uint8Array(aligned).set(new Uint8Array(buffer, offset, size));
  return aligned;
}
__name(align, "align");

// node_modules/hyparquet/src/snappy.js
var WORD_MASK = [0, 255, 65535, 16777215, 4294967295];
function copyBytes(fromArray, fromPos, toArray, toPos, length) {
  for (let i = 0; i < length; i++) {
    toArray[toPos + i] = fromArray[fromPos + i];
  }
}
__name(copyBytes, "copyBytes");
function snappyUncompress(input, output) {
  const inputLength = input.byteLength;
  const outputLength = output.byteLength;
  let pos = 0;
  let outPos = 0;
  while (pos < inputLength) {
    const c = input[pos];
    pos++;
    if (c < 128) {
      break;
    }
  }
  if (outputLength && pos >= inputLength) {
    throw new Error("invalid snappy length header");
  }
  while (pos < inputLength) {
    const c = input[pos];
    let len = 0;
    pos++;
    if (pos >= inputLength) {
      throw new Error("missing eof marker");
    }
    if ((c & 3) === 0) {
      let len2 = (c >>> 2) + 1;
      if (len2 > 60) {
        if (pos + 3 >= inputLength) {
          throw new Error("snappy error literal pos + 3 >= inputLength");
        }
        const lengthSize = len2 - 60;
        len2 = input[pos] + (input[pos + 1] << 8) + (input[pos + 2] << 16) + (input[pos + 3] << 24);
        len2 = (len2 & WORD_MASK[lengthSize]) + 1;
        pos += lengthSize;
      }
      if (pos + len2 > inputLength) {
        throw new Error("snappy error literal exceeds input length");
      }
      copyBytes(input, pos, output, outPos, len2);
      pos += len2;
      outPos += len2;
    } else {
      let offset = 0;
      switch (c & 3) {
        case 1:
          len = (c >>> 2 & 7) + 4;
          offset = input[pos] + (c >>> 5 << 8);
          pos++;
          break;
        case 2:
          if (inputLength <= pos + 1) {
            throw new Error("snappy error end of input");
          }
          len = (c >>> 2) + 1;
          offset = input[pos] + (input[pos + 1] << 8);
          pos += 2;
          break;
        case 3:
          if (inputLength <= pos + 3) {
            throw new Error("snappy error end of input");
          }
          len = (c >>> 2) + 1;
          offset = input[pos] + (input[pos + 1] << 8) + (input[pos + 2] << 16) + (input[pos + 3] << 24);
          pos += 4;
          break;
        default:
          break;
      }
      if (offset === 0 || isNaN(offset)) {
        throw new Error(`invalid offset ${offset} pos ${pos} inputLength ${inputLength}`);
      }
      if (offset > outPos) {
        throw new Error("cannot copy from before start of buffer");
      }
      copyBytes(output, outPos - offset, output, outPos, len);
      outPos += len;
    }
  }
  if (outPos !== outputLength) throw new Error("premature end of input");
}
__name(snappyUncompress, "snappyUncompress");

// node_modules/hyparquet/src/datapage.js
function readDataPage(bytes, daph, { type, element, schemaPath }) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reader = { view, offset: 0 };
  let dataPage;
  const repetitionLevels = readRepetitionLevels(reader, daph, schemaPath);
  const { definitionLevels, numNulls } = readDefinitionLevels(reader, daph, schemaPath);
  const nValues = daph.num_values - numNulls;
  if (daph.encoding === "PLAIN") {
    dataPage = readPlain(reader, type, nValues, element.type_length);
  } else if (daph.encoding === "PLAIN_DICTIONARY" || daph.encoding === "RLE_DICTIONARY" || daph.encoding === "RLE") {
    const bitWidth2 = type === "BOOLEAN" ? 1 : view.getUint8(reader.offset++);
    if (bitWidth2) {
      dataPage = new Array(nValues);
      if (type === "BOOLEAN") {
        readRleBitPackedHybrid(reader, bitWidth2, dataPage);
        dataPage = dataPage.map((x) => !!x);
      } else {
        readRleBitPackedHybrid(reader, bitWidth2, dataPage, view.byteLength - reader.offset);
      }
    } else {
      dataPage = new Uint8Array(nValues);
    }
  } else if (daph.encoding === "BYTE_STREAM_SPLIT") {
    dataPage = byteStreamSplit(reader, nValues, type, element.type_length);
  } else if (daph.encoding === "DELTA_BINARY_PACKED") {
    const int32 = type === "INT32";
    dataPage = int32 ? new Int32Array(nValues) : new BigInt64Array(nValues);
    deltaBinaryUnpack(reader, nValues, dataPage);
  } else if (daph.encoding === "DELTA_LENGTH_BYTE_ARRAY") {
    dataPage = new Array(nValues);
    deltaLengthByteArray(reader, nValues, dataPage);
  } else {
    throw new Error(`parquet unsupported encoding: ${daph.encoding}`);
  }
  return { definitionLevels, repetitionLevels, dataPage };
}
__name(readDataPage, "readDataPage");
function readRepetitionLevels(reader, daph, schemaPath) {
  if (schemaPath.length > 1) {
    const maxRepetitionLevel = getMaxRepetitionLevel(schemaPath);
    if (maxRepetitionLevel) {
      const values = new Array(daph.num_values);
      readRleBitPackedHybrid(reader, bitWidth(maxRepetitionLevel), values);
      return values;
    }
  }
  return [];
}
__name(readRepetitionLevels, "readRepetitionLevels");
function readDefinitionLevels(reader, daph, schemaPath) {
  const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
  if (!maxDefinitionLevel) return { definitionLevels: [], numNulls: 0 };
  const definitionLevels = new Array(daph.num_values);
  readRleBitPackedHybrid(reader, bitWidth(maxDefinitionLevel), definitionLevels);
  let numNulls = daph.num_values;
  for (const def of definitionLevels) {
    if (def === maxDefinitionLevel) numNulls--;
  }
  if (numNulls === 0) definitionLevels.length = 0;
  return { definitionLevels, numNulls };
}
__name(readDefinitionLevels, "readDefinitionLevels");
function decompressPage(compressedBytes, uncompressed_page_size, codec, compressors) {
  let page;
  const customDecompressor = compressors?.[codec];
  if (codec === "UNCOMPRESSED") {
    page = compressedBytes;
  } else if (customDecompressor) {
    page = customDecompressor(compressedBytes, uncompressed_page_size);
  } else if (codec === "SNAPPY") {
    page = new Uint8Array(uncompressed_page_size);
    snappyUncompress(compressedBytes, page);
  } else {
    throw new Error(`parquet unsupported compression codec: ${codec}`);
  }
  if (page?.length !== uncompressed_page_size) {
    throw new Error(`parquet decompressed page length ${page?.length} does not match header ${uncompressed_page_size}`);
  }
  return page;
}
__name(decompressPage, "decompressPage");
function readDataPageV2(compressedBytes, ph, columnDecoder) {
  const view = new DataView(compressedBytes.buffer, compressedBytes.byteOffset, compressedBytes.byteLength);
  const reader = { view, offset: 0 };
  const { type, element, schemaPath, codec, compressors } = columnDecoder;
  const daph2 = ph.data_page_header_v2;
  if (!daph2) throw new Error("parquet data page header v2 is undefined");
  const repetitionLevels = readRepetitionLevelsV2(reader, daph2, schemaPath);
  reader.offset = daph2.repetition_levels_byte_length;
  const definitionLevels = readDefinitionLevelsV2(reader, daph2, schemaPath);
  const uncompressedPageSize = ph.uncompressed_page_size - daph2.definition_levels_byte_length - daph2.repetition_levels_byte_length;
  let page = compressedBytes.subarray(reader.offset);
  if (daph2.is_compressed !== false) {
    page = decompressPage(page, uncompressedPageSize, codec, compressors);
  }
  const pageView = new DataView(page.buffer, page.byteOffset, page.byteLength);
  const pageReader = { view: pageView, offset: 0 };
  let dataPage;
  const nValues = daph2.num_values - daph2.num_nulls;
  if (daph2.encoding === "PLAIN") {
    dataPage = readPlain(pageReader, type, nValues, element.type_length);
  } else if (daph2.encoding === "RLE") {
    dataPage = new Array(nValues);
    readRleBitPackedHybrid(pageReader, 1, dataPage);
    dataPage = dataPage.map((x) => !!x);
  } else if (daph2.encoding === "PLAIN_DICTIONARY" || daph2.encoding === "RLE_DICTIONARY") {
    const bitWidth2 = pageView.getUint8(pageReader.offset++);
    dataPage = new Array(nValues);
    readRleBitPackedHybrid(pageReader, bitWidth2, dataPage, uncompressedPageSize - 1);
  } else if (daph2.encoding === "DELTA_BINARY_PACKED") {
    const int32 = type === "INT32";
    dataPage = int32 ? new Int32Array(nValues) : new BigInt64Array(nValues);
    deltaBinaryUnpack(pageReader, nValues, dataPage);
  } else if (daph2.encoding === "DELTA_LENGTH_BYTE_ARRAY") {
    dataPage = new Array(nValues);
    deltaLengthByteArray(pageReader, nValues, dataPage);
  } else if (daph2.encoding === "DELTA_BYTE_ARRAY") {
    dataPage = new Array(nValues);
    deltaByteArray(pageReader, nValues, dataPage);
  } else if (daph2.encoding === "BYTE_STREAM_SPLIT") {
    dataPage = byteStreamSplit(pageReader, nValues, type, element.type_length);
  } else {
    throw new Error(`parquet unsupported encoding: ${daph2.encoding}`);
  }
  return { definitionLevels, repetitionLevels, dataPage };
}
__name(readDataPageV2, "readDataPageV2");
function readRepetitionLevelsV2(reader, daph2, schemaPath) {
  const maxRepetitionLevel = getMaxRepetitionLevel(schemaPath);
  if (!maxRepetitionLevel) return [];
  const values = new Array(daph2.num_values);
  readRleBitPackedHybrid(reader, bitWidth(maxRepetitionLevel), values, daph2.repetition_levels_byte_length);
  return values;
}
__name(readRepetitionLevelsV2, "readRepetitionLevelsV2");
function readDefinitionLevelsV2(reader, daph2, schemaPath) {
  const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
  if (maxDefinitionLevel) {
    const values = new Array(daph2.num_values);
    readRleBitPackedHybrid(reader, bitWidth(maxDefinitionLevel), values, daph2.definition_levels_byte_length);
    return values;
  }
}
__name(readDefinitionLevelsV2, "readDefinitionLevelsV2");
function bitWidth(value) {
  return 32 - Math.clz32(value);
}
__name(bitWidth, "bitWidth");

// node_modules/hyparquet/src/column.js
function readColumn(reader, { groupStart, selectStart, selectEnd }, columnDecoder, onPage) {
  const { pathInSchema, schemaPath } = columnDecoder;
  const isFlat = isFlatColumn(schemaPath);
  const chunks = [];
  let dictionary = void 0;
  let lastChunk = void 0;
  let rowCount = 0;
  let skipped = 0;
  const emitLastChunk = onPage && (() => {
    lastChunk && onPage({
      pathInSchema,
      columnData: lastChunk,
      rowStart: groupStart + rowCount - lastChunk.length,
      rowEnd: groupStart + rowCount
    });
  });
  while (isFlat ? rowCount < selectEnd : reader.offset < reader.view.byteLength - 1) {
    if (reader.offset >= reader.view.byteLength - 1) break;
    const header = parquetHeader(reader);
    if (header.type === "DICTIONARY_PAGE") {
      const { data } = readPage(reader, header, columnDecoder, dictionary, void 0, 0);
      if (data) dictionary = convert(data, columnDecoder);
    } else {
      const lastChunkLength = lastChunk?.length || 0;
      const result = readPage(reader, header, columnDecoder, dictionary, lastChunk, selectStart - rowCount);
      if (result.skipped) {
        if (!chunks.length) {
          skipped += result.skipped;
        }
        rowCount += result.skipped;
      } else if (result.data && lastChunk === result.data) {
        rowCount += result.data.length - lastChunkLength;
      } else if (result.data && result.data.length) {
        emitLastChunk?.();
        chunks.push(result.data);
        rowCount += result.data.length;
        lastChunk = result.data;
      }
    }
  }
  emitLastChunk?.();
  return { data: chunks, skipped };
}
__name(readColumn, "readColumn");
function readPage(reader, header, columnDecoder, dictionary, previousChunk, pageStart) {
  const { type, element, schemaPath, codec, compressors } = columnDecoder;
  const compressedBytes = new Uint8Array(
    reader.view.buffer,
    reader.view.byteOffset + reader.offset,
    header.compressed_page_size
  );
  reader.offset += header.compressed_page_size;
  if (header.type === "DATA_PAGE") {
    const daph = header.data_page_header;
    if (!daph) throw new Error("parquet data page header is undefined");
    if (pageStart > daph.num_values && isFlatColumn(schemaPath)) {
      return { skipped: daph.num_values };
    }
    const page = decompressPage(compressedBytes, Number(header.uncompressed_page_size), codec, compressors);
    const { definitionLevels, repetitionLevels, dataPage } = readDataPage(page, daph, columnDecoder);
    const values = convertWithDictionary(dataPage, dictionary, daph.encoding, columnDecoder);
    const output = Array.isArray(previousChunk) ? previousChunk : [];
    const assembled = assembleLists(output, definitionLevels, repetitionLevels, values, schemaPath);
    return { skipped: 0, data: assembled };
  } else if (header.type === "DATA_PAGE_V2") {
    const daph2 = header.data_page_header_v2;
    if (!daph2) throw new Error("parquet data page header v2 is undefined");
    if (pageStart > daph2.num_rows) {
      return { skipped: daph2.num_values };
    }
    const { definitionLevels, repetitionLevels, dataPage } = readDataPageV2(compressedBytes, header, columnDecoder);
    const values = convertWithDictionary(dataPage, dictionary, daph2.encoding, columnDecoder);
    const output = Array.isArray(previousChunk) ? previousChunk : [];
    const assembled = assembleLists(output, definitionLevels, repetitionLevels, values, schemaPath);
    return { skipped: 0, data: assembled };
  } else if (header.type === "DICTIONARY_PAGE") {
    const diph = header.dictionary_page_header;
    if (!diph) throw new Error("parquet dictionary page header is undefined");
    const page = decompressPage(
      compressedBytes,
      Number(header.uncompressed_page_size),
      codec,
      compressors
    );
    const reader2 = { view: new DataView(page.buffer, page.byteOffset, page.byteLength), offset: 0 };
    const dictArray = readPlain(reader2, type, diph.num_values, element.type_length);
    return { skipped: 0, data: dictArray };
  } else {
    throw new Error(`parquet unsupported page type: ${header.type}`);
  }
}
__name(readPage, "readPage");
function parquetHeader(reader) {
  const header = deserializeTCompactProtocol(reader);
  const type = PageTypes[header.field_1];
  const uncompressed_page_size = header.field_2;
  const compressed_page_size = header.field_3;
  const crc = header.field_4;
  const data_page_header = header.field_5 && {
    num_values: header.field_5.field_1,
    encoding: Encodings[header.field_5.field_2],
    definition_level_encoding: Encodings[header.field_5.field_3],
    repetition_level_encoding: Encodings[header.field_5.field_4],
    statistics: header.field_5.field_5 && {
      max: header.field_5.field_5.field_1,
      min: header.field_5.field_5.field_2,
      null_count: header.field_5.field_5.field_3,
      distinct_count: header.field_5.field_5.field_4,
      max_value: header.field_5.field_5.field_5,
      min_value: header.field_5.field_5.field_6
    }
  };
  const index_page_header = header.field_6;
  const dictionary_page_header = header.field_7 && {
    num_values: header.field_7.field_1,
    encoding: Encodings[header.field_7.field_2],
    is_sorted: header.field_7.field_3
  };
  const data_page_header_v2 = header.field_8 && {
    num_values: header.field_8.field_1,
    num_nulls: header.field_8.field_2,
    num_rows: header.field_8.field_3,
    encoding: Encodings[header.field_8.field_4],
    definition_levels_byte_length: header.field_8.field_5,
    repetition_levels_byte_length: header.field_8.field_6,
    is_compressed: header.field_8.field_7 === void 0 ? true : header.field_8.field_7,
    // default true
    statistics: header.field_8.field_8
  };
  return {
    type,
    uncompressed_page_size,
    compressed_page_size,
    crc,
    data_page_header,
    index_page_header,
    dictionary_page_header,
    data_page_header_v2
  };
}
__name(parquetHeader, "parquetHeader");

// node_modules/hyparquet/src/rowgroup.js
function readRowGroup(options, { metadata }, groupPlan) {
  const asyncColumns = [];
  for (const chunk of groupPlan.chunks) {
    const { data_page_offset, dictionary_page_offset, path_in_schema: pathInSchema } = chunk.columnMetadata;
    const schemaPath = getSchemaPath(metadata.schema, pathInSchema);
    const columnDecoder = {
      pathInSchema,
      element: schemaPath[schemaPath.length - 1].element,
      schemaPath,
      parsers: { ...DEFAULT_PARSERS, ...options.parsers },
      ...options,
      ...chunk.columnMetadata
    };
    let { startByte, endByte } = chunk.range;
    if (!("offsetIndex" in chunk)) {
      asyncColumns.push({
        pathInSchema,
        data: Promise.resolve(options.file.slice(startByte, endByte)).then((buffer) => {
          const reader = { view: new DataView(buffer), offset: 0 };
          return readColumn(reader, groupPlan, columnDecoder, options.onPage);
        })
      });
      continue;
    }
    asyncColumns.push({
      pathInSchema,
      // fetch offset index
      data: Promise.resolve(options.file.slice(chunk.offsetIndex.startByte, chunk.offsetIndex.endByte)).then(async (arrayBuffer) => {
        const { selectStart, selectEnd } = groupPlan;
        const pages = readOffsetIndex({ view: new DataView(arrayBuffer), offset: 0 }).page_locations;
        let skipped = -1;
        const hasDict = dictionary_page_offset || data_page_offset < pages[0].offset;
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const pageStart = Number(page.first_row_index);
          const pageEnd = i + 1 < pages.length ? Number(pages[i + 1].first_row_index) : groupPlan.groupRows;
          if (skipped < 0 && !hasDict && pageEnd > selectStart) {
            startByte = Number(page.offset);
            skipped = pageStart;
          }
          if (pageStart < selectEnd) {
            endByte = Number(page.offset) + page.compressed_page_size;
          }
        }
        if (skipped < 0) skipped = 0;
        const buffer = await options.file.slice(startByte, endByte);
        const reader = { view: new DataView(buffer), offset: 0 };
        const adjustedGroupPlan = skipped ? {
          ...groupPlan,
          groupStart: groupPlan.groupStart + skipped,
          selectStart: groupPlan.selectStart - skipped,
          selectEnd: groupPlan.selectEnd - skipped
        } : groupPlan;
        const { data, skipped: columnSkipped } = readColumn(reader, adjustedGroupPlan, columnDecoder, options.onPage);
        return {
          data,
          skipped: skipped + columnSkipped
        };
      })
    });
  }
  return { groupStart: groupPlan.groupStart, groupRows: groupPlan.groupRows, asyncColumns };
}
__name(readRowGroup, "readRowGroup");
async function asyncGroupToRows({ asyncColumns }, selectStart, selectEnd, columns, rowFormat) {
  const asyncPages = await Promise.all(asyncColumns.map(
    (column) => column.data.then(({ skipped, data }) => ({ skipped, data: flatten(data) }))
  ));
  const selectCount = selectEnd - selectStart;
  if (rowFormat === "object") {
    const groupData2 = Array(selectCount);
    for (let selectRow = 0; selectRow < selectCount; selectRow++) {
      const rowData = {};
      for (let i = 0; i < asyncColumns.length; i++) {
        const { data, skipped } = asyncPages[i];
        rowData[asyncColumns[i].pathInSchema[0]] = data[selectStart + selectRow - skipped];
      }
      groupData2[selectRow] = rowData;
    }
    return groupData2;
  }
  const includedColumnNames = asyncColumns.map((child) => child.pathInSchema[0]).filter((name) => !columns || columns.includes(name));
  const columnOrder = columns ?? includedColumnNames;
  const columnIndexes = columnOrder.map((name) => asyncColumns.findIndex((column) => column.pathInSchema[0] === name));
  const groupData = Array(selectCount);
  for (let selectRow = 0; selectRow < selectCount; selectRow++) {
    const rowData = Array(asyncColumns.length);
    for (let i = 0; i < columnOrder.length; i++) {
      const colIdx = columnIndexes[i];
      if (colIdx < 0) throw new Error(`parquet column not found: ${columnOrder[i]}`);
      const { data, skipped } = asyncPages[colIdx];
      rowData[i] = data[selectStart + selectRow - skipped];
    }
    groupData[selectRow] = rowData;
  }
  return groupData;
}
__name(asyncGroupToRows, "asyncGroupToRows");
function assembleAsync(asyncRowGroup, schemaTree2, parsers) {
  const { asyncColumns } = asyncRowGroup;
  parsers = { ...DEFAULT_PARSERS, ...parsers };
  const assembled = [];
  for (const child of schemaTree2.children) {
    if (child.children.length) {
      const childColumns = asyncColumns.filter((column) => column.pathInSchema[0] === child.element.name);
      if (!childColumns.length) continue;
      assembled.push({
        pathInSchema: child.path,
        data: (async () => {
          const resolved = await Promise.all(childColumns.map((c) => c.data));
          const subcolumnData = /* @__PURE__ */ new Map();
          let minLength = Infinity;
          for (let i = 0; i < childColumns.length; i++) {
            const flat = flatten(resolved[i].data);
            subcolumnData.set(childColumns[i].pathInSchema.join("."), flat);
            minLength = Math.min(minLength, flat.length);
          }
          for (const [key, value] of subcolumnData) {
            if (value.length > minLength) {
              subcolumnData.set(key, value.slice(0, minLength));
            }
          }
          assembleNested(subcolumnData, child, parsers);
          const assembled2 = subcolumnData.get(child.element.name);
          if (!assembled2) throw new Error("parquet column data not assembled");
          return { data: [assembled2], skipped: 0 };
        })()
      });
    } else {
      const asyncColumn = asyncColumns.find((column) => column.pathInSchema[0] === child.element.name);
      if (asyncColumn) assembled.push(asyncColumn);
    }
  }
  return { ...asyncRowGroup, asyncColumns: assembled };
}
__name(assembleAsync, "assembleAsync");

// node_modules/hyparquet/src/read.js
async function parquetRead(options) {
  options.metadata ??= await parquetMetadataAsync(options.file, options);
  const { rowStart = 0, rowEnd, columns, onChunk, onComplete, rowFormat, filter, filterStrict = true } = options;
  if (filter && rowFormat !== "object") {
    throw new Error('parquet filter requires rowFormat: "object"');
  }
  const filterColumns = columnsNeededForFilter(filter);
  if (filterColumns.length) {
    const schemaColumns = parquetSchema(options.metadata).children.map((c) => c.element.name);
    const missingColumns = filterColumns.filter((c) => !schemaColumns.includes(c));
    if (missingColumns.length) {
      throw new Error(`parquet filter columns not found: ${missingColumns.join(", ")}`);
    }
  }
  let readColumns = columns;
  let requiresProjection = false;
  if (columns && filter) {
    const missingFilterColumns = filterColumns.filter((c) => !columns.includes(c));
    if (missingFilterColumns.length) {
      readColumns = [...columns, ...missingFilterColumns];
      requiresProjection = true;
    }
  }
  let readOptions = readColumns !== columns ? { ...options, columns: readColumns } : options;
  readOptions = await withBloomFilters(readOptions);
  const asyncGroups = parquetReadAsync(readOptions);
  if (!onComplete && !onChunk) {
    await awaitAllColumns(asyncGroups);
    return;
  }
  const schemaTree2 = parquetSchema(options.metadata);
  const assembled = asyncGroups.map((arg) => assembleAsync(arg, schemaTree2, options.parsers));
  if (onChunk) {
    for (const asyncGroup of assembled) {
      for (const asyncColumn of asyncGroup.asyncColumns) {
        asyncColumn.data.then(({ data, skipped }) => {
          let rowStart2 = asyncGroup.groupStart + skipped;
          for (const columnData of data) {
            onChunk({
              columnName: asyncColumn.pathInSchema[0],
              columnData,
              rowStart: rowStart2,
              rowEnd: rowStart2 + columnData.length
            });
            rowStart2 += columnData.length;
          }
        }, () => {
        });
      }
    }
  }
  if (onComplete) {
    await awaitAllColumns(assembled);
    const rows = [];
    for (const asyncGroup of assembled) {
      const selectStart = Math.max(rowStart - asyncGroup.groupStart, 0);
      const selectEnd = Math.min((rowEnd ?? Infinity) - asyncGroup.groupStart, asyncGroup.groupRows);
      const groupData = rowFormat === "object" ? await asyncGroupToRows(asyncGroup, selectStart, selectEnd, readColumns, "object") : await asyncGroupToRows(asyncGroup, selectStart, selectEnd, columns, "array");
      if (filter) {
        for (
          const row of
          /** @type {Record<string, any>[]} */
          groupData
        ) {
          if (matchFilter(row, filter, filterStrict)) {
            if (requiresProjection && columns) {
              for (const col of filterColumns) {
                if (!columns.includes(col)) delete row[col];
              }
            }
            rows.push(row);
          }
        }
      } else {
        concat(rows, groupData);
      }
    }
    onComplete(rows);
  } else {
    await awaitAllColumns(assembled);
  }
}
__name(parquetRead, "parquetRead");
async function awaitAllColumns(asyncGroups) {
  const all = asyncGroups.flatMap((g) => g.asyncColumns.map((c) => c.data));
  const results = await Promise.allSettled(all);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
}
__name(awaitAllColumns, "awaitAllColumns");
function parquetReadAsync(options) {
  if (!options.metadata) throw new Error("parquet requires metadata");
  const plan = parquetPlan(options);
  options.file = prefetchAsyncBuffer(options.file, plan);
  return plan.groups.map((groupPlan) => readRowGroup(options, plan, groupPlan));
}
__name(parquetReadAsync, "parquetReadAsync");
async function withBloomFilters(options) {
  if (!options.useBloomFilters) return options;
  if (!options.filter || !options.metadata) return options;
  const schemaTree2 = parquetSchema(options.metadata);
  const schemaElements = {};
  for (const child of schemaTree2.children) schemaElements[child.element.name] = child.element;
  const bloomFiltersByGroup = await prefetchBloomFilters({
    file: options.file,
    metadata: options.metadata,
    filter: options.filter,
    filterStrict: options.filterStrict
  });
  return (
    /** @type {BaseParquetReadOptions} */
    { ...options, bloomFiltersByGroup, schemaElements }
  );
}
__name(withBloomFilters, "withBloomFilters");
function parquetReadObjects(options) {
  return new Promise((onComplete, reject) => {
    parquetRead({
      ...options,
      rowFormat: "object",
      // force object output
      onComplete
    }).catch(reject);
  });
}
__name(parquetReadObjects, "parquetReadObjects");

// src/params.ts
var AGGREGATIONS = [
  "count",
  "sum",
  "mean",
  "min",
  "max",
  "median"
];
var QueryError = class extends Error {
  static {
    __name(this, "QueryError");
  }
  status;
  details;
  constructor(message, status = 400, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
};
var DEFAULT_LIMIT = 1e3;
var MAX_LIMIT = 1e4;
var COMPARISON_PREFIX = /^(eq|neq|gt|gte|lt|lte)\.([\s\S]*)$/;
function parseInList(inner) {
  const values = [];
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && inner[i] === " ") i++;
    if (inner[i] === '"') {
      let value = "";
      i++;
      while (i < inner.length) {
        if (inner[i] === '"' && inner[i + 1] === '"') {
          value += '"';
          i += 2;
        } else if (inner[i] === '"') {
          i++;
          break;
        } else {
          value += inner[i];
          i++;
        }
      }
      values.push(value);
      while (i < inner.length && inner[i] !== ",") i++;
      i++;
    } else {
      let end = inner.indexOf(",", i);
      if (end === -1) end = inner.length;
      values.push(inner.slice(i, end).trim());
      i = end + 1;
    }
  }
  return values.filter((v) => v.length > 0);
}
__name(parseInList, "parseInList");
function parseFilterParam(column, raw2) {
  if (raw2 === "is.null") {
    return { column, op: "isNull" };
  }
  if (raw2 === "not.null") {
    return { column, op: "notNull" };
  }
  if (raw2.startsWith("in.(") && raw2.endsWith(")")) {
    const values = parseInList(raw2.slice(4, -1));
    if (values.length === 0) {
      throw new QueryError(
        `Empty in.() list for column "${column}". Provide at least one value.`
      );
    }
    return { column, op: "in", values };
  }
  const match2 = COMPARISON_PREFIX.exec(raw2);
  if (match2) {
    return {
      column,
      op: match2[1],
      value: match2[2]
    };
  }
  return { column, op: "eq", value: raw2 };
}
__name(parseFilterParam, "parseFilterParam");
function parseQueryParams(searchParams) {
  const filters = [];
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("q.")) {
      const column2 = key.slice(2);
      if (!column2) {
        throw new QueryError(`Invalid filter parameter "${key}".`);
      }
      filters.push(parseFilterParam(column2, value));
    }
  }
  let format = null;
  const f = searchParams.get("f");
  if (f !== null) {
    if (f !== "json" && f !== "html") {
      throw new QueryError(`Invalid format "${f}". Use f=json or f=html.`);
    }
    format = f;
  }
  const groupBy = (searchParams.get("groupBy") || "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  const ops = [];
  const opParam = searchParams.get("op");
  if (opParam !== null) {
    for (const op of opParam.split(",").map((s) => s.trim())) {
      if (!op) continue;
      if (!AGGREGATIONS.includes(op)) {
        throw new QueryError(
          `Unknown aggregation "${op}". Supported: ${AGGREGATIONS.join(", ")}.`
        );
      }
      if (!ops.includes(op)) {
        ops.push(op);
      }
    }
  }
  const column = searchParams.get("column");
  const needsColumn = ops.filter((op) => op !== "count");
  if (needsColumn.length > 0 && !column) {
    throw new QueryError(
      `The "column" parameter is required for op=${needsColumn.join(",")}.`
    );
  }
  if (groupBy.length > 0 && ops.length === 0) {
    throw new QueryError(
      `groupBy requires at least one aggregation via the "op" parameter.`
    );
  }
  let limit = DEFAULT_LIMIT;
  const limitParam = searchParams.get("limit");
  if (limitParam !== null) {
    limit = Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new QueryError(
        `Invalid limit "${limitParam}". Must be an integer between 1 and ${MAX_LIMIT}.`
      );
    }
  }
  let offset = 0;
  const offsetParam = searchParams.get("offset");
  if (offsetParam !== null) {
    offset = Number(offsetParam);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new QueryError(
        `Invalid offset "${offsetParam}". Must be a non-negative integer.`
      );
    }
  }
  let orderBy = null;
  const orderByParam = searchParams.get("orderBy");
  if (orderByParam !== null && orderByParam.trim().length > 0) {
    const [key, direction = "asc"] = orderByParam.split(":");
    if (direction !== "asc" && direction !== "desc") {
      throw new QueryError(
        `Invalid orderBy direction "${direction}". Use :asc or :desc.`
      );
    }
    orderBy = { key: key.trim(), direction };
  }
  return { format, groupBy, ops, column, limit, offset, orderBy, filters };
}
__name(parseQueryParams, "parseQueryParams");
function canonicalQueryString(searchParams) {
  const entries = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "f") continue;
    entries.push([key, value]);
  }
  entries.sort(
    (a, b) => a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
  );
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.append(key, value);
  }
  return params.toString();
}
__name(canonicalQueryString, "canonicalQueryString");

// src/engine/asyncBuffer.ts
var PUBLIC_UPLOADS_BASE = "https://uploads.seasketch.org";
async function openR2File(options) {
  const { bucket, key, dev, cacheEnabled, waitUntil } = options;
  let byteLength;
  let etag;
  if (dev) {
    const probe = await fetch(`${PUBLIC_UPLOADS_BASE}/${key}`, {
      headers: { Range: "bytes=0-0" }
    });
    if (!probe.ok) {
      return null;
    }
    const contentRange = probe.headers.get("content-range") || "";
    byteLength = Number(contentRange.split("/")[1] || 0);
    etag = probe.headers.get("etag") || "";
    if (!byteLength) {
      return null;
    }
  } else {
    const head = await bucket.head(key);
    if (!head) {
      return null;
    }
    byteLength = head.size;
    etag = head.httpEtag;
  }
  const slice = /* @__PURE__ */ __name(async (start, end) => {
    const rangeEnd = end === void 0 ? byteLength : end;
    if (rangeEnd <= start) {
      return new ArrayBuffer(0);
    }
    const cacheKey2 = new Request(
      `${PUBLIC_UPLOADS_BASE}/${key}?etag=${encodeURIComponent(
        etag
      )}&bytes=${start}-${rangeEnd - 1}`
    );
    if (cacheEnabled) {
      const cached = await caches.default.match(cacheKey2);
      if (cached) {
        return await cached.arrayBuffer();
      }
    }
    let data;
    if (dev) {
      const res = await fetch(`${PUBLIC_UPLOADS_BASE}/${key}`, {
        headers: { Range: `bytes=${start}-${rangeEnd - 1}` }
      });
      if (!res.ok) {
        throw new Error(
          `Range request for ${key} failed with status ${res.status}`
        );
      }
      data = await res.arrayBuffer();
    } else {
      const body = await bucket.get(key, {
        range: { offset: start, length: rangeEnd - start }
      });
      if (!body) {
        throw new Error(`Range request to R2 for ${key} returned no body`);
      }
      data = await body.arrayBuffer();
    }
    if (cacheEnabled) {
      waitUntil(
        caches.default.put(
          cacheKey2,
          new Response(data.slice(0), {
            status: 200,
            headers: {
              "Content-Type": "application/octet-stream",
              "Cache-Control": "public, max-age=86400"
            }
          })
        )
      );
    }
    return data;
  }, "slice");
  const buffer = cachedAsyncBuffer({ byteLength, slice });
  return { buffer, byteLength, etag };
}
__name(openR2File, "openR2File");
async function getR2Object(options) {
  const { bucket, key, dev } = options;
  if (dev) {
    const res = await fetch(`${PUBLIC_UPLOADS_BASE}/${key}`);
    if (!res.ok) {
      return null;
    }
    return await res.arrayBuffer();
  }
  const body = await bucket.get(key);
  if (!body) {
    return null;
  }
  return await body.arrayBuffer();
}
__name(getR2Object, "getR2Object");

// src/engine/plan.ts
function kindForSchemaElement(element) {
  const logical = element.logical_type?.type;
  if (logical === "STRING" || element.converted_type === "UTF8") {
    return "string";
  }
  if (logical === "DATE" || logical === "TIMESTAMP" || element.converted_type === "DATE" || element.converted_type === "TIMESTAMP_MILLIS" || element.converted_type === "TIMESTAMP_MICROS" || element.type === "INT96") {
    return "timestamp";
  }
  if (element.type === "BOOLEAN") {
    return "boolean";
  }
  if (element.type === "INT32" || element.type === "INT64" || element.type === "FLOAT" || element.type === "DOUBLE" || element.converted_type === "DECIMAL") {
    return "number";
  }
  return "string";
}
__name(kindForSchemaElement, "kindForSchemaElement");
function columnsFromMetadata(metadata) {
  const columns = /* @__PURE__ */ new Map();
  const schema = parquetSchema(metadata);
  for (const child of schema.children) {
    const name = child.element.name;
    columns.set(name, { name, kind: kindForSchemaElement(child.element) });
  }
  return columns;
}
__name(columnsFromMetadata, "columnsFromMetadata");
function unknownColumnError(name, columns) {
  return new QueryError(`Unknown column "${name}".`, 400, {
    validColumns: [...columns.values()].map((c) => ({
      name: c.name,
      type: c.kind
    }))
  });
}
__name(unknownColumnError, "unknownColumnError");
function coerceValue(raw2, column) {
  switch (column.kind) {
    case "number": {
      const n = Number(raw2);
      if (raw2.trim() === "" || Number.isNaN(n)) {
        throw new QueryError(
          `Invalid numeric value "${raw2}" for column "${column.name}".`
        );
      }
      return n;
    }
    case "boolean": {
      if (raw2 === "true" || raw2 === "1") return true;
      if (raw2 === "false" || raw2 === "0") return false;
      throw new QueryError(
        `Invalid boolean value "${raw2}" for column "${column.name}". Use true or false.`
      );
    }
    case "timestamp": {
      const t = Date.parse(raw2);
      if (Number.isNaN(t)) {
        throw new QueryError(
          `Invalid date value "${raw2}" for column "${column.name}". Use an ISO 8601 date.`
        );
      }
      return t;
    }
    default:
      return raw2;
  }
}
__name(coerceValue, "coerceValue");
var COMPARISON_OPS = /* @__PURE__ */ new Set(["gt", "gte", "lt", "lte"]);
function compileFilters(filters, columns) {
  return filters.map((filter) => {
    const column = columns.get(filter.column);
    if (!column) {
      throw unknownColumnError(filter.column, columns);
    }
    if (COMPARISON_OPS.has(filter.op) && column.kind !== "number" && column.kind !== "timestamp") {
      throw new QueryError(
        `Operator "${filter.op}" is only supported for numeric or date columns; "${column.name}" is a ${column.kind} column.`
      );
    }
    const compiled = {
      column: filter.column,
      op: filter.op,
      kind: column.kind
    };
    if (filter.value !== void 0) {
      compiled.value = coerceValue(filter.value, column);
    }
    if (filter.values !== void 0) {
      compiled.values = filter.values.map((v) => coerceValue(v, column));
    }
    return compiled;
  });
}
__name(compileFilters, "compileFilters");
function normalizeValue(value, kind) {
  if (value === null || value === void 0) {
    return null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (kind === "number" && typeof value !== "number") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  if (kind === "timestamp" && typeof value === "number") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  return value;
}
__name(normalizeValue, "normalizeValue");
function rowGroupMayMatch(filter, stats, rowCount) {
  if (!stats) return true;
  const nullCount = stats.null_count === void 0 ? void 0 : Number(stats.null_count);
  if (filter.op === "isNull") {
    return nullCount === void 0 || nullCount > 0;
  }
  if (filter.op === "notNull") {
    return nullCount === void 0 || nullCount < rowCount;
  }
  const min = normalizeValue(stats.min_value, filter.kind);
  const max = normalizeValue(stats.max_value, filter.kind);
  if (min === null || max === null) return true;
  switch (filter.op) {
    case "eq":
      return filter.value >= min && filter.value <= max;
    case "in":
      return filter.values.some((v) => v >= min && v <= max);
    case "gt":
      return max > filter.value;
    case "gte":
      return max >= filter.value;
    case "lt":
      return min < filter.value;
    case "lte":
      return min <= filter.value;
    default:
      return !(filter.op === "neq" && min === max && min === filter.value);
  }
}
__name(rowGroupMayMatch, "rowGroupMayMatch");
function planQuery(metadata, query) {
  const columns = columnsFromMetadata(metadata);
  for (const name of query.groupBy) {
    if (!columns.has(name)) {
      throw unknownColumnError(name, columns);
    }
  }
  if (query.column !== null) {
    if (!columns.has(query.column)) {
      throw unknownColumnError(query.column, columns);
    }
    const kind = columns.get(query.column).kind;
    const numericOps = query.ops.filter(
      (op) => op !== "count" && op !== "min" && op !== "max"
    );
    if (numericOps.length > 0 && kind !== "number" && kind !== "timestamp") {
      throw new QueryError(
        `Aggregations ${numericOps.join(", ")} require a numeric column; "${query.column}" is a ${kind} column.`
      );
    }
  }
  const filters = compileFilters(query.filters, columns);
  let neededColumns;
  if (query.ops.length > 0) {
    const needed = new Set(query.groupBy);
    if (query.column) needed.add(query.column);
    for (const f of filters) needed.add(f.column);
    neededColumns = [...needed];
  } else {
    neededColumns = void 0;
  }
  const spans = [];
  let rowStart = 0;
  let scanned = 0;
  for (const rowGroup of metadata.row_groups) {
    const numRows = Number(rowGroup.num_rows);
    let mayMatch = true;
    for (const filter of filters) {
      const chunk = rowGroup.columns.find(
        (c) => c.meta_data?.path_in_schema.join(".") === filter.column
      );
      if (!chunk?.meta_data) continue;
      if (!rowGroupMayMatch(filter, chunk.meta_data.statistics, numRows)) {
        mayMatch = false;
        break;
      }
    }
    if (mayMatch && numRows > 0) {
      scanned++;
      const last = spans[spans.length - 1];
      if (last && last.rowEnd === rowStart) {
        last.rowEnd = rowStart + numRows;
      } else {
        spans.push({ rowStart, rowEnd: rowStart + numRows });
      }
    }
    rowStart += numRows;
  }
  return {
    columns,
    filters,
    neededColumns,
    spans,
    rowGroupsTotal: metadata.row_groups.length,
    rowGroupsScanned: scanned,
    totalRows: Number(metadata.num_rows)
  };
}
__name(planQuery, "planQuery");

// src/engine/execute.ts
function makePredicate(filters) {
  if (filters.length === 0) {
    return () => true;
  }
  return (row) => {
    for (const filter of filters) {
      const value = normalizeValue(row[filter.column], filter.kind);
      switch (filter.op) {
        case "isNull":
          if (value !== null) return false;
          break;
        case "notNull":
          if (value === null) return false;
          break;
        case "eq":
          if (value === null || value !== filter.value) return false;
          break;
        case "neq":
          if (value === null || value === filter.value) return false;
          break;
        case "in":
          if (value === null || !filter.values.includes(value)) return false;
          break;
        case "gt":
          if (value === null || !(value > filter.value)) return false;
          break;
        case "gte":
          if (value === null || !(value >= filter.value)) return false;
          break;
        case "lt":
          if (value === null || !(value < filter.value)) return false;
          break;
        case "lte":
          if (value === null || !(value <= filter.value)) return false;
          break;
      }
    }
    return true;
  };
}
__name(makePredicate, "makePredicate");
function jsonValue(value) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  if (value === void 0) {
    return null;
  }
  return value;
}
__name(jsonValue, "jsonValue");
function jsonRow(row) {
  const out = {};
  for (const key of Object.keys(row)) {
    out[key] = jsonValue(row[key]);
  }
  return out;
}
__name(jsonRow, "jsonRow");
function compareValues(a, b) {
  if (a === null || a === void 0) return b === null || b === void 0 ? 0 : 1;
  if (b === null || b === void 0) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
__name(compareValues, "compareValues");
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
__name(median, "median");
function sortAndPage(items, orderBy, offset, limit, validKeys) {
  if (orderBy) {
    if (!validKeys(orderBy.key)) {
      throw new QueryError(
        `orderBy key "${orderBy.key}" is not present in the output.`
      );
    }
    const dir = orderBy.direction === "desc" ? -1 : 1;
    items.sort((a, b) => dir * compareValues(a[orderBy.key], b[orderBy.key]));
  }
  return items.slice(offset, offset + limit);
}
__name(sortAndPage, "sortAndPage");
async function executeQuery(options) {
  const { file, metadata, query, plan } = options;
  const predicate = makePredicate(plan.filters);
  if (query.ops.length === 0) {
    return await executeRawQuery(options, predicate);
  }
  const aggColumn = query.column;
  const aggKind = aggColumn ? plan.columns.get(aggColumn)?.kind : void 0;
  const needsMedian = query.ops.includes("median");
  const groups = /* @__PURE__ */ new Map();
  let rowsScanned = 0;
  let rowsMatched = 0;
  for (const span of plan.spans) {
    const rows = await parquetReadObjects({
      file,
      metadata,
      columns: plan.neededColumns,
      rowStart: span.rowStart,
      rowEnd: span.rowEnd
    });
    rowsScanned += rows.length;
    for (const row of rows) {
      if (!predicate(row)) continue;
      rowsMatched++;
      const keyValues = query.groupBy.map((col) => jsonValue(row[col]));
      const key = JSON.stringify(keyValues);
      let group = groups.get(key);
      if (!group) {
        group = {
          keyValues,
          rowCount: 0,
          valueCount: 0,
          sum: 0,
          min: null,
          max: null,
          values: needsMedian ? [] : void 0
        };
        groups.set(key, group);
      }
      group.rowCount++;
      if (aggColumn) {
        const value = normalizeValue(row[aggColumn], aggKind || "string");
        if (value !== null) {
          group.valueCount++;
          if (typeof value === "number") {
            group.sum += value;
            group.values?.push(value);
          }
          if (group.min === null || compareValues(value, group.min) < 0) {
            group.min = value;
          }
          if (group.max === null || compareValues(value, group.max) > 0) {
            group.max = value;
          }
        }
      }
    }
  }
  const output = [];
  for (const group of groups.values()) {
    const entry = {};
    query.groupBy.forEach((col, i) => {
      entry[col] = group.keyValues[i];
    });
    for (const op of query.ops) {
      entry[op] = aggregateValue(op, group, aggColumn !== null);
    }
    output.push(entry);
  }
  const validKeys = /* @__PURE__ */ __name((key) => query.groupBy.includes(key) || query.ops.includes(key), "validKeys");
  const paged = sortAndPage(
    output,
    query.orderBy,
    query.offset,
    query.limit,
    validKeys
  );
  return { groups: paged, rowsScanned, rowsMatched };
}
__name(executeQuery, "executeQuery");
function aggregateValue(op, group, hasColumn) {
  switch (op) {
    case "count":
      return hasColumn ? group.valueCount : group.rowCount;
    case "sum":
      return group.valueCount > 0 ? group.sum : null;
    case "mean":
      return group.valueCount > 0 ? group.sum / group.valueCount : null;
    case "min":
      return group.min;
    case "max":
      return group.max;
    case "median":
      return median(group.values || []);
  }
}
__name(aggregateValue, "aggregateValue");
async function executeRawQuery(options, predicate) {
  const { file, metadata, query, plan } = options;
  const matched = [];
  let rowsScanned = 0;
  let rowsMatched = 0;
  const target = query.orderBy ? Infinity : query.offset + query.limit;
  for (const span of plan.spans) {
    const rows = await parquetReadObjects({
      file,
      metadata,
      columns: plan.neededColumns,
      rowStart: span.rowStart,
      rowEnd: span.rowEnd
    });
    rowsScanned += rows.length;
    for (const row of rows) {
      if (!predicate(row)) continue;
      rowsMatched++;
      if (matched.length < target) {
        matched.push(jsonRow(row));
      }
    }
    if (matched.length >= target) break;
  }
  const columnNames = new Set(plan.columns.keys());
  const paged = sortAndPage(
    matched,
    query.orderBy,
    query.offset,
    query.limit,
    (key) => columnNames.has(key)
  );
  return { rows: paged, rowsScanned, rowsMatched };
}
__name(executeRawQuery, "executeRawQuery");

// src/ui/html.ts
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
__name(escapeHtml, "escapeHtml");
function queryUiHtml(tablePath) {
  const safePath = escapeHtml(tablePath);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Data Table Query &mdash; ${safePath}</title>
<style>
  :root {
    --bg: #f6f7f9; --panel: #ffffff; --border: #e2e5ea; --text: #1d2530;
    --muted: #6b7482; --accent: #1d4ed8; --accent-soft: #e8eefc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .wrap { max-width: 1000px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .subtitle { color: var(--muted); font-size: 12px; font-family: ui-monospace, monospace; word-break: break-all; }
  .panel {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; margin-top: 16px;
  }
  .panel h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 10px; }
  label { font-size: 12px; color: var(--muted); display: block; margin-bottom: 2px; }
  select, input[type=text], input[type=number] {
    font: inherit; padding: 6px 8px; border: 1px solid var(--border);
    border-radius: 6px; background: #fff; min-width: 0;
  }
  .row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 8px; }
  .filters .row { background: var(--bg); padding: 8px; border-radius: 8px; }
  button {
    font: inherit; border: 1px solid var(--border); border-radius: 6px;
    background: #fff; padding: 6px 12px; cursor: pointer;
  }
  button:hover { background: var(--accent-soft); }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; padding: 8px 20px; }
  button.primary:hover { opacity: 0.9; }
  button.remove { color: #b91c1c; border: none; background: none; font-size: 16px; padding: 4px 8px; }
  .checkboxes { display: flex; gap: 12px; flex-wrap: wrap; }
  .checkboxes label { display: flex; align-items: center; gap: 4px; margin: 0; color: var(--text); font-size: 13px; }
  .url-box {
    font-family: ui-monospace, monospace; font-size: 12px; background: #0f172a; color: #e2e8f0;
    padding: 10px 12px; border-radius: 8px; word-break: break-all; margin-top: 12px;
  }
  .url-box a { color: #7dd3fc; text-decoration: none; }
  table.results { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 13px; }
  table.results th, table.results td {
    border: 1px solid var(--border); padding: 5px 9px; text-align: left; white-space: nowrap;
  }
  table.results th { background: var(--bg); position: sticky; top: 0; }
  .results-scroll { max-height: 480px; overflow: auto; margin-top: 8px; border-radius: 8px; }
  .meta { color: var(--muted); font-size: 12px; margin-top: 8px; }
  .error { color: #b91c1c; margin-top: 8px; white-space: pre-wrap; }
  .hint { color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Data Table Query</h1>
  <div class="subtitle">${safePath}</div>

  <div class="panel filters">
    <h2>Filters</h2>
    <div id="filters"></div>
    <button type="button" id="add-filter">+ Add filter</button>
  </div>

  <div class="panel">
    <h2>Aggregation</h2>
    <div class="row">
      <div>
        <label>Group by</label>
        <div class="checkboxes" id="group-by"></div>
      </div>
    </div>
    <div class="row">
      <div>
        <label>Operations</label>
        <div class="checkboxes" id="ops"></div>
      </div>
      <div>
        <label for="agg-column">Column</label>
        <select id="agg-column"><option value="">(none)</option></select>
      </div>
    </div>
    <div class="hint">Leave operations unchecked to fetch raw filtered rows.</div>
  </div>

  <div class="panel">
    <h2>Output</h2>
    <div class="row">
      <div><label for="order-by">Order by</label><select id="order-by"><option value="">(none)</option></select></div>
      <div><label for="order-dir">Direction</label>
        <select id="order-dir"><option value="asc">asc</option><option value="desc">desc</option></select></div>
      <div><label for="limit">Limit</label><input type="number" id="limit" value="100" min="1" max="10000" style="width:90px" /></div>
      <div><label for="offset">Offset</label><input type="number" id="offset" value="0" min="0" style="width:90px" /></div>
      <button type="button" class="primary" id="run">Run query</button>
    </div>
    <div class="url-box" id="url"></div>
    <div id="output"></div>
  </div>
</div>

<script>
(function () {
  "use strict";
  var stats = null;
  var columns = [];
  var OPS = ["count", "sum", "mean", "min", "max", "median"];
  var STRING_OPS = [["eq", "="], ["neq", "\\u2260"], ["in", "in"], ["is.null", "is null"], ["not.null", "not null"]];
  var NUMBER_OPS = [["eq", "="], ["neq", "\\u2260"], ["gt", ">"], ["gte", "\\u2265"], ["lt", "<"], ["lte", "\\u2264"], ["in", "in"], ["is.null", "is null"], ["not.null", "not null"]];

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function columnInfo(name) {
    return columns.find(function (c) { return c.attribute === name; });
  }

  function buildFilterRow() {
    var row = el("div", { class: "row" });
    var colSel = el("select", { class: "f-col" });
    columns.forEach(function (c) {
      colSel.appendChild(el("option", { value: c.attribute, text: c.attribute + " (" + c.type + ")" }));
    });
    var opSel = el("select", { class: "f-op" });
    var valWrap = el("span", { class: "f-val-wrap" });

    function rebuildOps() {
      var info = columnInfo(colSel.value);
      var ops = info && info.type === "number" ? NUMBER_OPS : STRING_OPS;
      opSel.innerHTML = "";
      ops.forEach(function (o) {
        opSel.appendChild(el("option", { value: o[0], text: o[1] }));
      });
      rebuildValue();
    }

    function rebuildValue() {
      valWrap.innerHTML = "";
      if (opSel.value === "is.null" || opSel.value === "not.null") return;
      var info = columnInfo(colSel.value);
      var distinct = info && info.values ? Object.keys(info.values) : [];
      if (distinct.length > 0 && distinct.length <= 50 && opSel.value !== "in") {
        var sel = el("select", { class: "f-val" });
        distinct.forEach(function (v) { sel.appendChild(el("option", { value: v, text: v })); });
        valWrap.appendChild(sel);
      } else {
        var input = el("input", { type: "text", class: "f-val", placeholder: opSel.value === "in" ? "value1,value2,..." : "value" });
        if (distinct.length > 0 && distinct.length <= 200) {
          var listId = "dl-" + Math.random().toString(36).slice(2);
          var dl = el("datalist", { id: listId });
          distinct.forEach(function (v) { dl.appendChild(el("option", { value: v })); });
          input.setAttribute("list", listId);
          valWrap.appendChild(dl);
        }
        valWrap.appendChild(input);
        if (info && info.min !== undefined) {
          valWrap.appendChild(el("span", { class: "hint", text: " " + info.min + " \\u2013 " + info.max }));
        }
      }
      updateUrl();
    }

    colSel.addEventListener("change", rebuildOps);
    opSel.addEventListener("change", rebuildValue);
    row.appendChild(el("div", {}, [el("label", { text: "Column" }), colSel]));
    row.appendChild(el("div", {}, [el("label", { text: "Op" }), opSel]));
    row.appendChild(el("div", {}, [el("label", { text: "Value" }), valWrap]));
    var removeBtn = el("button", { type: "button", class: "remove", title: "Remove filter", text: "\\u00d7" });
    removeBtn.addEventListener("click", function () { row.remove(); updateUrl(); });
    row.appendChild(removeBtn);
    rebuildOps();
    return row;
  }

  function buildQueryString() {
    var params = new URLSearchParams();
    document.querySelectorAll("#filters .row").forEach(function (row) {
      var col = row.querySelector(".f-col").value;
      var op = row.querySelector(".f-op").value;
      var valEl = row.querySelector(".f-val");
      if (op === "is.null" || op === "not.null") {
        params.append("q." + col, op);
      } else if (valEl && valEl.value !== "") {
        if (op === "in") {
          var items = valEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean)
            .map(function (s) { return s.indexOf(",") >= 0 || s.indexOf('"') >= 0 ? '"' + s.replace(/"/g, '""') + '"' : s; });
          params.append("q." + col, "in.(" + items.join(",") + ")");
        } else if (op === "eq") {
          params.append("q." + col, valEl.value);
        } else {
          params.append("q." + col, op + "." + valEl.value);
        }
      }
    });
    var groupBy = [];
    document.querySelectorAll("#group-by input:checked").forEach(function (cb) { groupBy.push(cb.value); });
    if (groupBy.length) params.set("groupBy", groupBy.join(","));
    var ops = [];
    document.querySelectorAll("#ops input:checked").forEach(function (cb) { ops.push(cb.value); });
    if (ops.length) params.set("op", ops.join(","));
    var aggCol = document.getElementById("agg-column").value;
    if (aggCol && ops.length) params.set("column", aggCol);
    var orderBy = document.getElementById("order-by").value;
    if (orderBy) params.set("orderBy", orderBy + ":" + document.getElementById("order-dir").value);
    var limit = document.getElementById("limit").value;
    if (limit && limit !== "1000") params.set("limit", limit);
    var offset = document.getElementById("offset").value;
    if (offset && offset !== "0") params.set("offset", offset);
    return params;
  }

  function updateOrderByOptions() {
    var sel = document.getElementById("order-by");
    var current = sel.value;
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "", text: "(none)" }));
    var groupBy = [];
    document.querySelectorAll("#group-by input:checked").forEach(function (cb) { groupBy.push(cb.value); });
    var ops = [];
    document.querySelectorAll("#ops input:checked").forEach(function (cb) { ops.push(cb.value); });
    var keys = ops.length ? groupBy.concat(ops) : columns.map(function (c) { return c.attribute; });
    keys.forEach(function (k) { sel.appendChild(el("option", { value: k, text: k })); });
    if (keys.indexOf(current) >= 0) sel.value = current;
  }

  function updateUrl() {
    updateOrderByOptions();
    var params = buildQueryString();
    params.set("f", "json");
    var href = "query?" + params.toString();
    var box = document.getElementById("url");
    box.innerHTML = "";
    box.appendChild(el("a", { href: href, target: "_blank", text: new URL(href, location.href).toString() }));
  }

  function renderResults(data) {
    var out = document.getElementById("output");
    out.innerHTML = "";
    var items = data.groups || data.rows || [];
    var meta = el("div", { class: "meta", text:
      items.length + (data.groups ? " groups" : " rows") +
      " \\u00b7 scanned " + data.rowsScanned.toLocaleString() + " of " + data.totalRows.toLocaleString() + " rows" +
      " \\u00b7 matched " + data.rowsMatched.toLocaleString() +
      " \\u00b7 row groups " + data.rowGroups.scanned + "/" + data.rowGroups.total +
      " \\u00b7 " + data.timing.totalMs + "ms (metadata " + data.timing.metadataMs + "ms)" });
    out.appendChild(meta);
    if (!items.length) return;
    var cols = Object.keys(items[0]);
    var table = el("table", { class: "results" });
    var thead = el("thead", {}, [el("tr", {}, cols.map(function (c) { return el("th", { text: c }); }))]);
    var tbody = el("tbody");
    items.forEach(function (item) {
      tbody.appendChild(el("tr", {}, cols.map(function (c) {
        var v = item[c];
        var text = v === null || v === undefined ? "" :
          typeof v === "number" && !Number.isInteger(v) ? v.toFixed(3) : String(v);
        return el("td", { text: text });
      })));
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    var scroll = el("div", { class: "results-scroll" }, [table]);
    out.appendChild(scroll);
  }

  function run() {
    var params = buildQueryString();
    params.set("f", "json");
    var out = document.getElementById("output");
    out.innerHTML = '<div class="meta">Running\\u2026</div>';
    var t0 = performance.now();
    fetch("query?" + params.toString(), { headers: { accept: "application/json" } })
      .then(function (res) { return res.json().then(function (body) { return { res: res, body: body }; }); })
      .then(function (r) {
        if (!r.res.ok) {
          out.innerHTML = "";
          out.appendChild(el("div", { class: "error", text: "Error " + r.res.status + ": " + (r.body.error || "") +
            (r.body.validColumns ? "\\nValid columns: " + r.body.validColumns.map(function (c) { return c.name; }).join(", ") : "") }));
          return;
        }
        renderResults(r.body);
        var wall = Math.round(performance.now() - t0);
        var meta = out.querySelector(".meta");
        if (meta) meta.textContent += " \\u00b7 request " + wall + "ms";
      })
      .catch(function (err) {
        out.innerHTML = "";
        out.appendChild(el("div", { class: "error", text: String(err) }));
      });
  }

  function init(data) {
    stats = data;
    columns = data.columns || [];
    var groupBy = document.getElementById("group-by");
    columns.forEach(function (c) {
      var cb = el("input", { type: "checkbox", value: c.attribute });
      cb.addEventListener("change", updateUrl);
      groupBy.appendChild(el("label", {}, [cb, document.createTextNode(c.attribute)]));
    });
    var opsWrap = document.getElementById("ops");
    OPS.forEach(function (op) {
      var cb = el("input", { type: "checkbox", value: op });
      cb.addEventListener("change", updateUrl);
      opsWrap.appendChild(el("label", {}, [cb, document.createTextNode(op)]));
    });
    var aggCol = document.getElementById("agg-column");
    columns.filter(function (c) { return c.type === "number"; }).forEach(function (c) {
      aggCol.appendChild(el("option", { value: c.attribute, text: c.attribute }));
    });
    aggCol.addEventListener("change", updateUrl);
    ["order-by", "order-dir", "limit", "offset"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", updateUrl);
    });
    document.getElementById("add-filter").addEventListener("click", function () {
      document.getElementById("filters").appendChild(buildFilterRow());
      updateUrl();
    });
    document.getElementById("run").addEventListener("click", run);
    document.getElementById("filters").addEventListener("change", updateUrl);
    updateUrl();
  }

  fetch("column-stats.json", { headers: { accept: "application/json" } })
    .then(function (res) {
      if (!res.ok) throw new Error("column-stats.json not found (" + res.status + ")");
      return res.json();
    })
    .then(init)
    .catch(function (err) {
      document.getElementById("output").appendChild(
        el("div", { class: "error", text: "Failed to load column metadata: " + String(err) }));
    });
})();
<\/script>
</body>
</html>`;
}
__name(queryUiHtml, "queryUiHtml");

// src/index.ts
var app = new Hono2();
var CACHE_ORIGIN = "https://data-tables.seasketch.org";
var BROWSER_MAX_AGE = 3600;
var EDGE_MAX_AGE = 86400;
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    maxAge: 86400
  })
);
function isDev(env) {
  return !!env.DEV;
}
__name(isDev, "isDev");
async function makeETag(objectEtag, canonicalQuery) {
  const data = new TextEncoder().encode(`${objectEtag}|${canonicalQuery}`);
  const digest = await crypto.subtle.digest("SHA-1", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `"${hex}"`;
}
__name(makeETag, "makeETag");
function errorResponse(error) {
  if (error instanceof QueryError) {
    return Response.json(
      { error: error.message, ...error.details },
      { status: error.status }
    );
  }
  console.error(
    JSON.stringify({
      message: "query execution failed",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    })
  );
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
__name(errorResponse, "errorResponse");
app.get("*", async (c) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;
  if (pathname.endsWith("/query")) {
    const tablePath = pathname.slice(1, -"/query".length);
    if (!tablePath) {
      return Response.json({ error: "Missing table path" }, { status: 404 });
    }
    return handleQuery(c, tablePath, url);
  }
  if (pathname.endsWith("/column-stats.json")) {
    return handleColumnStats(c, pathname.slice(1));
  }
  return Response.json(
    {
      error: "Not found. Query endpoint is {tablePath}/query"
    },
    { status: 404 }
  );
});
async function handleColumnStats(c, key) {
  const dev = isDev(c.env);
  const data = await getR2Object({ bucket: c.env.SSN_TILES, key, dev });
  if (!data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(data, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": dev ? "no-store" : `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${EDGE_MAX_AGE}`
    }
  });
}
__name(handleColumnStats, "handleColumnStats");
async function handleQuery(c, tablePath, url) {
  const dev = isDev(c.env);
  const cacheEnabled = !dev;
  let query;
  try {
    query = parseQueryParams(url.searchParams);
  } catch (error) {
    return errorResponse(error);
  }
  const accept = c.req.header("accept") || "";
  const wantsHtml = query.format === "html" || query.format === null && accept.includes("text/html");
  if (wantsHtml) {
    return new Response(queryUiHtml(tablePath), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": dev ? "no-store" : "public, max-age=300"
      }
    });
  }
  const canonicalQuery = canonicalQueryString(url.searchParams);
  const cacheKey2 = new Request(
    `${CACHE_ORIGIN}/${tablePath}/query?${canonicalQuery}`
  );
  const ifNoneMatch = c.req.header("if-none-match");
  if (cacheEnabled) {
    const cached = await caches.default.match(cacheKey2);
    if (cached) {
      const etag = cached.headers.get("etag");
      if (etag && ifNoneMatch === etag) {
        return new Response(null, {
          status: 304,
          headers: { ETag: etag, "Cache-Control": cached.headers.get("cache-control") || "" }
        });
      }
      return cached;
    }
  }
  const started = Date.now();
  try {
    const source = await openR2File({
      bucket: c.env.SSN_TILES,
      key: `${tablePath}/data.parquet`,
      dev,
      cacheEnabled,
      waitUntil: /* @__PURE__ */ __name((p) => c.executionCtx.waitUntil(p), "waitUntil")
    });
    if (!source) {
      throw new QueryError(
        `No data table found at "${tablePath}/data.parquet".`,
        404
      );
    }
    const metadata = await parquetMetadataAsync(source.buffer);
    const planned = Date.now();
    const plan = planQuery(metadata, query);
    const result = await executeQuery({
      file: source.buffer,
      metadata,
      query,
      plan
    });
    const finished = Date.now();
    const body = {
      table: tablePath,
      totalRows: plan.totalRows,
      rowsScanned: result.rowsScanned,
      rowsMatched: result.rowsMatched,
      rowGroups: {
        total: plan.rowGroupsTotal,
        scanned: plan.rowGroupsScanned
      },
      timing: {
        metadataMs: planned - started,
        executeMs: finished - planned,
        totalMs: finished - started
      },
      ...result.groups !== void 0 ? { groups: result.groups } : { rows: result.rows }
    };
    const etag = await makeETag(source.etag, canonicalQuery);
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    const response = new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
        "Cache-Control": dev ? "no-store" : `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${EDGE_MAX_AGE}`
      }
    });
    if (cacheEnabled) {
      c.executionCtx.waitUntil(caches.default.put(cacheKey2, response.clone()));
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
__name(handleQuery, "handleQuery");
var src_default = app;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-sWKaAx/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-sWKaAx/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
