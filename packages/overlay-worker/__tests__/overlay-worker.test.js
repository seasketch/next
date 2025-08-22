'use strict';

const overlayWorker = require('..');
const assert = require('assert').strict;

assert.strictEqual(overlayWorker(), 'Hello from overlayWorker');
console.info('overlayWorker tests passed');
