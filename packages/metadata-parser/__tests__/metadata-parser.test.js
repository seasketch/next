'use strict';

const metadataParser = require('..');
const assert = require('assert').strict;

assert.strictEqual(metadataParser(), 'Hello from metadataParser');
console.info('metadataParser tests passed');
