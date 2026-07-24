#!/usr/bin/env node
// Thin wrapper — implementation lives in graphql-validate/ so CI `npm ci`
// resolves graphql from that package's node_modules.
require("../graphql-validate/validate.js");
