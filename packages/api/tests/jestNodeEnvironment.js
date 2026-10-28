const NodeEnvironment = require("jest-environment-node");
const web = require("stream/web");
const { Blob, File } = require("buffer");
const { performance } = require("perf_hooks");
const {
  MessageChannel,
  MessagePort,
  BroadcastChannel,
} = require("worker_threads");

// Jest 26 builds a vm global and only copies a few Node globals into it.
// undici reads the rest while loading, so copy them from this process first.
class NodeWebEnvironment extends NodeEnvironment {
  constructor(config) {
    super(config);
    const globals = {
      ReadableStream: web.ReadableStream,
      WritableStream: web.WritableStream,
      TransformStream: web.TransformStream,
      Blob,
      File,
      MessageChannel,
      MessagePort,
      BroadcastChannel,
      performance,
      AbortController,
      AbortSignal,
      DOMException,
      Event,
      EventTarget,
      structuredClone,
      atob,
      btoa,
    };
    for (const [name, value] of Object.entries(globals)) {
      if (typeof this.global[name] === "undefined" && typeof value !== "undefined") {
        this.global[name] = value;
      }
    }
  }
}

module.exports = NodeWebEnvironment;
