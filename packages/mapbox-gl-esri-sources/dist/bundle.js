var MapBoxGLEsriSources = (function () {
	'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, basedir, module) {
		return module = {
		  path: basedir,
		  exports: {},
		  require: function (path, base) {
	      return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
	    }
		}, fn(module, module.exports), module.exports;
	}

	function getCjsExportFromNamespace (n) {
		return n && n['default'] || n;
	}

	function commonjsRequire () {
		throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
	}

	var getRandomValues;
	var rnds8 = new Uint8Array(16);
	function rng() {
	  if (!getRandomValues) {
	    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);
	    if (!getRandomValues) {
	      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
	    }
	  }
	  return getRandomValues(rnds8);
	}

	var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

	function validate(uuid) {
	  return typeof uuid === 'string' && REGEX.test(uuid);
	}

	var byteToHex = [];
	for (var i = 0; i < 256; ++i) {
	  byteToHex.push((i + 0x100).toString(16).substr(1));
	}
	function stringify(arr) {
	  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
	  var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
	  if (!validate(uuid)) {
	    throw TypeError('Stringified UUID is invalid');
	  }
	  return uuid;
	}

	var _nodeId;
	var _clockseq;
	var _lastMSecs = 0;
	var _lastNSecs = 0;
	function v1(options, buf, offset) {
	  var i = buf && offset || 0;
	  var b = buf || new Array(16);
	  options = options || {};
	  var node = options.node || _nodeId;
	  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;
	  if (node == null || clockseq == null) {
	    var seedBytes = options.random || (options.rng || rng)();
	    if (node == null) {
	      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
	    }
	    if (clockseq == null) {
	      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
	    }
	  }
	  var msecs = options.msecs !== undefined ? options.msecs : Date.now();
	  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;
	  var dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000;
	  if (dt < 0 && options.clockseq === undefined) {
	    clockseq = clockseq + 1 & 0x3fff;
	  }
	  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
	    nsecs = 0;
	  }
	  if (nsecs >= 10000) {
	    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
	  }
	  _lastMSecs = msecs;
	  _lastNSecs = nsecs;
	  _clockseq = clockseq;
	  msecs += 12219292800000;
	  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
	  b[i++] = tl >>> 24 & 0xff;
	  b[i++] = tl >>> 16 & 0xff;
	  b[i++] = tl >>> 8 & 0xff;
	  b[i++] = tl & 0xff;
	  var tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
	  b[i++] = tmh >>> 8 & 0xff;
	  b[i++] = tmh & 0xff;
	  b[i++] = tmh >>> 24 & 0xf | 0x10;
	  b[i++] = tmh >>> 16 & 0xff;
	  b[i++] = clockseq >>> 8 | 0x80;
	  b[i++] = clockseq & 0xff;
	  for (var n = 0; n < 6; ++n) {
	    b[i + n] = node[n];
	  }
	  return buf || stringify(b);
	}

	function parse(uuid) {
	  if (!validate(uuid)) {
	    throw TypeError('Invalid UUID');
	  }
	  var v;
	  var arr = new Uint8Array(16);
	  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
	  arr[1] = v >>> 16 & 0xff;
	  arr[2] = v >>> 8 & 0xff;
	  arr[3] = v & 0xff;
	  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
	  arr[5] = v & 0xff;
	  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
	  arr[7] = v & 0xff;
	  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
	  arr[9] = v & 0xff;
	  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
	  arr[11] = v / 0x100000000 & 0xff;
	  arr[12] = v >>> 24 & 0xff;
	  arr[13] = v >>> 16 & 0xff;
	  arr[14] = v >>> 8 & 0xff;
	  arr[15] = v & 0xff;
	  return arr;
	}

	function stringToBytes(str) {
	  str = unescape(encodeURIComponent(str));
	  var bytes = [];
	  for (var i = 0; i < str.length; ++i) {
	    bytes.push(str.charCodeAt(i));
	  }
	  return bytes;
	}
	var DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
	var URL$1 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
	function v35 (name, version, hashfunc) {
	  function generateUUID(value, namespace, buf, offset) {
	    if (typeof value === 'string') {
	      value = stringToBytes(value);
	    }
	    if (typeof namespace === 'string') {
	      namespace = parse(namespace);
	    }
	    if (namespace.length !== 16) {
	      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
	    }
	    var bytes = new Uint8Array(16 + value.length);
	    bytes.set(namespace);
	    bytes.set(value, namespace.length);
	    bytes = hashfunc(bytes);
	    bytes[6] = bytes[6] & 0x0f | version;
	    bytes[8] = bytes[8] & 0x3f | 0x80;
	    if (buf) {
	      offset = offset || 0;
	      for (var i = 0; i < 16; ++i) {
	        buf[offset + i] = bytes[i];
	      }
	      return buf;
	    }
	    return stringify(bytes);
	  }
	  try {
	    generateUUID.name = name;
	  } catch (err) {}
	  generateUUID.DNS = DNS;
	  generateUUID.URL = URL$1;
	  return generateUUID;
	}

	function md5(bytes) {
	  if (typeof bytes === 'string') {
	    var msg = unescape(encodeURIComponent(bytes));
	    bytes = new Uint8Array(msg.length);
	    for (var i = 0; i < msg.length; ++i) {
	      bytes[i] = msg.charCodeAt(i);
	    }
	  }
	  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
	}
	function md5ToHexEncodedArray(input) {
	  var output = [];
	  var length32 = input.length * 32;
	  var hexTab = '0123456789abcdef';
	  for (var i = 0; i < length32; i += 8) {
	    var x = input[i >> 5] >>> i % 32 & 0xff;
	    var hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
	    output.push(hex);
	  }
	  return output;
	}
	function getOutputLength(inputLength8) {
	  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
	}
	function wordsToMd5(x, len) {
	  x[len >> 5] |= 0x80 << len % 32;
	  x[getOutputLength(len) - 1] = len;
	  var a = 1732584193;
	  var b = -271733879;
	  var c = -1732584194;
	  var d = 271733878;
	  for (var i = 0; i < x.length; i += 16) {
	    var olda = a;
	    var oldb = b;
	    var oldc = c;
	    var oldd = d;
	    a = md5ff(a, b, c, d, x[i], 7, -680876936);
	    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
	    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
	    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
	    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
	    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
	    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
	    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
	    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
	    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
	    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
	    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
	    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
	    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
	    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
	    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
	    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
	    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
	    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
	    b = md5gg(b, c, d, a, x[i], 20, -373897302);
	    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
	    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
	    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
	    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
	    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
	    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
	    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
	    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
	    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
	    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
	    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
	    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
	    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
	    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
	    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
	    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
	    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
	    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
	    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
	    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
	    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
	    d = md5hh(d, a, b, c, x[i], 11, -358537222);
	    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
	    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
	    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
	    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
	    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
	    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
	    a = md5ii(a, b, c, d, x[i], 6, -198630844);
	    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
	    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
	    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
	    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
	    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
	    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
	    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
	    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
	    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
	    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
	    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
	    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
	    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
	    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
	    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
	    a = safeAdd(a, olda);
	    b = safeAdd(b, oldb);
	    c = safeAdd(c, oldc);
	    d = safeAdd(d, oldd);
	  }
	  return [a, b, c, d];
	}
	function bytesToWords(input) {
	  if (input.length === 0) {
	    return [];
	  }
	  var length8 = input.length * 8;
	  var output = new Uint32Array(getOutputLength(length8));
	  for (var i = 0; i < length8; i += 8) {
	    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
	  }
	  return output;
	}
	function safeAdd(x, y) {
	  var lsw = (x & 0xffff) + (y & 0xffff);
	  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
	  return msw << 16 | lsw & 0xffff;
	}
	function bitRotateLeft(num, cnt) {
	  return num << cnt | num >>> 32 - cnt;
	}
	function md5cmn(q, a, b, x, s, t) {
	  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
	}
	function md5ff(a, b, c, d, x, s, t) {
	  return md5cmn(b & c | ~b & d, a, b, x, s, t);
	}
	function md5gg(a, b, c, d, x, s, t) {
	  return md5cmn(b & d | c & ~d, a, b, x, s, t);
	}
	function md5hh(a, b, c, d, x, s, t) {
	  return md5cmn(b ^ c ^ d, a, b, x, s, t);
	}
	function md5ii(a, b, c, d, x, s, t) {
	  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
	}

	var v3 = v35('v3', 0x30, md5);
	var v3$1 = v3;

	function v4(options, buf, offset) {
	  options = options || {};
	  var rnds = options.random || (options.rng || rng)();
	  rnds[6] = rnds[6] & 0x0f | 0x40;
	  rnds[8] = rnds[8] & 0x3f | 0x80;
	  if (buf) {
	    offset = offset || 0;
	    for (var i = 0; i < 16; ++i) {
	      buf[offset + i] = rnds[i];
	    }
	    return buf;
	  }
	  return stringify(rnds);
	}

	function f(s, x, y, z) {
	  switch (s) {
	    case 0:
	      return x & y ^ ~x & z;
	    case 1:
	      return x ^ y ^ z;
	    case 2:
	      return x & y ^ x & z ^ y & z;
	    case 3:
	      return x ^ y ^ z;
	  }
	}
	function ROTL(x, n) {
	  return x << n | x >>> 32 - n;
	}
	function sha1(bytes) {
	  var K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
	  var H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
	  if (typeof bytes === 'string') {
	    var msg = unescape(encodeURIComponent(bytes));
	    bytes = [];
	    for (var i = 0; i < msg.length; ++i) {
	      bytes.push(msg.charCodeAt(i));
	    }
	  } else if (!Array.isArray(bytes)) {
	    bytes = Array.prototype.slice.call(bytes);
	  }
	  bytes.push(0x80);
	  var l = bytes.length / 4 + 2;
	  var N = Math.ceil(l / 16);
	  var M = new Array(N);
	  for (var _i = 0; _i < N; ++_i) {
	    var arr = new Uint32Array(16);
	    for (var j = 0; j < 16; ++j) {
	      arr[j] = bytes[_i * 64 + j * 4] << 24 | bytes[_i * 64 + j * 4 + 1] << 16 | bytes[_i * 64 + j * 4 + 2] << 8 | bytes[_i * 64 + j * 4 + 3];
	    }
	    M[_i] = arr;
	  }
	  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
	  M[N - 1][14] = Math.floor(M[N - 1][14]);
	  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;
	  for (var _i2 = 0; _i2 < N; ++_i2) {
	    var W = new Uint32Array(80);
	    for (var t = 0; t < 16; ++t) {
	      W[t] = M[_i2][t];
	    }
	    for (var _t = 16; _t < 80; ++_t) {
	      W[_t] = ROTL(W[_t - 3] ^ W[_t - 8] ^ W[_t - 14] ^ W[_t - 16], 1);
	    }
	    var a = H[0];
	    var b = H[1];
	    var c = H[2];
	    var d = H[3];
	    var e = H[4];
	    for (var _t2 = 0; _t2 < 80; ++_t2) {
	      var s = Math.floor(_t2 / 20);
	      var T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[_t2] >>> 0;
	      e = d;
	      d = c;
	      c = ROTL(b, 30) >>> 0;
	      b = a;
	      a = T;
	    }
	    H[0] = H[0] + a >>> 0;
	    H[1] = H[1] + b >>> 0;
	    H[2] = H[2] + c >>> 0;
	    H[3] = H[3] + d >>> 0;
	    H[4] = H[4] + e >>> 0;
	  }
	  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
	}

	var v5 = v35('v5', 0x50, sha1);
	var v5$1 = v5;

	var nil = '00000000-0000-0000-0000-000000000000';

	function version(uuid) {
	  if (!validate(uuid)) {
	    throw TypeError('Invalid UUID');
	  }
	  return parseInt(uuid.substr(14, 1), 16);
	}

	var esmBrowser = /*#__PURE__*/Object.freeze({
		__proto__: null,
		v1: v1,
		v3: v3$1,
		v4: v4,
		v5: v5$1,
		NIL: nil,
		version: version,
		validate: validate,
		stringify: stringify,
		parse: parse
	});

	var utils$1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.replaceSource = replaceSource;
	exports.metersToDegrees = metersToDegrees;
	exports.extentToLatLngBounds = extentToLatLngBounds;
	exports.normalizeSpatialReference = normalizeSpatialReference;
	exports.projectExtent = projectExtent;
	exports.contentOrFalse = contentOrFalse;
	exports.generateMetadataForLayer = generateMetadataForLayer;
	exports.makeLegend = makeLegend;
	const blankDataUri = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
	function replaceSource(sourceId, map, sourceData) {
	    var _a;
	    const existingSource = map.getSource(sourceId);
	    if (!existingSource) {
	        throw new Error("Source does not exist");
	    }
	    if (existingSource.type !== sourceData.type) {
	        throw new Error("Source type mismatch");
	    }
	    const allLayers = map.getStyle().layers || [];
	    const relatedLayers = allLayers.filter((l) => {
	        return "source" in l && l.source === sourceId;
	    });
	    relatedLayers.reverse();
	    const idx = allLayers.indexOf(relatedLayers[0]);
	    let before = ((_a = allLayers[idx + 1]) === null || _a === void 0 ? void 0 : _a.id) || undefined;
	    for (const layer of relatedLayers) {
	        map.removeLayer(layer.id);
	    }
	    map.removeSource(sourceId);
	    map.addSource(sourceId, sourceData);
	    for (const layer of relatedLayers) {
	        map.addLayer(layer, before);
	        before = layer.id;
	    }
	}
	function metersToDegrees(x, y) {
	    var lon = (x * 180) / 20037508.34;
	    var lat = (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
	    return [lon, lat];
	}
	async function extentToLatLngBounds(extent) {
	    if (extent) {
	        const wkid = normalizeSpatialReference(extent.spatialReference);
	        let bounds;
	        if (wkid === 4326) {
	            bounds = [
	                Math.max(-180, extent.xmin),
	                Math.max(-90, extent.ymin),
	                Math.min(180, extent.xmax),
	                Math.min(90, extent.ymax),
	            ];
	        }
	        else if (wkid === 3857 || wkid === 102100) {
	            bounds = [
	                ...metersToDegrees(extent.xmin, extent.ymin),
	                ...metersToDegrees(extent.xmax, extent.ymax),
	            ];
	        }
	        else {
	            try {
	                const projected = await projectExtent(extent);
	                bounds = [
	                    projected.xmin,
	                    projected.ymin,
	                    projected.xmax,
	                    projected.ymax,
	                ];
	            }
	            catch (e) {
	                console.error(e);
	                return;
	            }
	        }
	        if (bounds) {
	            const [xmin, ymin, xmax, ymax] = bounds;
	            if (xmin === xmax || ymin === ymax) {
	                return;
	            }
	            else if (Math.abs(ymax - ymin) < 0.001 ||
	                Math.abs(xmax - xmin) < 0.001) {
	                return;
	            }
	            else {
	                if (bounds) {
	                    bounds = enforceBoundsMinMax(bounds);
	                }
	                return bounds;
	            }
	        }
	        else {
	            return;
	        }
	    }
	}
	function enforceBoundsMinMax(bounds) {
	    const [xmin, ymin, xmax, ymax] = bounds;
	    return [
	        Math.max(-180, xmin),
	        Math.max(-90, ymin),
	        Math.min(180, xmax),
	        Math.min(90, ymax),
	    ];
	}
	function normalizeSpatialReference(sr) {
	    const wkid = "latestWkid" in sr ? sr.latestWkid : "wkid" in sr ? sr.wkid : -1;
	    if (typeof wkid === "string") {
	        if (/WGS\s*84/.test(wkid)) {
	            return 4326;
	        }
	        else {
	            return -1;
	        }
	    }
	    else {
	        return wkid || -1;
	    }
	}
	async function projectExtent(extent) {
	    const endpoint = "https://tasks.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer/project";
	    const params = new URLSearchParams({
	        geometries: JSON.stringify({
	            geometryType: "esriGeometryEnvelope",
	            geometries: [extent],
	        }),
	        inSR: `${extent.spatialReference.wkid}`,
	        outSR: "4326",
	        f: "json",
	    });
	    const response = await fetch(`${endpoint}?${params.toString()}`);
	    const data = await response.json();
	    const projected = data.geometries[0];
	    if (projected) {
	        return projected;
	    }
	    else {
	        throw new Error("Failed to reproject");
	    }
	}
	function contentOrFalse(str) {
	    if (str && str.length > 0) {
	        return str;
	    }
	    else {
	        return false;
	    }
	}
	function pickDescription(info, layer) {
	    var _a, _b;
	    return (contentOrFalse(layer === null || layer === void 0 ? void 0 : layer.description) ||
	        contentOrFalse(info.description) ||
	        contentOrFalse((_a = info.documentInfo) === null || _a === void 0 ? void 0 : _a.Subject) ||
	        contentOrFalse((_b = info.documentInfo) === null || _b === void 0 ? void 0 : _b.Comments));
	}
	function generateMetadataForLayer(url, mapServerInfo, layer) {
	    var _a, _b, _c, _d;
	    const attribution = contentOrFalse(layer.copyrightText) ||
	        contentOrFalse(mapServerInfo.copyrightText) ||
	        contentOrFalse((_a = mapServerInfo.documentInfo) === null || _a === void 0 ? void 0 : _a.Author);
	    const description = pickDescription(mapServerInfo, layer);
	    let keywords = ((_b = mapServerInfo.documentInfo) === null || _b === void 0 ? void 0 : _b.Keywords) &&
	        ((_c = mapServerInfo.documentInfo) === null || _c === void 0 ? void 0 : _c.Keywords.length)
	        ? (_d = mapServerInfo.documentInfo) === null || _d === void 0 ? void 0 : _d.Keywords.split(",")
	        : [];
	    return {
	        type: "doc",
	        content: [
	            {
	                type: "heading",
	                attrs: { level: 1 },
	                content: [{ type: "text", text: layer.name }],
	            },
	            ...(description
	                ? [
	                    {
	                        type: "paragraph",
	                        content: [
	                            {
	                                type: "text",
	                                text: description,
	                            },
	                        ],
	                    },
	                ]
	                : []),
	            ...(attribution
	                ? [
	                    { type: "paragraph" },
	                    {
	                        type: "heading",
	                        attrs: { level: 3 },
	                        content: [{ type: "text", text: "Attribution" }],
	                    },
	                    {
	                        type: "paragraph",
	                        content: [
	                            {
	                                type: "text",
	                                text: attribution,
	                            },
	                        ],
	                    },
	                ]
	                : []),
	            ...(keywords && keywords.length
	                ? [
	                    { type: "paragraph" },
	                    {
	                        type: "heading",
	                        attrs: { level: 3 },
	                        content: [
	                            {
	                                type: "text",
	                                text: "Keywords",
	                            },
	                        ],
	                    },
	                    {
	                        type: "bullet_list",
	                        marks: [],
	                        attrs: {},
	                        content: keywords.map((word) => ({
	                            type: "list_item",
	                            content: [
	                                {
	                                    type: "paragraph",
	                                    content: [{ type: "text", text: word }],
	                                },
	                            ],
	                        })),
	                    },
	                ]
	                : []),
	            { type: "paragraph" },
	            {
	                type: "paragraph",
	                content: [
	                    {
	                        type: "text",
	                        marks: [
	                            {
	                                type: "link",
	                                attrs: {
	                                    href: url,
	                                    title: "ArcGIS Server",
	                                },
	                            },
	                        ],
	                        text: url,
	                    },
	                ],
	            },
	        ],
	    };
	}
	function makeLegend(data, layerId) {
	    const legendLayer = data.layers.find((l) => l.layerId === layerId);
	    if (legendLayer) {
	        return legendLayer.legend.map((legend) => {
	            return {
	                id: legend.url,
	                label: legend.label && legend.label.length > 0
	                    ? legend.label
	                    : legendLayer.legend.length === 1
	                        ? legendLayer.layerName
	                        : "",
	                imageUrl: (legend === null || legend === void 0 ? void 0 : legend.imageData)
	                    ? `data:${legend.contentType};base64,${legend.imageData}`
	                    : blankDataUri,
	                imageWidth: 20,
	                imageHeight: 20,
	            };
	        });
	    }
	    else {
	        return undefined;
	    }
	}
	});

	var earthRadius = 6371008.8;
	var factors = {
	    centimeters: earthRadius * 100,
	    centimetres: earthRadius * 100,
	    degrees: earthRadius / 111325,
	    feet: earthRadius * 3.28084,
	    inches: earthRadius * 39.37,
	    kilometers: earthRadius / 1000,
	    kilometres: earthRadius / 1000,
	    meters: earthRadius,
	    metres: earthRadius,
	    miles: earthRadius / 1609.344,
	    millimeters: earthRadius * 1000,
	    millimetres: earthRadius * 1000,
	    nauticalmiles: earthRadius / 1852,
	    radians: 1,
	    yards: earthRadius * 1.0936,
	};
	var unitsFactors = {
	    centimeters: 100,
	    centimetres: 100,
	    degrees: 1 / 111325,
	    feet: 3.28084,
	    inches: 39.37,
	    kilometers: 1 / 1000,
	    kilometres: 1 / 1000,
	    meters: 1,
	    metres: 1,
	    miles: 1 / 1609.344,
	    millimeters: 1000,
	    millimetres: 1000,
	    nauticalmiles: 1 / 1852,
	    radians: 1 / earthRadius,
	    yards: 1.0936133,
	};
	var areaFactors = {
	    acres: 0.000247105,
	    centimeters: 10000,
	    centimetres: 10000,
	    feet: 10.763910417,
	    hectares: 0.0001,
	    inches: 1550.003100006,
	    kilometers: 0.000001,
	    kilometres: 0.000001,
	    meters: 1,
	    metres: 1,
	    miles: 3.86e-7,
	    millimeters: 1000000,
	    millimetres: 1000000,
	    yards: 1.195990046,
	};
	function feature(geom, properties, options) {
	    if (options === void 0) { options = {}; }
	    var feat = { type: "Feature" };
	    if (options.id === 0 || options.id) {
	        feat.id = options.id;
	    }
	    if (options.bbox) {
	        feat.bbox = options.bbox;
	    }
	    feat.properties = properties || {};
	    feat.geometry = geom;
	    return feat;
	}
	function geometry(type, coordinates, _options) {
	    switch (type) {
	        case "Point":
	            return point(coordinates).geometry;
	        case "LineString":
	            return lineString(coordinates).geometry;
	        case "Polygon":
	            return polygon(coordinates).geometry;
	        case "MultiPoint":
	            return multiPoint(coordinates).geometry;
	        case "MultiLineString":
	            return multiLineString(coordinates).geometry;
	        case "MultiPolygon":
	            return multiPolygon(coordinates).geometry;
	        default:
	            throw new Error(type + " is invalid");
	    }
	}
	function point(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    if (!coordinates) {
	        throw new Error("coordinates is required");
	    }
	    if (!Array.isArray(coordinates)) {
	        throw new Error("coordinates must be an Array");
	    }
	    if (coordinates.length < 2) {
	        throw new Error("coordinates must be at least 2 numbers long");
	    }
	    if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
	        throw new Error("coordinates must contain numbers");
	    }
	    var geom = {
	        type: "Point",
	        coordinates: coordinates,
	    };
	    return feature(geom, properties, options);
	}
	function points(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    return featureCollection$1(coordinates.map(function (coords) {
	        return point(coords, properties);
	    }), options);
	}
	function polygon(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
	        var ring = coordinates_1[_i];
	        if (ring.length < 4) {
	            throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");
	        }
	        for (var j = 0; j < ring[ring.length - 1].length; j++) {
	            if (ring[ring.length - 1][j] !== ring[0][j]) {
	                throw new Error("First and last Position are not equivalent.");
	            }
	        }
	    }
	    var geom = {
	        type: "Polygon",
	        coordinates: coordinates,
	    };
	    return feature(geom, properties, options);
	}
	function polygons(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    return featureCollection$1(coordinates.map(function (coords) {
	        return polygon(coords, properties);
	    }), options);
	}
	function lineString(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    if (coordinates.length < 2) {
	        throw new Error("coordinates must be an array of two or more positions");
	    }
	    var geom = {
	        type: "LineString",
	        coordinates: coordinates,
	    };
	    return feature(geom, properties, options);
	}
	function lineStrings(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    return featureCollection$1(coordinates.map(function (coords) {
	        return lineString(coords, properties);
	    }), options);
	}
	function featureCollection$1(features, options) {
	    if (options === void 0) { options = {}; }
	    var fc = { type: "FeatureCollection" };
	    if (options.id) {
	        fc.id = options.id;
	    }
	    if (options.bbox) {
	        fc.bbox = options.bbox;
	    }
	    fc.features = features;
	    return fc;
	}
	function multiLineString(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    var geom = {
	        type: "MultiLineString",
	        coordinates: coordinates,
	    };
	    return feature(geom, properties, options);
	}
	function multiPoint(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    var geom = {
	        type: "MultiPoint",
	        coordinates: coordinates,
	    };
	    return feature(geom, properties, options);
	}
	function multiPolygon(coordinates, properties, options) {
	    if (options === void 0) { options = {}; }
	    var geom = {
	        type: "MultiPolygon",
	        coordinates: coordinates,
	    };
	    return feature(geom, properties, options);
	}
	function geometryCollection(geometries, properties, options) {
	    if (options === void 0) { options = {}; }
	    var geom = {
	        type: "GeometryCollection",
	        geometries: geometries,
	    };
	    return feature(geom, properties, options);
	}
	function round(num, precision) {
	    if (precision === void 0) { precision = 0; }
	    if (precision && !(precision >= 0)) {
	        throw new Error("precision must be a positive number");
	    }
	    var multiplier = Math.pow(10, precision || 0);
	    return Math.round(num * multiplier) / multiplier;
	}
	function radiansToLength(radians, units) {
	    if (units === void 0) { units = "kilometers"; }
	    var factor = factors[units];
	    if (!factor) {
	        throw new Error(units + " units is invalid");
	    }
	    return radians * factor;
	}
	function lengthToRadians(distance, units) {
	    if (units === void 0) { units = "kilometers"; }
	    var factor = factors[units];
	    if (!factor) {
	        throw new Error(units + " units is invalid");
	    }
	    return distance / factor;
	}
	function lengthToDegrees(distance, units) {
	    return radiansToDegrees(lengthToRadians(distance, units));
	}
	function bearingToAzimuth(bearing) {
	    var angle = bearing % 360;
	    if (angle < 0) {
	        angle += 360;
	    }
	    return angle;
	}
	function radiansToDegrees(radians) {
	    var degrees = radians % (2 * Math.PI);
	    return (degrees * 180) / Math.PI;
	}
	function degreesToRadians(degrees) {
	    var radians = degrees % 360;
	    return (radians * Math.PI) / 180;
	}
	function convertLength(length, originalUnit, finalUnit) {
	    if (originalUnit === void 0) { originalUnit = "kilometers"; }
	    if (finalUnit === void 0) { finalUnit = "kilometers"; }
	    if (!(length >= 0)) {
	        throw new Error("length must be a positive number");
	    }
	    return radiansToLength(lengthToRadians(length, originalUnit), finalUnit);
	}
	function convertArea(area, originalUnit, finalUnit) {
	    if (originalUnit === void 0) { originalUnit = "meters"; }
	    if (finalUnit === void 0) { finalUnit = "kilometers"; }
	    if (!(area >= 0)) {
	        throw new Error("area must be a positive number");
	    }
	    var startFactor = areaFactors[originalUnit];
	    if (!startFactor) {
	        throw new Error("invalid original units");
	    }
	    var finalFactor = areaFactors[finalUnit];
	    if (!finalFactor) {
	        throw new Error("invalid final units");
	    }
	    return (area / startFactor) * finalFactor;
	}
	function isNumber(num) {
	    return !isNaN(num) && num !== null && !Array.isArray(num);
	}
	function isObject$1(input) {
	    return !!input && input.constructor === Object;
	}
	function validateBBox(bbox) {
	    if (!bbox) {
	        throw new Error("bbox is required");
	    }
	    if (!Array.isArray(bbox)) {
	        throw new Error("bbox must be an Array");
	    }
	    if (bbox.length !== 4 && bbox.length !== 6) {
	        throw new Error("bbox must be an Array of 4 or 6 numbers");
	    }
	    bbox.forEach(function (num) {
	        if (!isNumber(num)) {
	            throw new Error("bbox must only contain numbers");
	        }
	    });
	}
	function validateId(id) {
	    if (!id) {
	        throw new Error("id is required");
	    }
	    if (["string", "number"].indexOf(typeof id) === -1) {
	        throw new Error("id must be a number or a string");
	    }
	}

	var es$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		earthRadius: earthRadius,
		factors: factors,
		unitsFactors: unitsFactors,
		areaFactors: areaFactors,
		feature: feature,
		geometry: geometry,
		point: point,
		points: points,
		polygon: polygon,
		polygons: polygons,
		lineString: lineString,
		lineStrings: lineStrings,
		featureCollection: featureCollection$1,
		multiLineString: multiLineString,
		multiPoint: multiPoint,
		multiPolygon: multiPolygon,
		geometryCollection: geometryCollection,
		round: round,
		radiansToLength: radiansToLength,
		lengthToRadians: lengthToRadians,
		lengthToDegrees: lengthToDegrees,
		bearingToAzimuth: bearingToAzimuth,
		radiansToDegrees: radiansToDegrees,
		degreesToRadians: degreesToRadians,
		convertLength: convertLength,
		convertArea: convertArea,
		isNumber: isNumber,
		isObject: isObject$1,
		validateBBox: validateBBox,
		validateId: validateId
	});

	function getCoord(coord) {
	    if (!coord) {
	        throw new Error("coord is required");
	    }
	    if (!Array.isArray(coord)) {
	        if (coord.type === "Feature" &&
	            coord.geometry !== null &&
	            coord.geometry.type === "Point") {
	            return coord.geometry.coordinates;
	        }
	        if (coord.type === "Point") {
	            return coord.coordinates;
	        }
	    }
	    if (Array.isArray(coord) &&
	        coord.length >= 2 &&
	        !Array.isArray(coord[0]) &&
	        !Array.isArray(coord[1])) {
	        return coord;
	    }
	    throw new Error("coord must be GeoJSON Point or an Array of numbers");
	}
	function getCoords(coords) {
	    if (Array.isArray(coords)) {
	        return coords;
	    }
	    if (coords.type === "Feature") {
	        if (coords.geometry !== null) {
	            return coords.geometry.coordinates;
	        }
	    }
	    else {
	        if (coords.coordinates) {
	            return coords.coordinates;
	        }
	    }
	    throw new Error("coords must be GeoJSON Feature, Geometry Object or an Array");
	}
	function getGeom(geojson) {
	    if (geojson.type === "Feature") {
	        return geojson.geometry;
	    }
	    return geojson;
	}

	function booleanPointInPolygon(point, polygon, options) {
	    if (options === void 0) { options = {}; }
	    if (!point) {
	        throw new Error("point is required");
	    }
	    if (!polygon) {
	        throw new Error("polygon is required");
	    }
	    var pt = getCoord(point);
	    var geom = getGeom(polygon);
	    var type = geom.type;
	    var bbox = polygon.bbox;
	    var polys = geom.coordinates;
	    if (bbox && inBBox(pt, bbox) === false) {
	        return false;
	    }
	    if (type === "Polygon") {
	        polys = [polys];
	    }
	    var insidePoly = false;
	    for (var i = 0; i < polys.length && !insidePoly; i++) {
	        if (inRing(pt, polys[i][0], options.ignoreBoundary)) {
	            var inHole = false;
	            var k = 1;
	            while (k < polys[i].length && !inHole) {
	                if (inRing(pt, polys[i][k], !options.ignoreBoundary)) {
	                    inHole = true;
	                }
	                k++;
	            }
	            if (!inHole) {
	                insidePoly = true;
	            }
	        }
	    }
	    return insidePoly;
	}
	function inRing(pt, ring, ignoreBoundary) {
	    var isInside = false;
	    if (ring[0][0] === ring[ring.length - 1][0] &&
	        ring[0][1] === ring[ring.length - 1][1]) {
	        ring = ring.slice(0, ring.length - 1);
	    }
	    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
	        var xi = ring[i][0];
	        var yi = ring[i][1];
	        var xj = ring[j][0];
	        var yj = ring[j][1];
	        var onBoundary = pt[1] * (xi - xj) + yi * (xj - pt[0]) + yj * (pt[0] - xi) === 0 &&
	            (xi - pt[0]) * (xj - pt[0]) <= 0 &&
	            (yi - pt[1]) * (yj - pt[1]) <= 0;
	        if (onBoundary) {
	            return !ignoreBoundary;
	        }
	        var intersect = yi > pt[1] !== yj > pt[1] &&
	            pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
	        if (intersect) {
	            isInside = !isInside;
	        }
	    }
	    return isInside;
	}
	function inBBox(pt, bbox) {
	    return (bbox[0] <= pt[0] && bbox[1] <= pt[1] && bbox[2] >= pt[0] && bbox[3] >= pt[1]);
	}

	function coordEach(geojson, callback, excludeWrapCoord) {
	  if (geojson === null) return;
	  var j,
	    k,
	    l,
	    geometry,
	    stopG,
	    coords,
	    geometryMaybeCollection,
	    wrapShrink = 0,
	    coordIndex = 0,
	    isGeometryCollection,
	    type = geojson.type,
	    isFeatureCollection = type === "FeatureCollection",
	    isFeature = type === "Feature",
	    stop = isFeatureCollection ? geojson.features.length : 1;
	  for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
	    geometryMaybeCollection = isFeatureCollection
	      ? geojson.features[featureIndex].geometry
	      : isFeature
	      ? geojson.geometry
	      : geojson;
	    isGeometryCollection = geometryMaybeCollection
	      ? geometryMaybeCollection.type === "GeometryCollection"
	      : false;
	    stopG = isGeometryCollection
	      ? geometryMaybeCollection.geometries.length
	      : 1;
	    for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
	      var multiFeatureIndex = 0;
	      var geometryIndex = 0;
	      geometry = isGeometryCollection
	        ? geometryMaybeCollection.geometries[geomIndex]
	        : geometryMaybeCollection;
	      if (geometry === null) continue;
	      coords = geometry.coordinates;
	      var geomType = geometry.type;
	      wrapShrink =
	        excludeWrapCoord &&
	        (geomType === "Polygon" || geomType === "MultiPolygon")
	          ? 1
	          : 0;
	      switch (geomType) {
	        case null:
	          break;
	        case "Point":
	          if (
	            callback(
	              coords,
	              coordIndex,
	              featureIndex,
	              multiFeatureIndex,
	              geometryIndex
	            ) === false
	          )
	            return false;
	          coordIndex++;
	          multiFeatureIndex++;
	          break;
	        case "LineString":
	        case "MultiPoint":
	          for (j = 0; j < coords.length; j++) {
	            if (
	              callback(
	                coords[j],
	                coordIndex,
	                featureIndex,
	                multiFeatureIndex,
	                geometryIndex
	              ) === false
	            )
	              return false;
	            coordIndex++;
	            if (geomType === "MultiPoint") multiFeatureIndex++;
	          }
	          if (geomType === "LineString") multiFeatureIndex++;
	          break;
	        case "Polygon":
	        case "MultiLineString":
	          for (j = 0; j < coords.length; j++) {
	            for (k = 0; k < coords[j].length - wrapShrink; k++) {
	              if (
	                callback(
	                  coords[j][k],
	                  coordIndex,
	                  featureIndex,
	                  multiFeatureIndex,
	                  geometryIndex
	                ) === false
	              )
	                return false;
	              coordIndex++;
	            }
	            if (geomType === "MultiLineString") multiFeatureIndex++;
	            if (geomType === "Polygon") geometryIndex++;
	          }
	          if (geomType === "Polygon") multiFeatureIndex++;
	          break;
	        case "MultiPolygon":
	          for (j = 0; j < coords.length; j++) {
	            geometryIndex = 0;
	            for (k = 0; k < coords[j].length; k++) {
	              for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
	                if (
	                  callback(
	                    coords[j][k][l],
	                    coordIndex,
	                    featureIndex,
	                    multiFeatureIndex,
	                    geometryIndex
	                  ) === false
	                )
	                  return false;
	                coordIndex++;
	              }
	              geometryIndex++;
	            }
	            multiFeatureIndex++;
	          }
	          break;
	        case "GeometryCollection":
	          for (j = 0; j < geometry.geometries.length; j++)
	            if (
	              coordEach(geometry.geometries[j], callback, excludeWrapCoord) ===
	              false
	            )
	              return false;
	          break;
	        default:
	          throw new Error("Unknown Geometry Type");
	      }
	    }
	  }
	}
	function coordReduce(geojson, callback, initialValue, excludeWrapCoord) {
	  var previousValue = initialValue;
	  coordEach(
	    geojson,
	    function (
	      currentCoord,
	      coordIndex,
	      featureIndex,
	      multiFeatureIndex,
	      geometryIndex
	    ) {
	      if (coordIndex === 0 && initialValue === undefined)
	        previousValue = currentCoord;
	      else
	        previousValue = callback(
	          previousValue,
	          currentCoord,
	          coordIndex,
	          featureIndex,
	          multiFeatureIndex,
	          geometryIndex
	        );
	    },
	    excludeWrapCoord
	  );
	  return previousValue;
	}
	function propEach(geojson, callback) {
	  var i;
	  switch (geojson.type) {
	    case "FeatureCollection":
	      for (i = 0; i < geojson.features.length; i++) {
	        if (callback(geojson.features[i].properties, i) === false) break;
	      }
	      break;
	    case "Feature":
	      callback(geojson.properties, 0);
	      break;
	  }
	}
	function propReduce(geojson, callback, initialValue) {
	  var previousValue = initialValue;
	  propEach(geojson, function (currentProperties, featureIndex) {
	    if (featureIndex === 0 && initialValue === undefined)
	      previousValue = currentProperties;
	    else
	      previousValue = callback(previousValue, currentProperties, featureIndex);
	  });
	  return previousValue;
	}
	function featureEach$1(geojson, callback) {
	  if (geojson.type === "Feature") {
	    callback(geojson, 0);
	  } else if (geojson.type === "FeatureCollection") {
	    for (var i = 0; i < geojson.features.length; i++) {
	      if (callback(geojson.features[i], i) === false) break;
	    }
	  }
	}
	function featureReduce(geojson, callback, initialValue) {
	  var previousValue = initialValue;
	  featureEach$1(geojson, function (currentFeature, featureIndex) {
	    if (featureIndex === 0 && initialValue === undefined)
	      previousValue = currentFeature;
	    else previousValue = callback(previousValue, currentFeature, featureIndex);
	  });
	  return previousValue;
	}
	function coordAll(geojson) {
	  var coords = [];
	  coordEach(geojson, function (coord) {
	    coords.push(coord);
	  });
	  return coords;
	}
	function geomEach(geojson, callback) {
	  var i,
	    j,
	    g,
	    geometry,
	    stopG,
	    geometryMaybeCollection,
	    isGeometryCollection,
	    featureProperties,
	    featureBBox,
	    featureId,
	    featureIndex = 0,
	    isFeatureCollection = geojson.type === "FeatureCollection",
	    isFeature = geojson.type === "Feature",
	    stop = isFeatureCollection ? geojson.features.length : 1;
	  for (i = 0; i < stop; i++) {
	    geometryMaybeCollection = isFeatureCollection
	      ? geojson.features[i].geometry
	      : isFeature
	      ? geojson.geometry
	      : geojson;
	    featureProperties = isFeatureCollection
	      ? geojson.features[i].properties
	      : isFeature
	      ? geojson.properties
	      : {};
	    featureBBox = isFeatureCollection
	      ? geojson.features[i].bbox
	      : isFeature
	      ? geojson.bbox
	      : undefined;
	    featureId = isFeatureCollection
	      ? geojson.features[i].id
	      : isFeature
	      ? geojson.id
	      : undefined;
	    isGeometryCollection = geometryMaybeCollection
	      ? geometryMaybeCollection.type === "GeometryCollection"
	      : false;
	    stopG = isGeometryCollection
	      ? geometryMaybeCollection.geometries.length
	      : 1;
	    for (g = 0; g < stopG; g++) {
	      geometry = isGeometryCollection
	        ? geometryMaybeCollection.geometries[g]
	        : geometryMaybeCollection;
	      if (geometry === null) {
	        if (
	          callback(
	            null,
	            featureIndex,
	            featureProperties,
	            featureBBox,
	            featureId
	          ) === false
	        )
	          return false;
	        continue;
	      }
	      switch (geometry.type) {
	        case "Point":
	        case "LineString":
	        case "MultiPoint":
	        case "Polygon":
	        case "MultiLineString":
	        case "MultiPolygon": {
	          if (
	            callback(
	              geometry,
	              featureIndex,
	              featureProperties,
	              featureBBox,
	              featureId
	            ) === false
	          )
	            return false;
	          break;
	        }
	        case "GeometryCollection": {
	          for (j = 0; j < geometry.geometries.length; j++) {
	            if (
	              callback(
	                geometry.geometries[j],
	                featureIndex,
	                featureProperties,
	                featureBBox,
	                featureId
	              ) === false
	            )
	              return false;
	          }
	          break;
	        }
	        default:
	          throw new Error("Unknown Geometry Type");
	      }
	    }
	    featureIndex++;
	  }
	}
	function geomReduce(geojson, callback, initialValue) {
	  var previousValue = initialValue;
	  geomEach(
	    geojson,
	    function (
	      currentGeometry,
	      featureIndex,
	      featureProperties,
	      featureBBox,
	      featureId
	    ) {
	      if (featureIndex === 0 && initialValue === undefined)
	        previousValue = currentGeometry;
	      else
	        previousValue = callback(
	          previousValue,
	          currentGeometry,
	          featureIndex,
	          featureProperties,
	          featureBBox,
	          featureId
	        );
	    }
	  );
	  return previousValue;
	}
	function flattenEach(geojson, callback) {
	  geomEach(geojson, function (geometry, featureIndex, properties, bbox, id) {
	    var type = geometry === null ? null : geometry.type;
	    switch (type) {
	      case null:
	      case "Point":
	      case "LineString":
	      case "Polygon":
	        if (
	          callback(
	            feature(geometry, properties, { bbox: bbox, id: id }),
	            featureIndex,
	            0
	          ) === false
	        )
	          return false;
	        return;
	    }
	    var geomType;
	    switch (type) {
	      case "MultiPoint":
	        geomType = "Point";
	        break;
	      case "MultiLineString":
	        geomType = "LineString";
	        break;
	      case "MultiPolygon":
	        geomType = "Polygon";
	        break;
	    }
	    for (
	      var multiFeatureIndex = 0;
	      multiFeatureIndex < geometry.coordinates.length;
	      multiFeatureIndex++
	    ) {
	      var coordinate = geometry.coordinates[multiFeatureIndex];
	      var geom = {
	        type: geomType,
	        coordinates: coordinate,
	      };
	      if (
	        callback(feature(geom, properties), featureIndex, multiFeatureIndex) ===
	        false
	      )
	        return false;
	    }
	  });
	}
	function flattenReduce(geojson, callback, initialValue) {
	  var previousValue = initialValue;
	  flattenEach(
	    geojson,
	    function (currentFeature, featureIndex, multiFeatureIndex) {
	      if (
	        featureIndex === 0 &&
	        multiFeatureIndex === 0 &&
	        initialValue === undefined
	      )
	        previousValue = currentFeature;
	      else
	        previousValue = callback(
	          previousValue,
	          currentFeature,
	          featureIndex,
	          multiFeatureIndex
	        );
	    }
	  );
	  return previousValue;
	}
	function segmentEach(geojson, callback) {
	  flattenEach(geojson, function (feature, featureIndex, multiFeatureIndex) {
	    var segmentIndex = 0;
	    if (!feature.geometry) return;
	    var type = feature.geometry.type;
	    if (type === "Point" || type === "MultiPoint") return;
	    var previousCoords;
	    var previousFeatureIndex = 0;
	    var previousMultiIndex = 0;
	    var prevGeomIndex = 0;
	    if (
	      coordEach(
	        feature,
	        function (
	          currentCoord,
	          coordIndex,
	          featureIndexCoord,
	          multiPartIndexCoord,
	          geometryIndex
	        ) {
	          if (
	            previousCoords === undefined ||
	            featureIndex > previousFeatureIndex ||
	            multiPartIndexCoord > previousMultiIndex ||
	            geometryIndex > prevGeomIndex
	          ) {
	            previousCoords = currentCoord;
	            previousFeatureIndex = featureIndex;
	            previousMultiIndex = multiPartIndexCoord;
	            prevGeomIndex = geometryIndex;
	            segmentIndex = 0;
	            return;
	          }
	          var currentSegment = lineString(
	            [previousCoords, currentCoord],
	            feature.properties
	          );
	          if (
	            callback(
	              currentSegment,
	              featureIndex,
	              multiFeatureIndex,
	              geometryIndex,
	              segmentIndex
	            ) === false
	          )
	            return false;
	          segmentIndex++;
	          previousCoords = currentCoord;
	        }
	      ) === false
	    )
	      return false;
	  });
	}
	function segmentReduce(geojson, callback, initialValue) {
	  var previousValue = initialValue;
	  var started = false;
	  segmentEach(
	    geojson,
	    function (
	      currentSegment,
	      featureIndex,
	      multiFeatureIndex,
	      geometryIndex,
	      segmentIndex
	    ) {
	      if (started === false && initialValue === undefined)
	        previousValue = currentSegment;
	      else
	        previousValue = callback(
	          previousValue,
	          currentSegment,
	          featureIndex,
	          multiFeatureIndex,
	          geometryIndex,
	          segmentIndex
	        );
	      started = true;
	    }
	  );
	  return previousValue;
	}
	function lineEach(geojson, callback) {
	  if (!geojson) throw new Error("geojson is required");
	  flattenEach(geojson, function (feature, featureIndex, multiFeatureIndex) {
	    if (feature.geometry === null) return;
	    var type = feature.geometry.type;
	    var coords = feature.geometry.coordinates;
	    switch (type) {
	      case "LineString":
	        if (callback(feature, featureIndex, multiFeatureIndex, 0, 0) === false)
	          return false;
	        break;
	      case "Polygon":
	        for (
	          var geometryIndex = 0;
	          geometryIndex < coords.length;
	          geometryIndex++
	        ) {
	          if (
	            callback(
	              lineString(coords[geometryIndex], feature.properties),
	              featureIndex,
	              multiFeatureIndex,
	              geometryIndex
	            ) === false
	          )
	            return false;
	        }
	        break;
	    }
	  });
	}
	function lineReduce(geojson, callback, initialValue) {
	  var previousValue = initialValue;
	  lineEach(
	    geojson,
	    function (currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
	      if (featureIndex === 0 && initialValue === undefined)
	        previousValue = currentLine;
	      else
	        previousValue = callback(
	          previousValue,
	          currentLine,
	          featureIndex,
	          multiFeatureIndex,
	          geometryIndex
	        );
	    }
	  );
	  return previousValue;
	}
	function findSegment(geojson, options) {
	  options = options || {};
	  if (!isObject$1(options)) throw new Error("options is invalid");
	  var featureIndex = options.featureIndex || 0;
	  var multiFeatureIndex = options.multiFeatureIndex || 0;
	  var geometryIndex = options.geometryIndex || 0;
	  var segmentIndex = options.segmentIndex || 0;
	  var properties = options.properties;
	  var geometry;
	  switch (geojson.type) {
	    case "FeatureCollection":
	      if (featureIndex < 0)
	        featureIndex = geojson.features.length + featureIndex;
	      properties = properties || geojson.features[featureIndex].properties;
	      geometry = geojson.features[featureIndex].geometry;
	      break;
	    case "Feature":
	      properties = properties || geojson.properties;
	      geometry = geojson.geometry;
	      break;
	    case "Point":
	    case "MultiPoint":
	      return null;
	    case "LineString":
	    case "Polygon":
	    case "MultiLineString":
	    case "MultiPolygon":
	      geometry = geojson;
	      break;
	    default:
	      throw new Error("geojson is invalid");
	  }
	  if (geometry === null) return null;
	  var coords = geometry.coordinates;
	  switch (geometry.type) {
	    case "Point":
	    case "MultiPoint":
	      return null;
	    case "LineString":
	      if (segmentIndex < 0) segmentIndex = coords.length + segmentIndex - 1;
	      return lineString(
	        [coords[segmentIndex], coords[segmentIndex + 1]],
	        properties,
	        options
	      );
	    case "Polygon":
	      if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
	      if (segmentIndex < 0)
	        segmentIndex = coords[geometryIndex].length + segmentIndex - 1;
	      return lineString(
	        [
	          coords[geometryIndex][segmentIndex],
	          coords[geometryIndex][segmentIndex + 1],
	        ],
	        properties,
	        options
	      );
	    case "MultiLineString":
	      if (multiFeatureIndex < 0)
	        multiFeatureIndex = coords.length + multiFeatureIndex;
	      if (segmentIndex < 0)
	        segmentIndex = coords[multiFeatureIndex].length + segmentIndex - 1;
	      return lineString(
	        [
	          coords[multiFeatureIndex][segmentIndex],
	          coords[multiFeatureIndex][segmentIndex + 1],
	        ],
	        properties,
	        options
	      );
	    case "MultiPolygon":
	      if (multiFeatureIndex < 0)
	        multiFeatureIndex = coords.length + multiFeatureIndex;
	      if (geometryIndex < 0)
	        geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
	      if (segmentIndex < 0)
	        segmentIndex =
	          coords[multiFeatureIndex][geometryIndex].length - segmentIndex - 1;
	      return lineString(
	        [
	          coords[multiFeatureIndex][geometryIndex][segmentIndex],
	          coords[multiFeatureIndex][geometryIndex][segmentIndex + 1],
	        ],
	        properties,
	        options
	      );
	  }
	  throw new Error("geojson is invalid");
	}
	function findPoint(geojson, options) {
	  options = options || {};
	  if (!isObject$1(options)) throw new Error("options is invalid");
	  var featureIndex = options.featureIndex || 0;
	  var multiFeatureIndex = options.multiFeatureIndex || 0;
	  var geometryIndex = options.geometryIndex || 0;
	  var coordIndex = options.coordIndex || 0;
	  var properties = options.properties;
	  var geometry;
	  switch (geojson.type) {
	    case "FeatureCollection":
	      if (featureIndex < 0)
	        featureIndex = geojson.features.length + featureIndex;
	      properties = properties || geojson.features[featureIndex].properties;
	      geometry = geojson.features[featureIndex].geometry;
	      break;
	    case "Feature":
	      properties = properties || geojson.properties;
	      geometry = geojson.geometry;
	      break;
	    case "Point":
	    case "MultiPoint":
	      return null;
	    case "LineString":
	    case "Polygon":
	    case "MultiLineString":
	    case "MultiPolygon":
	      geometry = geojson;
	      break;
	    default:
	      throw new Error("geojson is invalid");
	  }
	  if (geometry === null) return null;
	  var coords = geometry.coordinates;
	  switch (geometry.type) {
	    case "Point":
	      return point(coords, properties, options);
	    case "MultiPoint":
	      if (multiFeatureIndex < 0)
	        multiFeatureIndex = coords.length + multiFeatureIndex;
	      return point(coords[multiFeatureIndex], properties, options);
	    case "LineString":
	      if (coordIndex < 0) coordIndex = coords.length + coordIndex;
	      return point(coords[coordIndex], properties, options);
	    case "Polygon":
	      if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
	      if (coordIndex < 0)
	        coordIndex = coords[geometryIndex].length + coordIndex;
	      return point(coords[geometryIndex][coordIndex], properties, options);
	    case "MultiLineString":
	      if (multiFeatureIndex < 0)
	        multiFeatureIndex = coords.length + multiFeatureIndex;
	      if (coordIndex < 0)
	        coordIndex = coords[multiFeatureIndex].length + coordIndex;
	      return point(coords[multiFeatureIndex][coordIndex], properties, options);
	    case "MultiPolygon":
	      if (multiFeatureIndex < 0)
	        multiFeatureIndex = coords.length + multiFeatureIndex;
	      if (geometryIndex < 0)
	        geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
	      if (coordIndex < 0)
	        coordIndex =
	          coords[multiFeatureIndex][geometryIndex].length - coordIndex;
	      return point(
	        coords[multiFeatureIndex][geometryIndex][coordIndex],
	        properties,
	        options
	      );
	  }
	  throw new Error("geojson is invalid");
	}

	var es = /*#__PURE__*/Object.freeze({
		__proto__: null,
		coordAll: coordAll,
		coordEach: coordEach,
		coordReduce: coordReduce,
		featureEach: featureEach$1,
		featureReduce: featureReduce,
		findPoint: findPoint,
		findSegment: findSegment,
		flattenEach: flattenEach,
		flattenReduce: flattenReduce,
		geomEach: geomEach,
		geomReduce: geomReduce,
		lineEach: lineEach,
		lineReduce: lineReduce,
		propEach: propEach,
		propReduce: propReduce,
		segmentEach: segmentEach,
		segmentReduce: segmentReduce
	});

	function lineSegment(geojson) {
	    if (!geojson) {
	        throw new Error("geojson is required");
	    }
	    var results = [];
	    flattenEach(geojson, function (feature) {
	        lineSegmentFeature(feature, results);
	    });
	    return featureCollection$1(results);
	}
	function lineSegmentFeature(geojson, results) {
	    var coords = [];
	    var geometry = geojson.geometry;
	    if (geometry !== null) {
	        switch (geometry.type) {
	            case "Polygon":
	                coords = getCoords(geometry);
	                break;
	            case "LineString":
	                coords = [getCoords(geometry)];
	        }
	        coords.forEach(function (coord) {
	            var segments = createSegments(coord, geojson.properties);
	            segments.forEach(function (segment) {
	                segment.id = results.length;
	                results.push(segment);
	            });
	        });
	    }
	}
	function createSegments(coords, properties) {
	    var segments = [];
	    coords.reduce(function (previousCoords, currentCoords) {
	        var segment = lineString([previousCoords, currentCoords], properties);
	        segment.bbox = bbox$1(previousCoords, currentCoords);
	        segments.push(segment);
	        return currentCoords;
	    });
	    return segments;
	}
	function bbox$1(coords1, coords2) {
	    var x1 = coords1[0];
	    var y1 = coords1[1];
	    var x2 = coords2[0];
	    var y2 = coords2[1];
	    var west = x1 < x2 ? x1 : x2;
	    var south = y1 < y2 ? y1 : y2;
	    var east = x1 > x2 ? x1 : x2;
	    var north = y1 > y2 ? y1 : y2;
	    return [west, south, east, north];
	}

	var rbush_min = createCommonjsModule(function (module, exports) {
	!function(t,i){module.exports=i();}(commonjsGlobal,function(){function t(t,r,e,a,h){!function t(n,r,e,a,h){for(;a>e;){if(a-e>600){var o=a-e+1,s=r-e+1,l=Math.log(o),f=.5*Math.exp(2*l/3),u=.5*Math.sqrt(l*f*(o-f)/o)*(s-o/2<0?-1:1),m=Math.max(e,Math.floor(r-s*f/o+u)),c=Math.min(a,Math.floor(r+(o-s)*f/o+u));t(n,r,m,c,h);}var p=n[r],d=e,x=a;for(i(n,e,r),h(n[a],p)>0&&i(n,e,a);d<x;){for(i(n,d,x),d++,x--;h(n[d],p)<0;)d++;for(;h(n[x],p)>0;)x--;}0===h(n[e],p)?i(n,e,x):i(n,++x,a),x<=r&&(e=x+1),r<=x&&(a=x-1);}}(t,r,e||0,a||t.length-1,h||n);}function i(t,i,n){var r=t[i];t[i]=t[n],t[n]=r;}function n(t,i){return t<i?-1:t>i?1:0}var r=function(t){void 0===t&&(t=9),this._maxEntries=Math.max(4,t),this._minEntries=Math.max(2,Math.ceil(.4*this._maxEntries)),this.clear();};function e(t,i,n){if(!n)return i.indexOf(t);for(var r=0;r<i.length;r++)if(n(t,i[r]))return r;return -1}function a(t,i){h(t,0,t.children.length,i,t);}function h(t,i,n,r,e){e||(e=p(null)),e.minX=1/0,e.minY=1/0,e.maxX=-1/0,e.maxY=-1/0;for(var a=i;a<n;a++){var h=t.children[a];o(e,t.leaf?r(h):h);}return e}function o(t,i){return t.minX=Math.min(t.minX,i.minX),t.minY=Math.min(t.minY,i.minY),t.maxX=Math.max(t.maxX,i.maxX),t.maxY=Math.max(t.maxY,i.maxY),t}function s(t,i){return t.minX-i.minX}function l(t,i){return t.minY-i.minY}function f(t){return (t.maxX-t.minX)*(t.maxY-t.minY)}function u(t){return t.maxX-t.minX+(t.maxY-t.minY)}function m(t,i){return t.minX<=i.minX&&t.minY<=i.minY&&i.maxX<=t.maxX&&i.maxY<=t.maxY}function c(t,i){return i.minX<=t.maxX&&i.minY<=t.maxY&&i.maxX>=t.minX&&i.maxY>=t.minY}function p(t){return {children:t,height:1,leaf:!0,minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function d(i,n,r,e,a){for(var h=[n,r];h.length;)if(!((r=h.pop())-(n=h.pop())<=e)){var o=n+Math.ceil((r-n)/e/2)*e;t(i,o,n,r,a),h.push(n,o,o,r);}}return r.prototype.all=function(){return this._all(this.data,[])},r.prototype.search=function(t){var i=this.data,n=[];if(!c(t,i))return n;for(var r=this.toBBox,e=[];i;){for(var a=0;a<i.children.length;a++){var h=i.children[a],o=i.leaf?r(h):h;c(t,o)&&(i.leaf?n.push(h):m(t,o)?this._all(h,n):e.push(h));}i=e.pop();}return n},r.prototype.collides=function(t){var i=this.data;if(!c(t,i))return !1;for(var n=[];i;){for(var r=0;r<i.children.length;r++){var e=i.children[r],a=i.leaf?this.toBBox(e):e;if(c(t,a)){if(i.leaf||m(t,a))return !0;n.push(e);}}i=n.pop();}return !1},r.prototype.load=function(t){if(!t||!t.length)return this;if(t.length<this._minEntries){for(var i=0;i<t.length;i++)this.insert(t[i]);return this}var n=this._build(t.slice(),0,t.length-1,0);if(this.data.children.length)if(this.data.height===n.height)this._splitRoot(this.data,n);else {if(this.data.height<n.height){var r=this.data;this.data=n,n=r;}this._insert(n,this.data.height-n.height-1,!0);}else this.data=n;return this},r.prototype.insert=function(t){return t&&this._insert(t,this.data.height-1),this},r.prototype.clear=function(){return this.data=p([]),this},r.prototype.remove=function(t,i){if(!t)return this;for(var n,r,a,h=this.data,o=this.toBBox(t),s=[],l=[];h||s.length;){if(h||(h=s.pop(),r=s[s.length-1],n=l.pop(),a=!0),h.leaf){var f=e(t,h.children,i);if(-1!==f)return h.children.splice(f,1),s.push(h),this._condense(s),this}a||h.leaf||!m(h,o)?r?(n++,h=r.children[n],a=!1):h=null:(s.push(h),l.push(n),n=0,r=h,h=h.children[0]);}return this},r.prototype.toBBox=function(t){return t},r.prototype.compareMinX=function(t,i){return t.minX-i.minX},r.prototype.compareMinY=function(t,i){return t.minY-i.minY},r.prototype.toJSON=function(){return this.data},r.prototype.fromJSON=function(t){return this.data=t,this},r.prototype._all=function(t,i){for(var n=[];t;)t.leaf?i.push.apply(i,t.children):n.push.apply(n,t.children),t=n.pop();return i},r.prototype._build=function(t,i,n,r){var e,h=n-i+1,o=this._maxEntries;if(h<=o)return a(e=p(t.slice(i,n+1)),this.toBBox),e;r||(r=Math.ceil(Math.log(h)/Math.log(o)),o=Math.ceil(h/Math.pow(o,r-1))),(e=p([])).leaf=!1,e.height=r;var s=Math.ceil(h/o),l=s*Math.ceil(Math.sqrt(o));d(t,i,n,l,this.compareMinX);for(var f=i;f<=n;f+=l){var u=Math.min(f+l-1,n);d(t,f,u,s,this.compareMinY);for(var m=f;m<=u;m+=s){var c=Math.min(m+s-1,u);e.children.push(this._build(t,m,c,r-1));}}return a(e,this.toBBox),e},r.prototype._chooseSubtree=function(t,i,n,r){for(;r.push(i),!i.leaf&&r.length-1!==n;){for(var e=1/0,a=1/0,h=void 0,o=0;o<i.children.length;o++){var s=i.children[o],l=f(s),u=(m=t,c=s,(Math.max(c.maxX,m.maxX)-Math.min(c.minX,m.minX))*(Math.max(c.maxY,m.maxY)-Math.min(c.minY,m.minY))-l);u<a?(a=u,e=l<e?l:e,h=s):u===a&&l<e&&(e=l,h=s);}i=h||i.children[0];}var m,c;return i},r.prototype._insert=function(t,i,n){var r=n?t:this.toBBox(t),e=[],a=this._chooseSubtree(r,this.data,i,e);for(a.children.push(t),o(a,r);i>=0&&e[i].children.length>this._maxEntries;)this._split(e,i),i--;this._adjustParentBBoxes(r,e,i);},r.prototype._split=function(t,i){var n=t[i],r=n.children.length,e=this._minEntries;this._chooseSplitAxis(n,e,r);var h=this._chooseSplitIndex(n,e,r),o=p(n.children.splice(h,n.children.length-h));o.height=n.height,o.leaf=n.leaf,a(n,this.toBBox),a(o,this.toBBox),i?t[i-1].children.push(o):this._splitRoot(n,o);},r.prototype._splitRoot=function(t,i){this.data=p([t,i]),this.data.height=t.height+1,this.data.leaf=!1,a(this.data,this.toBBox);},r.prototype._chooseSplitIndex=function(t,i,n){for(var r,e,a,o,s,l,u,m=1/0,c=1/0,p=i;p<=n-i;p++){var d=h(t,0,p,this.toBBox),x=h(t,p,n,this.toBBox),v=(e=d,a=x,o=void 0,s=void 0,l=void 0,u=void 0,o=Math.max(e.minX,a.minX),s=Math.max(e.minY,a.minY),l=Math.min(e.maxX,a.maxX),u=Math.min(e.maxY,a.maxY),Math.max(0,l-o)*Math.max(0,u-s)),M=f(d)+f(x);v<m?(m=v,r=p,c=M<c?M:c):v===m&&M<c&&(c=M,r=p);}return r||n-i},r.prototype._chooseSplitAxis=function(t,i,n){var r=t.leaf?this.compareMinX:s,e=t.leaf?this.compareMinY:l;this._allDistMargin(t,i,n,r)<this._allDistMargin(t,i,n,e)&&t.children.sort(r);},r.prototype._allDistMargin=function(t,i,n,r){t.children.sort(r);for(var e=this.toBBox,a=h(t,0,i,e),s=h(t,n-i,n,e),l=u(a)+u(s),f=i;f<n-i;f++){var m=t.children[f];o(a,t.leaf?e(m):m),l+=u(a);}for(var c=n-i-1;c>=i;c--){var p=t.children[c];o(s,t.leaf?e(p):p),l+=u(s);}return l},r.prototype._adjustParentBBoxes=function(t,i,n){for(var r=n;r>=0;r--)o(i[r],t);},r.prototype._condense=function(t){for(var i=t.length-1,n=void 0;i>=0;i--)0===t[i].children.length?i>0?(n=t[i-1].children).splice(n.indexOf(t[i]),1):this.clear():a(t[i],this.toBBox);},r});
	});

	function bbox(geojson) {
	    var result = [Infinity, Infinity, -Infinity, -Infinity];
	    coordEach(geojson, function (coord) {
	        if (result[0] > coord[0]) {
	            result[0] = coord[0];
	        }
	        if (result[1] > coord[1]) {
	            result[1] = coord[1];
	        }
	        if (result[2] < coord[0]) {
	            result[2] = coord[0];
	        }
	        if (result[3] < coord[1]) {
	            result[3] = coord[1];
	        }
	    });
	    return result;
	}
	bbox["default"] = bbox;

	var turfBBox = bbox.default;
	var featureEach = es.featureEach;
	es.coordEach;
	es$1.polygon;
	var featureCollection = es$1.featureCollection;
	function geojsonRbush(maxEntries) {
	    var tree = new rbush_min(maxEntries);
	    tree.insert = function (feature) {
	        if (feature.type !== 'Feature') throw new Error('invalid feature');
	        feature.bbox = feature.bbox ? feature.bbox : turfBBox(feature);
	        return rbush_min.prototype.insert.call(this, feature);
	    };
	    tree.load = function (features) {
	        var load = [];
	        if (Array.isArray(features)) {
	            features.forEach(function (feature) {
	                if (feature.type !== 'Feature') throw new Error('invalid features');
	                feature.bbox = feature.bbox ? feature.bbox : turfBBox(feature);
	                load.push(feature);
	            });
	        } else {
	            featureEach(features, function (feature) {
	                if (feature.type !== 'Feature') throw new Error('invalid features');
	                feature.bbox = feature.bbox ? feature.bbox : turfBBox(feature);
	                load.push(feature);
	            });
	        }
	        return rbush_min.prototype.load.call(this, load);
	    };
	    tree.remove = function (feature, equals) {
	        if (feature.type !== 'Feature') throw new Error('invalid feature');
	        feature.bbox = feature.bbox ? feature.bbox : turfBBox(feature);
	        return rbush_min.prototype.remove.call(this, feature, equals);
	    };
	    tree.clear = function () {
	        return rbush_min.prototype.clear.call(this);
	    };
	    tree.search = function (geojson) {
	        var features = rbush_min.prototype.search.call(this, this.toBBox(geojson));
	        return featureCollection(features);
	    };
	    tree.collides = function (geojson) {
	        return rbush_min.prototype.collides.call(this, this.toBBox(geojson));
	    };
	    tree.all = function () {
	        var features = rbush_min.prototype.all.call(this);
	        return featureCollection(features);
	    };
	    tree.toJSON = function () {
	        return rbush_min.prototype.toJSON.call(this);
	    };
	    tree.fromJSON = function (json) {
	        return rbush_min.prototype.fromJSON.call(this, json);
	    };
	    tree.toBBox = function (geojson) {
	        var bbox;
	        if (geojson.bbox) bbox = geojson.bbox;
	        else if (Array.isArray(geojson) && geojson.length === 4) bbox = geojson;
	        else if (Array.isArray(geojson) && geojson.length === 6) bbox = [geojson[0], geojson[1], geojson[3], geojson[4]];
	        else if (geojson.type === 'Feature') bbox = turfBBox(geojson);
	        else if (geojson.type === 'FeatureCollection') bbox = turfBBox(geojson);
	        else throw new Error('invalid geojson')
	        return {
	            minX: bbox[0],
	            minY: bbox[1],
	            maxX: bbox[2],
	            maxY: bbox[3]
	        };
	    };
	    return tree;
	}
	var geojsonRbush_1 = geojsonRbush;
	var _default = geojsonRbush;
	geojsonRbush_1.default = _default;

	function lineIntersect(line1, line2) {
	    var unique = {};
	    var results = [];
	    if (line1.type === "LineString") {
	        line1 = feature(line1);
	    }
	    if (line2.type === "LineString") {
	        line2 = feature(line2);
	    }
	    if (line1.type === "Feature" &&
	        line2.type === "Feature" &&
	        line1.geometry !== null &&
	        line2.geometry !== null &&
	        line1.geometry.type === "LineString" &&
	        line2.geometry.type === "LineString" &&
	        line1.geometry.coordinates.length === 2 &&
	        line2.geometry.coordinates.length === 2) {
	        var intersect = intersects(line1, line2);
	        if (intersect) {
	            results.push(intersect);
	        }
	        return featureCollection$1(results);
	    }
	    var tree = geojsonRbush_1();
	    tree.load(lineSegment(line2));
	    featureEach$1(lineSegment(line1), function (segment) {
	        featureEach$1(tree.search(segment), function (match) {
	            var intersect = intersects(segment, match);
	            if (intersect) {
	                var key = getCoords(intersect).join(",");
	                if (!unique[key]) {
	                    unique[key] = true;
	                    results.push(intersect);
	                }
	            }
	        });
	    });
	    return featureCollection$1(results);
	}
	function intersects(line1, line2) {
	    var coords1 = getCoords(line1);
	    var coords2 = getCoords(line2);
	    if (coords1.length !== 2) {
	        throw new Error("<intersects> line1 must only contain 2 coordinates");
	    }
	    if (coords2.length !== 2) {
	        throw new Error("<intersects> line2 must only contain 2 coordinates");
	    }
	    var x1 = coords1[0][0];
	    var y1 = coords1[0][1];
	    var x2 = coords1[1][0];
	    var y2 = coords1[1][1];
	    var x3 = coords2[0][0];
	    var y3 = coords2[0][1];
	    var x4 = coords2[1][0];
	    var y4 = coords2[1][1];
	    var denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
	    var numeA = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
	    var numeB = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
	    if (denom === 0) {
	        if (numeA === 0 && numeB === 0) {
	            return null;
	        }
	        return null;
	    }
	    var uA = numeA / denom;
	    var uB = numeB / denom;
	    if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
	        var x = x1 + uA * (x2 - x1);
	        var y = y1 + uA * (y2 - y1);
	        return point([x, y]);
	    }
	    return null;
	}

	function polygonToLine (poly, options) {
	    if (options === void 0) { options = {}; }
	    var geom = getGeom(poly);
	    if (!options.properties && poly.type === "Feature") {
	        options.properties = poly.properties;
	    }
	    switch (geom.type) {
	        case "Polygon":
	            return polygonToLine$1(geom, options);
	        case "MultiPolygon":
	            return multiPolygonToLine(geom, options);
	        default:
	            throw new Error("invalid poly");
	    }
	}
	function polygonToLine$1(poly, options) {
	    if (options === void 0) { options = {}; }
	    var geom = getGeom(poly);
	    var coords = geom.coordinates;
	    var properties = options.properties
	        ? options.properties
	        : poly.type === "Feature"
	            ? poly.properties
	            : {};
	    return coordsToLine(coords, properties);
	}
	function multiPolygonToLine(multiPoly, options) {
	    if (options === void 0) { options = {}; }
	    var geom = getGeom(multiPoly);
	    var coords = geom.coordinates;
	    var properties = options.properties
	        ? options.properties
	        : multiPoly.type === "Feature"
	            ? multiPoly.properties
	            : {};
	    var lines = [];
	    coords.forEach(function (coord) {
	        lines.push(coordsToLine(coord, properties));
	    });
	    return featureCollection$1(lines);
	}
	function coordsToLine(coords, properties) {
	    if (coords.length > 1) {
	        return multiLineString(coords, properties);
	    }
	    return lineString(coords[0], properties);
	}

	function booleanDisjoint(feature1, feature2) {
	    var bool = true;
	    flattenEach(feature1, function (flatten1) {
	        flattenEach(feature2, function (flatten2) {
	            if (bool === false) {
	                return false;
	            }
	            bool = disjoint(flatten1.geometry, flatten2.geometry);
	        });
	    });
	    return bool;
	}
	function disjoint(geom1, geom2) {
	    switch (geom1.type) {
	        case "Point":
	            switch (geom2.type) {
	                case "Point":
	                    return !compareCoords(geom1.coordinates, geom2.coordinates);
	                case "LineString":
	                    return !isPointOnLine(geom2, geom1);
	                case "Polygon":
	                    return !booleanPointInPolygon(geom1, geom2);
	            }
	            break;
	        case "LineString":
	            switch (geom2.type) {
	                case "Point":
	                    return !isPointOnLine(geom1, geom2);
	                case "LineString":
	                    return !isLineOnLine(geom1, geom2);
	                case "Polygon":
	                    return !isLineInPoly(geom2, geom1);
	            }
	            break;
	        case "Polygon":
	            switch (geom2.type) {
	                case "Point":
	                    return !booleanPointInPolygon(geom2, geom1);
	                case "LineString":
	                    return !isLineInPoly(geom1, geom2);
	                case "Polygon":
	                    return !isPolyInPoly(geom2, geom1);
	            }
	    }
	    return false;
	}
	function isPointOnLine(lineString, pt) {
	    for (var i = 0; i < lineString.coordinates.length - 1; i++) {
	        if (isPointOnLineSegment(lineString.coordinates[i], lineString.coordinates[i + 1], pt.coordinates)) {
	            return true;
	        }
	    }
	    return false;
	}
	function isLineOnLine(lineString1, lineString2) {
	    var doLinesIntersect = lineIntersect(lineString1, lineString2);
	    if (doLinesIntersect.features.length > 0) {
	        return true;
	    }
	    return false;
	}
	function isLineInPoly(polygon, lineString) {
	    for (var _i = 0, _a = lineString.coordinates; _i < _a.length; _i++) {
	        var coord = _a[_i];
	        if (booleanPointInPolygon(coord, polygon)) {
	            return true;
	        }
	    }
	    var doLinesIntersect = lineIntersect(lineString, polygonToLine(polygon));
	    if (doLinesIntersect.features.length > 0) {
	        return true;
	    }
	    return false;
	}
	function isPolyInPoly(feature1, feature2) {
	    for (var _i = 0, _a = feature1.coordinates[0]; _i < _a.length; _i++) {
	        var coord1 = _a[_i];
	        if (booleanPointInPolygon(coord1, feature2)) {
	            return true;
	        }
	    }
	    for (var _b = 0, _c = feature2.coordinates[0]; _b < _c.length; _b++) {
	        var coord2 = _c[_b];
	        if (booleanPointInPolygon(coord2, feature1)) {
	            return true;
	        }
	    }
	    var doLinesIntersect = lineIntersect(polygonToLine(feature1), polygonToLine(feature2));
	    if (doLinesIntersect.features.length > 0) {
	        return true;
	    }
	    return false;
	}
	function isPointOnLineSegment(lineSegmentStart, lineSegmentEnd, pt) {
	    var dxc = pt[0] - lineSegmentStart[0];
	    var dyc = pt[1] - lineSegmentStart[1];
	    var dxl = lineSegmentEnd[0] - lineSegmentStart[0];
	    var dyl = lineSegmentEnd[1] - lineSegmentStart[1];
	    var cross = dxc * dyl - dyc * dxl;
	    if (cross !== 0) {
	        return false;
	    }
	    if (Math.abs(dxl) >= Math.abs(dyl)) {
	        if (dxl > 0) {
	            return lineSegmentStart[0] <= pt[0] && pt[0] <= lineSegmentEnd[0];
	        }
	        else {
	            return lineSegmentEnd[0] <= pt[0] && pt[0] <= lineSegmentStart[0];
	        }
	    }
	    else if (dyl > 0) {
	        return lineSegmentStart[1] <= pt[1] && pt[1] <= lineSegmentEnd[1];
	    }
	    else {
	        return lineSegmentEnd[1] <= pt[1] && pt[1] <= lineSegmentStart[1];
	    }
	}
	function compareCoords(pair1, pair2) {
	    return pair1[0] === pair2[0] && pair1[1] === pair2[1];
	}

	function booleanIntersects(feature1, feature2) {
	    var bool = false;
	    flattenEach(feature1, function (flatten1) {
	        flattenEach(feature2, function (flatten2) {
	            if (bool === true) {
	                return true;
	            }
	            bool = !booleanDisjoint(flatten1.geometry, flatten2.geometry);
	        });
	    });
	    return bool;
	}

	function bboxPolygon(bbox, options) {
	    if (options === void 0) { options = {}; }
	    var west = Number(bbox[0]);
	    var south = Number(bbox[1]);
	    var east = Number(bbox[2]);
	    var north = Number(bbox[3]);
	    if (bbox.length === 6) {
	        throw new Error("@turf/bbox-polygon does not support BBox with 6 positions");
	    }
	    var lowLeft = [west, south];
	    var topLeft = [west, north];
	    var topRight = [east, north];
	    var lowRight = [east, south];
	    return polygon([[lowLeft, lowRight, topRight, topLeft, lowLeft]], options.properties, { bbox: bbox, id: options.id });
	}

	var ArcGISDynamicMapService_1 = createCommonjsModule(function (module, exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ArcGISDynamicMapService = exports.blankDataUri = void 0;
	exports.isArcGISDynamicMapService = isArcGISDynamicMapService;
	const boolean_intersects_1 = __importDefault(booleanIntersects);
	const bbox_polygon_1 = __importDefault(bboxPolygon);
	exports.blankDataUri = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
	class ArcGISDynamicMapService {
	    constructor(requestManager, options) {
	        this.supportsDynamicLayers = false;
	        this._loading = true;
	        this.respondToResolutionChange = () => {
	            if (this.options.supportHighDpiDisplays) {
	                this.updateSource();
	            }
	            if (this.resolution) {
	                matchMedia(this.resolution).removeListener(this.respondToResolutionChange);
	            }
	            this.resolution = `(resolution: ${window.devicePixelRatio}dppx)`;
	            matchMedia(this.resolution).addListener(this.respondToResolutionChange);
	        };
	        this.onMapData = (event) => {
	            if (event.sourceId && event.sourceId === this.sourceId) {
	                this._loading = false;
	            }
	        };
	        this.onMapError = (event) => {
	            if (event.sourceId === this.sourceId &&
	                ((event.dataType === "source" && event.sourceDataType === "content") ||
	                    (event.type === "error" &&
	                        event.error &&
	                        "status" in event.error &&
	                        event.error.status !== 404))) {
	                this._loading = false;
	            }
	        };
	        this.updateSource = () => {
	            var _a, _b, _c;
	            this._loading = true;
	            const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
	            if (source && this.map) {
	                if (source.type === "raster") {
	                    source.setTiles([this.getUrl()]);
	                }
	                else if (source.type === "image") {
	                    const coordinates = this.getCoordinates(this.map);
	                    if ((_b = this._computedMetadata) === null || _b === void 0 ? void 0 : _b.bounds) {
	                        const serviceBounds = (0, bbox_polygon_1.default)((_c = this._computedMetadata) === null || _c === void 0 ? void 0 : _c.bounds);
	                        const bounds = this.map.getBounds();
	                        const viewPortBBox = [
	                            bounds.getWest(),
	                            bounds.getSouth(),
	                            bounds.getEast(),
	                            bounds.getNorth(),
	                        ];
	                        const viewportBounds = (0, bbox_polygon_1.default)(viewPortBBox);
	                        if (!(0, boolean_intersects_1.default)(viewportBounds, serviceBounds)) {
	                            return;
	                        }
	                    }
	                    const url = this.getUrl(this.map);
	                    const currentUrl = source.url;
	                    if (currentUrl === url) {
	                        return;
	                    }
	                    if (source.url === url) {
	                        return;
	                    }
	                    source.updateImage({
	                        url,
	                        coordinates,
	                    });
	                }
	                else ;
	            }
	        };
	        this.debouncedUpdateSource = () => {
	            if (this.debounceTimeout) {
	                clearTimeout(this.debounceTimeout);
	            }
	            this.debounceTimeout = setTimeout(() => {
	                delete this.debounceTimeout;
	                this.updateSource();
	            }, 5);
	        };
	        this.type = "ArcGISDynamicMapService";
	        this.options = options;
	        this.url = options.url;
	        this.requestManager = requestManager;
	        this.sourceId = (options === null || options === void 0 ? void 0 : options.sourceId) || (0, esmBrowser.v4)();
	        options.url = options.url.replace(/\/$/, "");
	        if (!/rest\/services/.test(options.url) || !/MapServer/.test(options.url)) {
	            throw new Error("Invalid ArcGIS REST Service URL");
	        }
	        this.resolution = `(resolution: ${window.devicePixelRatio}dppx)`;
	        matchMedia(this.resolution).addListener(this.respondToResolutionChange);
	    }
	    getMetadata() {
	        if (this.serviceMetadata && this.layerMetadata) {
	            return Promise.resolve({
	                serviceMetadata: this.serviceMetadata,
	                layers: this.layerMetadata,
	            });
	        }
	        else {
	            return this.requestManager
	                .getMapServiceMetadata(this.options.url, {
	                token: this.options.token,
	            })
	                .then(({ serviceMetadata, layers }) => {
	                this.serviceMetadata = serviceMetadata;
	                this.layerMetadata = layers;
	                this.supportsDynamicLayers = serviceMetadata.supportsDynamicLayers;
	                return { serviceMetadata, layers };
	            });
	        }
	    }
	    async getComputedMetadata() {
	        var _a, _b;
	        try {
	            if (!this._computedMetadata) {
	                const { serviceMetadata, layers } = await this.getMetadata();
	                let { bounds, minzoom, maxzoom, attribution } = await this.getComputedProperties();
	                attribution = this.options.attributionOverride || attribution;
	                const results = /\/.+\/MapServer/.exec(this.options.url);
	                let label = results ? results[0] : false;
	                if (!label) {
	                    if ((_b = (_a = this.layerMetadata) === null || _a === void 0 ? void 0 : _a.layers) === null || _b === void 0 ? void 0 : _b[0]) {
	                        label = this.layerMetadata.layers[0].name;
	                    }
	                }
	                const legendData = await this.requestManager.getLegendMetadata(this.options.url);
	                const hiddenIds = new Set();
	                for (const layer of layers.layers) {
	                    if (!layer.defaultVisibility) {
	                        hiddenIds.add(layer.id);
	                    }
	                    else {
	                        if (layer.parentLayer) {
	                            if (hiddenIds.has(layer.parentLayer.id)) {
	                                hiddenIds.add(layer.id);
	                            }
	                            else {
	                                const parent = layers.layers.find((l) => { var _a; return l.id === ((_a = layer.parentLayer) === null || _a === void 0 ? void 0 : _a.id); });
	                                if (parent && !parent.defaultVisibility) {
	                                    hiddenIds.add(layer.id);
	                                    hiddenIds.add(parent.id);
	                                }
	                            }
	                        }
	                    }
	                }
	                this._computedMetadata = {
	                    bounds: bounds || undefined,
	                    minzoom,
	                    maxzoom,
	                    attribution,
	                    tableOfContentsItems: layers.layers.map((lyr) => {
	                        const legendLayer = legendData.layers.find((l) => l.layerId === lyr.id);
	                        const isFolder = lyr.type === "Group Layer";
	                        if (isFolder) {
	                            return {
	                                type: "folder",
	                                id: lyr.id.toString(),
	                                label: lyr.name,
	                                defaultVisibility: hiddenIds.has(lyr.id)
	                                    ? false
	                                    : lyr.defaultVisibility,
	                                parentId: lyr.parentLayer
	                                    ? lyr.parentLayer.id.toString()
	                                    : undefined,
	                            };
	                        }
	                        else {
	                            return {
	                                type: "data",
	                                id: lyr.id.toString(),
	                                label: lyr.name,
	                                defaultVisibility: hiddenIds.has(lyr.id)
	                                    ? false
	                                    : lyr.defaultVisibility,
	                                metadata: (0, utils$1.generateMetadataForLayer)(this.options.url + "/" + lyr.id, this.serviceMetadata, lyr),
	                                parentId: lyr.parentLayer
	                                    ? lyr.parentLayer.id.toString()
	                                    : undefined,
	                                legend: (0, utils$1.makeLegend)(legendData, lyr.id),
	                            };
	                        }
	                    }),
	                    supportsDynamicRendering: {
	                        layerOpacity: this.supportsDynamicLayers,
	                        layerOrder: true,
	                        layerVisibility: true,
	                    },
	                };
	            }
	            return this._computedMetadata;
	        }
	        catch (e) {
	            this.error = e.toString();
	            throw e;
	        }
	    }
	    async getComputedProperties() {
	        var _a, _b;
	        const { serviceMetadata, layers } = await this.getMetadata();
	        const levels = ((_a = serviceMetadata.tileInfo) === null || _a === void 0 ? void 0 : _a.lods.map((l) => l.level)) || [];
	        const attribution = (0, utils$1.contentOrFalse)(layers.layers[0].copyrightText) ||
	            (0, utils$1.contentOrFalse)(serviceMetadata.copyrightText) ||
	            (0, utils$1.contentOrFalse)((_b = serviceMetadata.documentInfo) === null || _b === void 0 ? void 0 : _b.Author) ||
	            undefined;
	        const minzoom = Math.min(...levels);
	        const maxzoom = Math.max(...levels);
	        return {
	            minzoom,
	            maxzoom,
	            bounds: await (0, utils$1.extentToLatLngBounds)(serviceMetadata.fullExtent),
	            attribution,
	        };
	    }
	    async getGLSource(map) {
	        let { attribution, bounds } = await this.getComputedProperties();
	        bounds = bounds || [-89, -179, 89, 179];
	        if (this.options.useTiles) {
	            return {
	                type: "raster",
	                tiles: [this.getUrl(map)],
	                tileSize: this.options.tileSize || 256,
	                bounds: bounds,
	                attribution,
	            };
	        }
	        else {
	            const coordinates = this.getCoordinates(map);
	            const url = this.getUrl(map);
	            return {
	                type: "image",
	                url,
	                coordinates,
	            };
	        }
	    }
	    getCoordinates(map) {
	        const bounds = map.getBounds();
	        const coordinates = [
	            [
	                Math.max(bounds.getNorthWest().lng, -179),
	                Math.min(bounds.getNorthWest().lat, 89),
	            ],
	            [
	                Math.min(bounds.getNorthEast().lng, 179),
	                Math.min(bounds.getNorthEast().lat, 89),
	            ],
	            [
	                Math.min(bounds.getSouthEast().lng, 179),
	                Math.max(bounds.getSouthEast().lat, -89),
	            ],
	            [
	                Math.max(bounds.getSouthWest().lng, -179),
	                Math.max(bounds.getSouthWest().lat, -89),
	            ],
	        ];
	        return coordinates;
	    }
	    async addToMap(map) {
	        if (!map) {
	            throw new Error("Map not provided to addToMap");
	        }
	        const sourceData = await this.getGLSource(map);
	        map.addSource(this.sourceId, sourceData);
	        this.addEventListeners(map);
	        return this.sourceId;
	    }
	    addEventListeners(map) {
	        var _a;
	        if (!map) {
	            throw new Error("Map not provided to addEventListeners");
	        }
	        if (!((_a = this.options) === null || _a === void 0 ? void 0 : _a.useTiles)) {
	            if (!this.map || (this.map && this.map !== map)) {
	                if (this.map) {
	                    this.removeEventListeners(this.map);
	                }
	                this.map = map;
	                map.on("moveend", this.updateSource);
	                map.on("data", this.onMapData);
	                map.on("error", this.onMapError);
	            }
	        }
	    }
	    removeEventListeners(map) {
	        if (!this.map) {
	            throw new Error("Map not set");
	        }
	        else if (this.map !== map) {
	            throw new Error("Map does not match");
	        }
	        delete this.map;
	        map.off("moveend", this.updateSource);
	        map.off("data", this.onMapData);
	        map.off("error", this.onMapError);
	    }
	    removeFromMap(map) {
	        if (map.getSource(this.sourceId)) {
	            const layers = map.getStyle().layers || [];
	            for (const layer of layers) {
	                if ("source" in layer && layer.source === this.sourceId) {
	                    map.removeLayer(layer.id);
	                }
	            }
	            this.removeEventListeners(map);
	            map.removeSource(this.sourceId);
	            this.map = undefined;
	        }
	    }
	    destroy() {
	        matchMedia(this.resolution).removeListener(this.respondToResolutionChange);
	        if (this.map) {
	            this.removeFromMap(this.map);
	        }
	    }
	    getUrl(map) {
	        var _a;
	        map = this.map || map;
	        if (!map) {
	            return exports.blankDataUri;
	        }
	        let url = new URL(this.options.url + "/export");
	        url.searchParams.set("f", "image");
	        url.searchParams.set("transparent", "true");
	        const coordinates = this.getCoordinates(map);
	        let bbox = [
	            lon2meters(coordinates[0][0]),
	            lat2meters(coordinates[2][1]),
	            lon2meters(coordinates[2][0]),
	            lat2meters(coordinates[0][1]),
	        ];
	        const groundResolution = getGroundResolution(map.getZoom() +
	            (this.options.supportHighDpiDisplays ? window.devicePixelRatio - 1 : 0));
	        const width = Math.round((bbox[2] - bbox[0]) / groundResolution);
	        const height = Math.round((bbox[3] - bbox[1]) / groundResolution);
	        url.searchParams.set("format", "png");
	        url.searchParams.set("size", [width, height].join(","));
	        if (this.options.supportHighDpiDisplays) {
	            switch (window.devicePixelRatio) {
	                case 1:
	                    url.searchParams.set("dpi", "96");
	                    break;
	                case 2:
	                    url.searchParams.set("dpi", "220");
	                    break;
	                case 3:
	                    url.searchParams.set("dpi", "390");
	                    break;
	                default:
	                    url.searchParams.set("dpi",
	                    (window.devicePixelRatio * 96 * 1.22).toString());
	                    break;
	            }
	        }
	        else {
	            url.searchParams.set("dpi", "96");
	        }
	        url.searchParams.set("imageSR", "102100");
	        url.searchParams.set("bboxSR", "102100");
	        if (Math.abs(bbox[0]) > 20037508.34 || Math.abs(bbox[2]) > 20037508.34) {
	            const centralMeridian = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getCenter().lng;
	            if (this.options.supportHighDpiDisplays && window.devicePixelRatio > 1) {
	                bbox[0] = -(width * groundResolution) / (window.devicePixelRatio * 2);
	                bbox[2] = (width * groundResolution) / (window.devicePixelRatio * 2);
	            }
	            else {
	                bbox[0] = -(width * groundResolution) / 2;
	                bbox[2] = (width * groundResolution) / 2;
	            }
	            const sr = JSON.stringify({
	                wkt: `PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",${centralMeridian}],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]`,
	            });
	            url.searchParams.set("imageSR", sr);
	            url.searchParams.set("bboxSR", sr);
	        }
	        if (Array.isArray(this.layers)) {
	            if (this.layers.length === 0) {
	                return exports.blankDataUri;
	            }
	            else {
	                url.searchParams.set("layers", `show:${this.layers.map((lyr) => lyr.id).join(",")}`);
	            }
	        }
	        url.searchParams.set("bbox", bbox.join(","));
	        url.searchParams.delete("dynamicLayers");
	        let hasOpacityUpdates = false;
	        if (this.supportsDynamicLayers && this.layers) {
	            for (var i = 0; i < this.layers.length; i++) {
	                if (this.layers[i - 1] &&
	                    parseInt(this.layers[i].id) < parseInt(this.layers[i - 1].id)) ;
	                const opacity = this.layers[i].opacity;
	                if (opacity !== undefined && opacity < 1) {
	                    hasOpacityUpdates = true;
	                }
	            }
	        }
	        if (this.layers) {
	            const dynamicLayers = this.layers.map((lyr) => {
	                return {
	                    id: lyr.id,
	                    source: {
	                        mapLayerId: lyr.id,
	                        type: "mapLayer",
	                    },
	                    drawingInfo: {
	                        transparency: lyr.opacity !== undefined ? 100 - lyr.opacity * 100 : 0,
	                    },
	                };
	            });
	            url.searchParams.set("dynamicLayers", JSON.stringify(dynamicLayers));
	        }
	        for (const key in this.options.queryParameters) {
	            url.searchParams.set(key, this.options.queryParameters[key].toString());
	        }
	        const tileSize = this.options.tileSize || 256;
	        if (this.options.useTiles) {
	            url.searchParams.set("bbox", `seasketch-replace-me`);
	            if (this.options.supportHighDpiDisplays && window.devicePixelRatio > 1) {
	                const size = tileSize * window.devicePixelRatio;
	                url.searchParams.set("size", [size, size].join(","));
	            }
	            else {
	                url.searchParams.set("size", [tileSize, tileSize].join(","));
	            }
	        }
	        if (hasOpacityUpdates &&
	            /png/i.test(url.searchParams.get("format") || "png")) {
	            url.searchParams.set("format", "PNG32");
	        }
	        return url.toString().replace("seasketch-replace-me", "{bbox-epsg-3857}");
	    }
	    get loading() {
	        var _a;
	        const source = (_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId);
	        if (source && source.type === "raster") {
	            return this.map.isSourceLoaded(this.sourceId) === false;
	        }
	        else {
	            return this._loading;
	        }
	    }
	    updateLayers(layers) {
	        if (JSON.stringify(layers) !== JSON.stringify(this.layers)) {
	            this.layers = layers;
	            this.debouncedUpdateSource();
	        }
	    }
	    updateQueryParameters(queryParameters) {
	        if (JSON.stringify(this.options.queryParameters) !==
	            JSON.stringify(queryParameters)) {
	            this.options.queryParameters = queryParameters;
	            this.debouncedUpdateSource();
	        }
	    }
	    updateUseDevicePixelRatio(enable) {
	        if (enable !== this.options.supportHighDpiDisplays) {
	            this.options.supportHighDpiDisplays = enable;
	            this.debouncedUpdateSource();
	        }
	    }
	    async getGLStyleLayers() {
	        return {
	            layers: [
	                {
	                    id: (0, esmBrowser.v4)(),
	                    type: "raster",
	                    source: this.sourceId,
	                    paint: {
	                        "raster-fade-duration": this.options.useTiles ? 300 : 0,
	                    },
	                },
	            ],
	        };
	    }
	    get ready() {
	        return Boolean(this._computedMetadata);
	    }
	    async prepare() {
	        try {
	            await this.getComputedMetadata();
	        }
	        catch (e) {
	            this.fireError(e);
	        }
	    }
	    fireError(e) {
	        var _a;
	        (_a = this.map) === null || _a === void 0 ? void 0 : _a.fire("error", {
	            sourceId: this.sourceId,
	            error: e.message,
	        });
	    }
	}
	exports.ArcGISDynamicMapService = ArcGISDynamicMapService;
	function lat2meters(lat) {
	    var y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
	    return (y * 20037508.34) / 180;
	}
	function lon2meters(lon) {
	    return (lon * 20037508.34) / 180;
	}
	function getGroundResolution(level) {
	    let groundResolution = resolutions[level];
	    if (!groundResolution) {
	        groundResolution = (2 * Math.PI * 6378137) / (256 * 2 ** (level + 1));
	        resolutions[level] = groundResolution;
	    }
	    return groundResolution;
	}
	const resolutions = {};
	function isArcGISDynamicMapService(source) {
	    return source.type === "ArcGISDynamicMapService";
	}
	});

	var ArcGISVectorSource_1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ArcGISVectorSource = void 0;
	exports.fetchFeatureLayerData = fetchFeatureLayerData;
	class ArcGISVectorSource {
	    constructor(map, id, url, options) {
	        var _a;
	        this.data = {
	            type: "FeatureCollection",
	            features: [],
	        };
	        this.outFields = "*";
	        this.supportsPagination = true;
	        this._loading = true;
	        this._id = id;
	        this.baseUrl = url;
	        this.options = options;
	        this.map = map;
	        this.map.addSource(this._id, {
	            data: this.data,
	            type: "geojson",
	        });
	        if (options &&
	            "supportsPagination" in options &&
	            options["supportsPagination"] === false) {
	            this.supportsPagination = false;
	        }
	        if (options && options.outFields) {
	            this.outFields = options.outFields;
	        }
	        this.source = this.map.getSource(this._id);
	        let hadError = false;
	        const onError = (e) => {
	            hadError = true;
	            this._loading = false;
	            this.map.fire("error", {
	                source: this.source,
	                sourceId: this._id,
	                error: e,
	            });
	        };
	        this.map.fire("dataloading", {
	            source: this.source,
	            sourceId: this._id,
	            dataType: "source",
	            isSourceLoaded: false,
	            sourceDataType: "content",
	        });
	        fetchFeatureLayerData(this.baseUrl, this.outFields, onError, (_a = this.options) === null || _a === void 0 ? void 0 : _a.geometryPrecision, null, null, false, 1000, options === null || options === void 0 ? void 0 : options.bytesLimit)
	            .then((fc) => {
	            this._loading = false;
	            if (!hadError) {
	                this.source.setData(fc);
	            }
	        })
	            .catch(onError);
	    }
	    get loading() {
	        return this._loading;
	    }
	    get id() {
	        return this._id;
	    }
	    destroy() {
	        this.map.removeSource(this._id);
	    }
	}
	exports.ArcGISVectorSource = ArcGISVectorSource;
	async function fetchFeatureLayerData(url, outFields, onError, geometryPrecision = 6, abortController = null, onPageReceived = null, disablePagination = false, pageSize = 1000, bytesLimit) {
	    const featureCollection = {
	        type: "FeatureCollection",
	        features: [],
	    };
	    const params = new URLSearchParams({
	        inSR: "4326",
	        outSR: "4326",
	        where: "1>0",
	        outFields,
	        returnGeometry: "true",
	        geometryPrecision: geometryPrecision.toString(),
	        returnIdsOnly: "false",
	        f: "geojson",
	    });
	    await fetchData(url, params, featureCollection, onError, abortController || new AbortController(), onPageReceived, disablePagination, pageSize, bytesLimit);
	    return featureCollection;
	}
	async function fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination = false, pageSize = 1000, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount) {
	    bytesReceived = bytesReceived || 0;
	    new TextDecoder("utf-8");
	    params.set("returnIdsOnly", "false");
	    if (featureCollection.features.length > 0) {
	        params.delete("where");
	        params.delete("resultOffset");
	        params.delete("resultRecordCount");
	        params.set("orderByFields", objectIdFieldName);
	        const lastFeature = featureCollection.features[featureCollection.features.length - 1];
	        params.set("where", `${objectIdFieldName}>${lastFeature.id}`);
	    }
	    const response = await fetch(`${baseUrl}/query?${params.toString()}`, {
	        mode: "cors",
	        signal: abortController.signal,
	    });
	    const str = await response.text();
	    bytesReceived += byteLength(str);
	    if (bytesLimit && bytesReceived >= bytesLimit) {
	        const e = new Error(`Exceeded bytesLimit. ${bytesReceived} >= ${bytesLimit}`);
	        return onError(e);
	    }
	    const fc = JSON.parse(str);
	    if (fc.error) {
	        return onError(new Error(fc.error.message));
	    }
	    else {
	        featureCollection.features.push(...fc.features);
	        if (fc.exceededTransferLimit ||
	            ("properties" in fc && fc.properties.exceededTransferLimit)) {
	            if (!objectIdFieldName) {
	                params.set("returnIdsOnly", "true");
	                try {
	                    const r = await fetch(`${baseUrl}/query?${params.toString()}`, {
	                        mode: "cors",
	                        signal: abortController.signal,
	                    });
	                    const featureIds = featureCollection.features.map((f) => f.id);
	                    const objectIdParameters = await r.json();
	                    expectedFeatureCount = objectIdParameters.objectIds
	                        ? objectIdParameters.objectIds.length
	                        : objectIdParameters.properties.objectIds.length;
	                    objectIdFieldName =
	                        "properties" in objectIdParameters
	                            ? objectIdParameters.properties.objectIdFieldName
	                            : objectIdParameters.objectIdFieldName;
	                }
	                catch (e) {
	                    return onError(e);
	                }
	            }
	            if (onPageReceived) {
	                onPageReceived(bytesReceived, featureCollection.features.length, expectedFeatureCount);
	            }
	            await fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination, pageSize, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount);
	        }
	    }
	    if (onPageReceived) {
	        onPageReceived(bytesReceived, featureCollection.features.length, expectedFeatureCount);
	    }
	    return bytesReceived;
	}
	function byteLength(str) {
	    var s = str.length;
	    for (var i = str.length - 1; i >= 0; i--) {
	        var code = str.charCodeAt(i);
	        if (code > 0x7f && code <= 0x7ff)
	            s++;
	        else if (code > 0x7ff && code <= 0xffff)
	            s += 2;
	        if (code >= 0xdc00 && code <= 0xdfff)
	            i--;
	    }
	    return s;
	}
	});

	var ArcGISRESTServiceRequestManager_1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ArcGISRESTServiceRequestManager = void 0;
	exports.fetchWithTTL = fetchWithTTL;
	class ArcGISRESTServiceRequestManager {
	    constructor(options) {
	        this.inFlightRequests = {};
	        if (window.caches) {
	            window.caches
	                .open((options === null || options === void 0 ? void 0 : options.cacheKey) || "seasketch-arcgis-rest-services")
	                .then((cache) => {
	                this.cache = cache;
	                cache.keys().then(async (keys) => {
	                    for (const key of keys) {
	                        const res = await cache.match(key);
	                        if (res) {
	                            if (cachedResponseIsExpired(res)) {
	                                cache.delete(key);
	                            }
	                        }
	                    }
	                });
	            });
	        }
	    }
	    async getMapServiceMetadata(url, options) {
	        if (!/rest\/services/.test(url)) {
	            throw new Error("Invalid ArcGIS REST Service URL");
	        }
	        if (!/MapServer/.test(url)) {
	            throw new Error("Invalid MapServer URL");
	        }
	        url = url.replace(/\/$/, "");
	        url = url.replace(/\?.*$/, "");
	        const params = new URLSearchParams();
	        params.set("f", "json");
	        if (options === null || options === void 0 ? void 0 : options.token) {
	            params.set("token", options.token);
	        }
	        const requestUrl = `${url}?${params.toString()}`;
	        const serviceMetadata = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
	        const layers = await this.fetch(`${url}/layers/?${params.toString()}`);
	        if (layers.error) {
	            throw new Error(layers.error.message);
	        }
	        return { serviceMetadata, layers };
	    }
	    async getFeatureServerMetadata(url, options) {
	        url = url.replace(/\/$/, "");
	        if (!/rest\/services/.test(url)) {
	            throw new Error("Invalid ArcGIS REST Service URL");
	        }
	        if (!/FeatureServer/.test(url)) {
	            throw new Error("Invalid FeatureServer URL");
	        }
	        if (/\d+$/.test(url)) {
	            throw new Error("Invalid FeatureServer URL");
	        }
	        url = url.replace(/\?.*$/, "");
	        const params = new URLSearchParams();
	        params.set("f", "json");
	        if (options === null || options === void 0 ? void 0 : options.token) {
	            params.set("token", options.token);
	        }
	        const requestUrl = `${url}${url.endsWith("/") ? "" : "/"}?${params.toString()}`;
	        const serviceMetadata = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
	        const layers = await this.fetch(`${url}/layers/?${params.toString()}`);
	        if (layers.error) {
	            throw new Error(layers.error.message);
	        }
	        return { serviceMetadata, layers };
	    }
	    async getCatalogItems(url, options) {
	        if (!/rest\/services/.test(url)) {
	            throw new Error("Invalid ArcGIS REST Service URL");
	        }
	        url = url.replace(/\/$/, "");
	        url = url.replace(/\?.*$/, "");
	        const params = new URLSearchParams();
	        params.set("f", "json");
	        if (options === null || options === void 0 ? void 0 : options.token) {
	            params.set("token", options === null || options === void 0 ? void 0 : options.token);
	        }
	        const requestUrl = `${url}${url.endsWith("/") ? "" : "/"}?${params.toString()}`;
	        const response = await this.fetch(requestUrl, options === null || options === void 0 ? void 0 : options.signal);
	        return response;
	    }
	    async fetch(url, signal) {
	        if (url in this.inFlightRequests) {
	            return this.inFlightRequests[url].then((json) => json);
	        }
	        const cache = await this.cache;
	        this.inFlightRequests[url] = fetchWithTTL(url, 60 * 300, cache, {
	            signal,
	        }).then((r) => r.json());
	        return new Promise((resolve, reject) => {
	            this.inFlightRequests[url]
	                .then((json) => {
	                if (json["error"]) {
	                    reject(new Error(json["error"].message));
	                }
	                else {
	                    resolve(json);
	                }
	            })
	                .catch(reject)
	                .finally(() => {
	                delete this.inFlightRequests[url];
	            });
	        });
	    }
	    async getLegendMetadata(url, token) {
	        if (!/rest\/services/.test(url)) {
	            throw new Error("Invalid ArcGIS REST Service URL");
	        }
	        if (!/MapServer/.test(url) && !/FeatureServer/.test(url)) {
	            throw new Error("Invalid MapServer or FeatureServer URL");
	        }
	        url = url.replace(/\/$/, "");
	        url = url.replace(/\?.*$/, "");
	        const params = new URLSearchParams();
	        params.set("f", "json");
	        if (token) {
	            params.set("token", token);
	        }
	        const requestUrl = `${url}/legend/?${params.toString()}`;
	        const response = await this.fetch(requestUrl);
	        return response;
	    }
	}
	exports.ArcGISRESTServiceRequestManager = ArcGISRESTServiceRequestManager;
	function cachedResponseIsExpired(response) {
	    const cacheControlHeader = response.headers.get("Cache-Control");
	    if (cacheControlHeader) {
	        const expires = /expires=(.*)/i.exec(cacheControlHeader);
	        if (expires) {
	            const expiration = new Date(expires[1]);
	            if (new Date().getTime() > expiration.getTime()) {
	                return true;
	            }
	            else {
	                return false;
	            }
	        }
	    }
	    return false;
	}
	async function fetchWithTTL(url, ttl, cache, options, cacheKey) {
	    var _a, _b, _c;
	    if (!((_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.aborted)) {
	        const request = new Request(url, options);
	        if ((_b = options === null || options === void 0 ? void 0 : options.signal) === null || _b === void 0 ? void 0 : _b.aborted) {
	            Promise.reject("aborted");
	        }
	        let cachedResponse = await (cache === null || cache === void 0 ? void 0 : cache.match(cacheKey ? new URL(cacheKey) : request));
	        if (cachedResponse && cachedResponseIsExpired(cachedResponse)) {
	            cache === null || cache === void 0 ? void 0 : cache.delete(cacheKey ? new URL(cacheKey) : request);
	            cachedResponse = undefined;
	        }
	        if (cachedResponse && cachedResponse.ok) {
	            return cachedResponse;
	        }
	        else {
	            const response = await fetch(url, options);
	            if (!((_c = options === null || options === void 0 ? void 0 : options.signal) === null || _c === void 0 ? void 0 : _c.aborted)) {
	                const headers = new Headers(response.headers);
	                headers.set("Cache-Control", `Expires=${new Date(new Date().getTime() + 1000 * ttl).toUTCString()}`);
	                const copy = response.clone();
	                const clone = new Response(copy.body, {
	                    headers,
	                    status: response.status,
	                    statusText: response.statusText,
	                });
	                if (clone.ok && clone.status === 200) {
	                    cache === null || cache === void 0 ? void 0 : cache.put(cacheKey || url, clone).catch((e) => {
	                    });
	                }
	            }
	            return await response;
	        }
	    }
	}
	});

	var d2r = Math.PI / 180,
	    r2d = 180 / Math.PI;
	function tileToBBOX(tile) {
	    var e = tile2lon(tile[0] + 1, tile[2]);
	    var w = tile2lon(tile[0], tile[2]);
	    var s = tile2lat(tile[1] + 1, tile[2]);
	    var n = tile2lat(tile[1], tile[2]);
	    return [w, s, e, n];
	}
	function tileToGeoJSON(tile) {
	    var bbox = tileToBBOX(tile);
	    var poly = {
	        type: 'Polygon',
	        coordinates: [[
	            [bbox[0], bbox[3]],
	            [bbox[0], bbox[1]],
	            [bbox[2], bbox[1]],
	            [bbox[2], bbox[3]],
	            [bbox[0], bbox[3]]
	        ]]
	    };
	    return poly;
	}
	function tile2lon(x, z) {
	    return x / Math.pow(2, z) * 360 - 180;
	}
	function tile2lat(y, z) {
	    var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
	    return r2d * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
	}
	function pointToTile(lon, lat, z) {
	    var tile = pointToTileFraction(lon, lat, z);
	    tile[0] = Math.floor(tile[0]);
	    tile[1] = Math.floor(tile[1]);
	    return tile;
	}
	function getChildren(tile) {
	    return [
	        [tile[0] * 2, tile[1] * 2, tile[2] + 1],
	        [tile[0] * 2 + 1, tile[1] * 2, tile[2 ] + 1],
	        [tile[0] * 2 + 1, tile[1] * 2 + 1, tile[2] + 1],
	        [tile[0] * 2, tile[1] * 2 + 1, tile[2] + 1]
	    ];
	}
	function getParent(tile) {
	    return [tile[0] >> 1, tile[1] >> 1, tile[2] - 1];
	}
	function getSiblings(tile) {
	    return getChildren(getParent(tile));
	}
	function hasSiblings(tile, tiles) {
	    var siblings = getSiblings(tile);
	    for (var i = 0; i < siblings.length; i++) {
	        if (!hasTile(tiles, siblings[i])) return false;
	    }
	    return true;
	}
	function hasTile(tiles, tile) {
	    for (var i = 0; i < tiles.length; i++) {
	        if (tilesEqual(tiles[i], tile)) return true;
	    }
	    return false;
	}
	function tilesEqual(tile1, tile2) {
	    return (
	        tile1[0] === tile2[0] &&
	        tile1[1] === tile2[1] &&
	        tile1[2] === tile2[2]
	    );
	}
	function tileToQuadkey(tile) {
	    var index = '';
	    for (var z = tile[2]; z > 0; z--) {
	        var b = 0;
	        var mask = 1 << (z - 1);
	        if ((tile[0] & mask) !== 0) b++;
	        if ((tile[1] & mask) !== 0) b += 2;
	        index += b.toString();
	    }
	    return index;
	}
	function quadkeyToTile(quadkey) {
	    var x = 0;
	    var y = 0;
	    var z = quadkey.length;
	    for (var i = z; i > 0; i--) {
	        var mask = 1 << (i - 1);
	        var q = +quadkey[z - i];
	        if (q === 1) x |= mask;
	        if (q === 2) y |= mask;
	        if (q === 3) {
	            x |= mask;
	            y |= mask;
	        }
	    }
	    return [x, y, z];
	}
	function bboxToTile(bboxCoords) {
	    var min = pointToTile(bboxCoords[0], bboxCoords[1], 32);
	    var max = pointToTile(bboxCoords[2], bboxCoords[3], 32);
	    var bbox = [min[0], min[1], max[0], max[1]];
	    var z = getBboxZoom(bbox);
	    if (z === 0) return [0, 0, 0];
	    var x = bbox[0] >>> (32 - z);
	    var y = bbox[1] >>> (32 - z);
	    return [x, y, z];
	}
	function getBboxZoom(bbox) {
	    var MAX_ZOOM = 28;
	    for (var z = 0; z < MAX_ZOOM; z++) {
	        var mask = 1 << (32 - (z + 1));
	        if (((bbox[0] & mask) !== (bbox[2] & mask)) ||
	            ((bbox[1] & mask) !== (bbox[3] & mask))) {
	            return z;
	        }
	    }
	    return MAX_ZOOM;
	}
	function pointToTileFraction(lon, lat, z) {
	    var sin = Math.sin(lat * d2r),
	        z2 = Math.pow(2, z),
	        x = z2 * (lon / 360 + 0.5),
	        y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
	    x = x % z2;
	    if (x < 0) x = x + z2;
	    return [x, y, z];
	}
	var tilebelt = {
	    tileToGeoJSON: tileToGeoJSON,
	    tileToBBOX: tileToBBOX,
	    getChildren: getChildren,
	    getParent: getParent,
	    getSiblings: getSiblings,
	    hasTile: hasTile,
	    hasSiblings: hasSiblings,
	    tilesEqual: tilesEqual,
	    tileToQuadkey: tileToQuadkey,
	    quadkeyToTile: quadkeyToTile,
	    pointToTile: pointToTile,
	    bboxToTile: bboxToTile,
	    pointToTileFraction: pointToTileFraction
	};

	var ArcGISTiledMapService_1 = createCommonjsModule(function (module, exports) {
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
	    Object.defineProperty(o, "default", { enumerable: true, value: v });
	}) : function(o, v) {
	    o["default"] = v;
	});
	var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
	    if (mod && mod.__esModule) return mod;
	    var result = {};
	    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
	    __setModuleDefault(result, mod);
	    return result;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ArcGISTiledMapService = void 0;
	exports.isArcGISTiledMapservice = isArcGISTiledMapservice;
	const tilebelt$1 = __importStar(tilebelt);
	class ArcGISTiledMapService {
	    constructor(requestManager, options) {
	        this.type = "ArcGISTiledMapService";
	        options.url = options.url.replace(/\/$/, "");
	        this.url = options.url;
	        if (!/rest\/services/.test(options.url) || !/MapServer/.test(options.url)) {
	            throw new Error("Invalid ArcGIS REST Service URL");
	        }
	        this.requestManager = requestManager;
	        this.sourceId = options.sourceId || (0, esmBrowser.v4)();
	        this.options = options;
	    }
	    getMetadata() {
	        if (this.serviceMetadata && this.layerMetadata) {
	            return Promise.resolve({
	                serviceMetadata: this.serviceMetadata,
	                layers: this.layerMetadata,
	            });
	        }
	        else {
	            return this.requestManager
	                .getMapServiceMetadata(this.options.url, {
	                token: this.options.token,
	            })
	                .then(({ serviceMetadata, layers }) => {
	                this.serviceMetadata = serviceMetadata;
	                this.layerMetadata = layers;
	                return { serviceMetadata, layers };
	            });
	        }
	    }
	    async getComputedMetadata() {
	        var _a, _b;
	        try {
	            if (!this._computedMetadata) {
	                const { serviceMetadata, layers } = await this.getMetadata();
	                const { bounds, minzoom, maxzoom, tileSize, attribution } = await this.getComputedProperties();
	                const legendData = await this.requestManager.getLegendMetadata(this.options.url);
	                const results = /\/([^/]+)\/MapServer/.exec(this.options.url);
	                let label = results && results.length >= 1 ? results[1] : false;
	                if (!label) {
	                    if ((_b = (_a = this.layerMetadata) === null || _a === void 0 ? void 0 : _a.layers) === null || _b === void 0 ? void 0 : _b[0]) {
	                        label = this.layerMetadata.layers[0].name;
	                    }
	                }
	                this._computedMetadata = {
	                    bounds: bounds || undefined,
	                    minzoom,
	                    maxzoom,
	                    attribution,
	                    tableOfContentsItems: [
	                        {
	                            type: "data",
	                            id: this.sourceId,
	                            label: label || "Layer",
	                            defaultVisibility: true,
	                            metadata: (0, utils$1.generateMetadataForLayer)(this.options.url, this.serviceMetadata, this.layerMetadata.layers[0]),
	                            legend: (0, utils$1.makeLegend)(legendData, legendData.layers[0].layerId),
	                        },
	                    ],
	                    supportsDynamicRendering: {
	                        layerOrder: false,
	                        layerOpacity: false,
	                        layerVisibility: false,
	                    },
	                };
	            }
	            return this._computedMetadata;
	        }
	        catch (e) {
	            this.error = e.toString();
	            throw e;
	        }
	    }
	    async getThumbnailForCurrentExtent() {
	        if (!this.map) {
	            throw new Error("Map not set");
	        }
	        const { minzoom } = await this.getComputedProperties();
	        const map = this.map;
	        const bounds = map.getBounds();
	        const boundsArray = bounds.toArray();
	        const primaryTile = tilebelt$1.bboxToTile([
	            boundsArray[0][0],
	            boundsArray[0][1],
	            boundsArray[1][0],
	            boundsArray[1][1],
	        ]);
	        let [x, y, z] = primaryTile;
	        if (primaryTile[2] < minzoom) {
	            let tile = primaryTile;
	            while (tile[2] < minzoom) {
	                tile = tilebelt$1.getChildren(tile)[0];
	            }
	            [x, y, z] = tile;
	        }
	        const url = `${this.options.url}/tile/${z}/${y}/${x}`;
	        const res = await fetch(url);
	        if (res.ok) {
	            return url;
	        }
	        else {
	            const children = tilebelt$1.getChildren(primaryTile);
	            for (const child of children) {
	                const res = await fetch(url);
	                if (res.ok) {
	                    return url;
	                }
	            }
	            return ArcGISDynamicMapService_1.blankDataUri;
	        }
	    }
	    get loading() {
	        var _a, _b;
	        return Boolean(((_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId)) &&
	            ((_b = this.map) === null || _b === void 0 ? void 0 : _b.isSourceLoaded(this.sourceId)) === false);
	    }
	    async getComputedProperties() {
	        var _a, _b, _c;
	        const { serviceMetadata, layers } = await this.getMetadata();
	        const levels = ((_a = serviceMetadata.tileInfo) === null || _a === void 0 ? void 0 : _a.lods.map((l) => l.level)) || [];
	        const attribution = (0, utils$1.contentOrFalse)(layers.layers[0].copyrightText) ||
	            (0, utils$1.contentOrFalse)(serviceMetadata.copyrightText) ||
	            (0, utils$1.contentOrFalse)((_b = serviceMetadata.documentInfo) === null || _b === void 0 ? void 0 : _b.Author) ||
	            undefined;
	        const minzoom = serviceMetadata.minLOD
	            ? serviceMetadata.minLOD
	            : Math.min(...levels);
	        const maxzoom = serviceMetadata.maxLOD
	            ? serviceMetadata.maxLOD
	            : Math.max(...levels);
	        if (!((_c = serviceMetadata.tileInfo) === null || _c === void 0 ? void 0 : _c.rows)) {
	            throw new Error("Invalid tile info");
	        }
	        return {
	            minzoom,
	            maxzoom,
	            bounds: await (0, utils$1.extentToLatLngBounds)(serviceMetadata.fullExtent),
	            tileSize: serviceMetadata.tileInfo.rows,
	            ...(attribution ? { attribution } : {}),
	        };
	    }
	    async addToMap(map) {
	        this.map = map;
	        const sourceData = await this.getGLSource();
	        if (this.map.getSource(this.sourceId)) {
	            (0, utils$1.replaceSource)(this.sourceId, this.map, sourceData);
	        }
	        else {
	            this.map.addSource(this.sourceId, sourceData);
	        }
	        return this.sourceId;
	    }
	    async getGLSource() {
	        let { minzoom, maxzoom, bounds, tileSize, attribution } = await this.getComputedProperties();
	        attribution = this.options.attributionOverride || attribution;
	        let url = `${this.options.url}/tile/{z}/{y}/{x}`;
	        if (url.indexOf("services.arcgisonline.com") !== -1 &&
	            this.options.developerApiKey) {
	            url = `${url}?token=${this.options.developerApiKey}`;
	        }
	        const sourceData = {
	            type: "raster",
	            tiles: [url],
	            tileSize,
	            minzoom,
	            maxzoom: this.options.maxZoom || maxzoom,
	            ...(attribution ? { attribution } : {}),
	            ...(bounds ? { bounds } : {}),
	        };
	        return sourceData;
	    }
	    async getGLStyleLayers() {
	        return {
	            layers: [
	                {
	                    type: "raster",
	                    source: this.sourceId,
	                    id: (0, esmBrowser.v4)(),
	                    paint: {
	                        "raster-fade-duration": 300,
	                    },
	                },
	            ],
	        };
	    }
	    removeFromMap(map) {
	        const removedLayers = [];
	        if (map.getSource(this.sourceId)) {
	            const layers = map.getStyle().layers || [];
	            for (const layer of layers) {
	                if ("source" in layer && layer.source === this.sourceId) {
	                    map.removeLayer(layer.id);
	                    removedLayers.push(layer);
	                }
	            }
	            map.removeSource(this.sourceId);
	            this.map = undefined;
	        }
	        return removedLayers;
	    }
	    destroy() {
	        if (this.map) {
	            this.removeFromMap(this.map);
	        }
	    }
	    async updateMaxZoom(maxZoom) {
	        const currentMaxZoom = (await this.getGLSource()).maxzoom;
	        if (currentMaxZoom !== maxZoom) {
	            this.options.maxZoom = maxZoom;
	            if (this.map) {
	                const map = this.map;
	                const removedLayers = this.removeFromMap(map);
	                this.addToMap(map);
	                for (const layer of removedLayers) {
	                    map.addLayer(layer);
	                }
	            }
	        }
	    }
	    updateLayers(layers) { }
	    get ready() {
	        return Boolean(this._computedMetadata);
	    }
	    async prepare() {
	        await this.getComputedMetadata();
	        return;
	    }
	    addEventListeners(map) {
	        this.map = map;
	    }
	    removeEventListeners(map) { }
	}
	exports.ArcGISTiledMapService = ArcGISTiledMapService;
	function isArcGISTiledMapservice(source) {
	    return source.type === "ArcGISTiledMapService";
	}
	});

	var fetchData_1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.fetchFeatureCollection = fetchFeatureCollection;
	exports.fetchFeatureLayerData = fetchFeatureLayerData;
	exports.urlForRawGeoJSONData = urlForRawGeoJSONData;
	function fetchFeatureCollection(url, geometryPrecision = 6, outFields = "*", bytesLimit = 1000000 * 100, abortController = null, disablePagination = false) {
	    return new Promise((resolve, reject) => {
	        fetchFeatureLayerData(url, outFields, reject, geometryPrecision, abortController, null, disablePagination, undefined, bytesLimit)
	            .then((data) => resolve(data))
	            .catch((e) => reject(e));
	    });
	}
	async function fetchFeatureLayerData(url, outFields, onError, geometryPrecision = 6, abortController = null, onPageReceived = null, disablePagination = false, pageSize = 1000, bytesLimit) {
	    const featureCollection = {
	        type: "FeatureCollection",
	        features: [],
	    };
	    const params = new URLSearchParams({
	        inSR: "4326",
	        outSR: "4326",
	        where: "1>0",
	        outFields,
	        returnGeometry: "true",
	        geometryPrecision: geometryPrecision.toString(),
	        returnIdsOnly: "false",
	        f: "geojson",
	    });
	    await fetchData(url, params, featureCollection, onError, abortController, onPageReceived, disablePagination, pageSize, bytesLimit);
	    return featureCollection;
	}
	function urlForRawGeoJSONData(baseUrl, outFields = "*", geometryPrecision = 6, queryOptions) {
	    const params = new URLSearchParams({
	        inSR: "4326",
	        outSR: "4326",
	        where: "1>0",
	        outFields,
	        returnGeometry: "true",
	        geometryPrecision: geometryPrecision.toString(),
	        returnIdsOnly: "false",
	        f: "geojson",
	        ...(queryOptions || {}),
	    });
	    return `${baseUrl}/query?${params.toString()}`;
	}
	async function fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination = false, pageSize = 1000, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount) {
	    var _a;
	    bytesReceived = bytesReceived || 0;
	    new TextDecoder("utf-8");
	    params.set("returnIdsOnly", "false");
	    if (featureCollection.features.length > 0) {
	        params.delete("where");
	        params.delete("resultOffset");
	        params.delete("resultRecordCount");
	        params.set("orderByFields", objectIdFieldName);
	        const lastFeature = featureCollection.features[featureCollection.features.length - 1];
	        params.set("where", `${objectIdFieldName}>${lastFeature.id}`);
	    }
	    const response = await fetch(`${baseUrl}/query?${params.toString()}`, {
	        ...(abortController ? { signal: abortController.signal } : {}),
	    });
	    const str = await response.text();
	    bytesReceived += byteLength(str);
	    if (bytesLimit && bytesReceived > bytesLimit) {
	        const e = new Error(`Exceeded bytesLimit. ${bytesReceived} > ${bytesLimit}`);
	        return onError(e);
	    }
	    const fc = JSON.parse(str);
	    if (fc.error) {
	        return onError(new Error(fc.error.message));
	    }
	    else {
	        featureCollection.features.push(...fc.features);
	        if (fc.exceededTransferLimit || ((_a = fc.properties) === null || _a === void 0 ? void 0 : _a.exceededTransferLimit)) {
	            if (disablePagination) {
	                throw new Error("Exceeded transfer limit. Pagination disabled.");
	            }
	            if (!objectIdFieldName) {
	                params.set("returnIdsOnly", "true");
	                try {
	                    const r = await fetch(`${baseUrl}/query?${params.toString()}`, {
	                        ...(abortController ? { signal: abortController.signal } : {}),
	                    });
	                    let objectIdParameters = await r.json();
	                    if (objectIdParameters.properties) {
	                        objectIdParameters = objectIdParameters.properties;
	                    }
	                    expectedFeatureCount = objectIdParameters.objectIds.length;
	                    objectIdFieldName = objectIdParameters.objectIdFieldName;
	                }
	                catch (e) {
	                    return onError(e);
	                }
	            }
	            if (onPageReceived) {
	                onPageReceived(bytesReceived, featureCollection.features.length, expectedFeatureCount);
	            }
	            await fetchData(baseUrl, params, featureCollection, onError, abortController, onPageReceived, disablePagination, pageSize, bytesLimit, bytesReceived, objectIdFieldName, expectedFeatureCount);
	        }
	    }
	    return bytesReceived;
	}
	function byteLength(str) {
	    var s = str.length;
	    for (var i = str.length - 1; i >= 0; i--) {
	        var code = str.charCodeAt(i);
	        if (code > 0x7f && code <= 0x7ff)
	            s++;
	        else if (code > 0x7ff && code <= 0xffff)
	            s += 2;
	        if (code >= 0xdc00 && code <= 0xdfff)
	            i--;
	    }
	    return s;
	}
	});

	var eventemitter3$1 = createCommonjsModule(function (module) {
	var has = Object.prototype.hasOwnProperty
	  , prefix = '~';
	function Events() {}
	if (Object.create) {
	  Events.prototype = Object.create(null);
	  if (!new Events().__proto__) prefix = false;
	}
	function EE(fn, context, once) {
	  this.fn = fn;
	  this.context = context;
	  this.once = once || false;
	}
	function addListener(emitter, event, fn, context, once) {
	  if (typeof fn !== 'function') {
	    throw new TypeError('The listener must be a function');
	  }
	  var listener = new EE(fn, context || emitter, once)
	    , evt = prefix ? prefix + event : event;
	  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
	  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
	  else emitter._events[evt] = [emitter._events[evt], listener];
	  return emitter;
	}
	function clearEvent(emitter, evt) {
	  if (--emitter._eventsCount === 0) emitter._events = new Events();
	  else delete emitter._events[evt];
	}
	function EventEmitter() {
	  this._events = new Events();
	  this._eventsCount = 0;
	}
	EventEmitter.prototype.eventNames = function eventNames() {
	  var names = []
	    , events
	    , name;
	  if (this._eventsCount === 0) return names;
	  for (name in (events = this._events)) {
	    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
	  }
	  if (Object.getOwnPropertySymbols) {
	    return names.concat(Object.getOwnPropertySymbols(events));
	  }
	  return names;
	};
	EventEmitter.prototype.listeners = function listeners(event) {
	  var evt = prefix ? prefix + event : event
	    , handlers = this._events[evt];
	  if (!handlers) return [];
	  if (handlers.fn) return [handlers.fn];
	  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
	    ee[i] = handlers[i].fn;
	  }
	  return ee;
	};
	EventEmitter.prototype.listenerCount = function listenerCount(event) {
	  var evt = prefix ? prefix + event : event
	    , listeners = this._events[evt];
	  if (!listeners) return 0;
	  if (listeners.fn) return 1;
	  return listeners.length;
	};
	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
	  var evt = prefix ? prefix + event : event;
	  if (!this._events[evt]) return false;
	  var listeners = this._events[evt]
	    , len = arguments.length
	    , args
	    , i;
	  if (listeners.fn) {
	    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);
	    switch (len) {
	      case 1: return listeners.fn.call(listeners.context), true;
	      case 2: return listeners.fn.call(listeners.context, a1), true;
	      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
	      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
	      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
	      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
	    }
	    for (i = 1, args = new Array(len -1); i < len; i++) {
	      args[i - 1] = arguments[i];
	    }
	    listeners.fn.apply(listeners.context, args);
	  } else {
	    var length = listeners.length
	      , j;
	    for (i = 0; i < length; i++) {
	      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);
	      switch (len) {
	        case 1: listeners[i].fn.call(listeners[i].context); break;
	        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
	        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
	        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
	        default:
	          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
	            args[j - 1] = arguments[j];
	          }
	          listeners[i].fn.apply(listeners[i].context, args);
	      }
	    }
	  }
	  return true;
	};
	EventEmitter.prototype.on = function on(event, fn, context) {
	  return addListener(this, event, fn, context, false);
	};
	EventEmitter.prototype.once = function once(event, fn, context) {
	  return addListener(this, event, fn, context, true);
	};
	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
	  var evt = prefix ? prefix + event : event;
	  if (!this._events[evt]) return this;
	  if (!fn) {
	    clearEvent(this, evt);
	    return this;
	  }
	  var listeners = this._events[evt];
	  if (listeners.fn) {
	    if (
	      listeners.fn === fn &&
	      (!once || listeners.once) &&
	      (!context || listeners.context === context)
	    ) {
	      clearEvent(this, evt);
	    }
	  } else {
	    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
	      if (
	        listeners[i].fn !== fn ||
	        (once && !listeners[i].once) ||
	        (context && listeners[i].context !== context)
	      ) {
	        events.push(listeners[i]);
	      }
	    }
	    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
	    else clearEvent(this, evt);
	  }
	  return this;
	};
	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
	  var evt;
	  if (event) {
	    evt = prefix ? prefix + event : event;
	    if (this._events[evt]) clearEvent(this, evt);
	  } else {
	    this._events = new Events();
	    this._eventsCount = 0;
	  }
	  return this;
	};
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;
	EventEmitter.prefixed = prefix;
	EventEmitter.EventEmitter = EventEmitter;
	{
	  module.exports = EventEmitter;
	}
	});

	var eventemitter3 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		EventEmitter: eventemitter3$1,
		'default': eventemitter3$1
	});

	var FUNC_ERROR_TEXT = 'Expected a function';
	var NAN = 0 / 0;
	var symbolTag = '[object Symbol]';
	var reTrim = /^\s+|\s+$/g;
	var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
	var reIsBinary = /^0b[01]+$/i;
	var reIsOctal = /^0o[0-7]+$/i;
	var freeParseInt = parseInt;
	var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
	var freeSelf = typeof self == 'object' && self && self.Object === Object && self;
	var root = freeGlobal || freeSelf || Function('return this')();
	var objectProto = Object.prototype;
	var objectToString = objectProto.toString;
	var nativeMax = Math.max,
	    nativeMin = Math.min;
	var now = function() {
	  return root.Date.now();
	};
	function debounce(func, wait, options) {
	  var lastArgs,
	      lastThis,
	      maxWait,
	      result,
	      timerId,
	      lastCallTime,
	      lastInvokeTime = 0,
	      leading = false,
	      maxing = false,
	      trailing = true;
	  if (typeof func != 'function') {
	    throw new TypeError(FUNC_ERROR_TEXT);
	  }
	  wait = toNumber(wait) || 0;
	  if (isObject(options)) {
	    leading = !!options.leading;
	    maxing = 'maxWait' in options;
	    maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
	    trailing = 'trailing' in options ? !!options.trailing : trailing;
	  }
	  function invokeFunc(time) {
	    var args = lastArgs,
	        thisArg = lastThis;
	    lastArgs = lastThis = undefined;
	    lastInvokeTime = time;
	    result = func.apply(thisArg, args);
	    return result;
	  }
	  function leadingEdge(time) {
	    lastInvokeTime = time;
	    timerId = setTimeout(timerExpired, wait);
	    return leading ? invokeFunc(time) : result;
	  }
	  function remainingWait(time) {
	    var timeSinceLastCall = time - lastCallTime,
	        timeSinceLastInvoke = time - lastInvokeTime,
	        result = wait - timeSinceLastCall;
	    return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
	  }
	  function shouldInvoke(time) {
	    var timeSinceLastCall = time - lastCallTime,
	        timeSinceLastInvoke = time - lastInvokeTime;
	    return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
	      (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
	  }
	  function timerExpired() {
	    var time = now();
	    if (shouldInvoke(time)) {
	      return trailingEdge(time);
	    }
	    timerId = setTimeout(timerExpired, remainingWait(time));
	  }
	  function trailingEdge(time) {
	    timerId = undefined;
	    if (trailing && lastArgs) {
	      return invokeFunc(time);
	    }
	    lastArgs = lastThis = undefined;
	    return result;
	  }
	  function cancel() {
	    if (timerId !== undefined) {
	      clearTimeout(timerId);
	    }
	    lastInvokeTime = 0;
	    lastArgs = lastCallTime = lastThis = timerId = undefined;
	  }
	  function flush() {
	    return timerId === undefined ? result : trailingEdge(now());
	  }
	  function debounced() {
	    var time = now(),
	        isInvoking = shouldInvoke(time);
	    lastArgs = arguments;
	    lastThis = this;
	    lastCallTime = time;
	    if (isInvoking) {
	      if (timerId === undefined) {
	        return leadingEdge(lastCallTime);
	      }
	      if (maxing) {
	        timerId = setTimeout(timerExpired, wait);
	        return invokeFunc(lastCallTime);
	      }
	    }
	    if (timerId === undefined) {
	      timerId = setTimeout(timerExpired, wait);
	    }
	    return result;
	  }
	  debounced.cancel = cancel;
	  debounced.flush = flush;
	  return debounced;
	}
	function isObject(value) {
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}
	function isSymbol(value) {
	  return typeof value == 'symbol' ||
	    (isObjectLike(value) && objectToString.call(value) == symbolTag);
	}
	function toNumber(value) {
	  if (typeof value == 'number') {
	    return value;
	  }
	  if (isSymbol(value)) {
	    return NAN;
	  }
	  if (isObject(value)) {
	    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
	    value = isObject(other) ? (other + '') : other;
	  }
	  if (typeof value != 'string') {
	    return value === 0 ? value : +value;
	  }
	  value = value.replace(reTrim, '');
	  var isBinary = reIsBinary.test(value);
	  return (isBinary || reIsOctal.test(value))
	    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
	    : (reIsBadHex.test(value) ? NAN : +value);
	}
	var lodash_debounce = debounce;

	var EventEmitter = getCjsExportFromNamespace(eventemitter3);

	var QuantizedVectorRequestManager_1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.QuantizedVectorRequestManager = void 0;
	exports.getOrCreateQuantizedVectorRequestManager = getOrCreateQuantizedVectorRequestManager;
	class QuantizedVectorRequestManager extends EventEmitter {
	    constructor(map) {
	        super();
	        this.removeEventListeners = (map) => {
	            map.off("moveend", this.updateSources);
	            map.off("move", this.debouncedUpdateSources);
	            map.off("remove", this.removeEventListeners);
	            try {
	                this.removeDebugLayer();
	            }
	            catch (e) {
	            }
	        };
	        this.displayedTiles = "";
	        this._viewPortDetails = {
	            tiles: [],
	            tolerance: 0,
	        };
	        this.updateSources = () => {
	            const bounds = this.map.getBounds();
	            const boundsArray = bounds.toArray();
	            const tiles = this.getTilesForBounds(bounds);
	            const key = tiles
	                .map((t) => tilebelt.tileToQuadkey(t))
	                .sort()
	                .join(",");
	            if (key !== this.displayedTiles) {
	                this.displayedTiles = key;
	                const mapWidth = Math.abs(boundsArray[1][0] - boundsArray[0][0]);
	                const tolerance = (mapWidth / this.map.getCanvas().width) * 0.4;
	                this._viewPortDetails = {
	                    tiles,
	                    tolerance,
	                };
	                this.emit("update", { tiles });
	            }
	        };
	        this.debouncedUpdateSources = lodash_debounce(this.updateSources, 100, {
	            maxWait: 200,
	        });
	        this.map = map;
	        this.addEventListeners(map);
	    }
	    addDebugLayer() {
	        this.map.addSource("debug-quantized-vector-request-manager", {
	            type: "geojson",
	            data: {
	                type: "FeatureCollection",
	                features: [],
	            },
	        });
	        this.map.addLayer({
	            id: "debug-quantized-vector-request-manager",
	            type: "line",
	            source: "debug-quantized-vector-request-manager",
	            paint: {
	                "line-color": "red",
	                "line-width": 2,
	            },
	        });
	    }
	    removeDebugLayer() {
	        this.map.removeLayer("debug-quantized-vector-request-manager");
	        this.map.removeSource("debug-quantized-vector-request-manager");
	    }
	    addEventListeners(map) {
	        map.on("moveend", this.updateSources);
	        map.on("move", this.debouncedUpdateSources);
	        map.on("remove", this.removeEventListeners);
	    }
	    get viewportDetails() {
	        if (!this._viewPortDetails.tiles.length) {
	            this.intializeViewportDetails();
	        }
	        return this._viewPortDetails;
	    }
	    intializeViewportDetails() {
	        if (!this._viewPortDetails.tiles.length) {
	            const bounds = this.map.getBounds();
	            const boundsArray = bounds.toArray();
	            const tiles = this.getTilesForBounds(bounds);
	            const key = tiles
	                .map((t) => tilebelt.tileToQuadkey(t))
	                .sort()
	                .join(",");
	            this.displayedTiles = key;
	            const mapWidth = Math.abs(boundsArray[1][0] - boundsArray[0][0]);
	            const tolerance = (mapWidth / this.map.getCanvas().width) * 0.4;
	            this._viewPortDetails = {
	                tiles,
	                tolerance,
	            };
	        }
	    }
	    updateDebugLayer(tiles) {
	        const source = this.map.getSource("debug-quantized-vector-request-manager");
	        const fc = {
	            type: "FeatureCollection",
	            features: tiles.map((t) => ({
	                type: "Feature",
	                properties: { label: `${t[2]}/${t[0]}/${1}` },
	                geometry: tilebelt.tileToGeoJSON(t),
	            })),
	        };
	        source.setData(fc);
	    }
	    getTilesForBounds(bounds) {
	        const z = this.map.getZoom();
	        const boundsArray = bounds.toArray();
	        const primaryTile = tilebelt.bboxToTile([
	            boundsArray[0][0],
	            boundsArray[0][1],
	            boundsArray[1][0],
	            boundsArray[1][1],
	        ]);
	        const zoomLevel = 2 * Math.floor(z / 2);
	        const tilesToRequest = [];
	        if (primaryTile[2] < zoomLevel) {
	            let candidateTiles = tilebelt.getChildren(primaryTile);
	            let minZoomOfCandidates = candidateTiles[0][2];
	            while (minZoomOfCandidates < zoomLevel) {
	                const newCandidateTiles = [];
	                candidateTiles.forEach((t) => newCandidateTiles.push(...tilebelt.getChildren(t)));
	                candidateTiles = newCandidateTiles;
	                minZoomOfCandidates = candidateTiles[0][2];
	            }
	            for (let index = 0; index < candidateTiles.length; index++) {
	                if (this.doesTileOverlapBbox(candidateTiles[index], boundsArray)) {
	                    tilesToRequest.push(candidateTiles[index]);
	                }
	            }
	        }
	        else {
	            tilesToRequest.push(primaryTile);
	        }
	        return tilesToRequest;
	    }
	    doesTileOverlapBbox(tile, bbox) {
	        const tileBounds = tile.length === 4 ? tile : tilebelt.tileToBBOX(tile);
	        if (tileBounds[2] < bbox[0][0])
	            return false;
	        if (tileBounds[0] > bbox[1][0])
	            return false;
	        if (tileBounds[3] < bbox[0][1])
	            return false;
	        if (tileBounds[1] > bbox[1][1])
	            return false;
	        return true;
	    }
	}
	exports.QuantizedVectorRequestManager = QuantizedVectorRequestManager;
	const managers = new WeakMap();
	function getOrCreateQuantizedVectorRequestManager(map) {
	    if (!managers.has(map)) {
	        managers.set(map, new QuantizedVectorRequestManager(map));
	    }
	    return managers.get(map);
	}
	});

	/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
	var read = function (buffer, offset, isLE, mLen, nBytes) {
	  var e, m;
	  var eLen = (nBytes * 8) - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var nBits = -7;
	  var i = isLE ? (nBytes - 1) : 0;
	  var d = isLE ? -1 : 1;
	  var s = buffer[offset + i];
	  i += d;
	  e = s & ((1 << (-nBits)) - 1);
	  s >>= (-nBits);
	  nBits += eLen;
	  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}
	  m = e & ((1 << (-nBits)) - 1);
	  e >>= (-nBits);
	  nBits += mLen;
	  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}
	  if (e === 0) {
	    e = 1 - eBias;
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen);
	    e = e - eBias;
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	};
	var write = function (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c;
	  var eLen = (nBytes * 8) - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
	  var i = isLE ? 0 : (nBytes - 1);
	  var d = isLE ? 1 : -1;
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;
	  value = Math.abs(value);
	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0;
	    e = eMax;
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2);
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--;
	      c *= 2;
	    }
	    if (e + eBias >= 1) {
	      value += rt / c;
	    } else {
	      value += rt * Math.pow(2, 1 - eBias);
	    }
	    if (value * c >= 2) {
	      e++;
	      c /= 2;
	    }
	    if (e + eBias >= eMax) {
	      m = 0;
	      e = eMax;
	    } else if (e + eBias >= 1) {
	      m = ((value * c) - 1) * Math.pow(2, mLen);
	      e = e + eBias;
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
	      e = 0;
	    }
	  }
	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}
	  e = (e << mLen) | m;
	  eLen += mLen;
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}
	  buffer[offset + i - d] |= s * 128;
	};
	var ieee754 = {
		read: read,
		write: write
	};

	var pbf = Pbf;
	function Pbf(buf) {
	    this.buf = ArrayBuffer.isView && ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf || 0);
	    this.pos = 0;
	    this.type = 0;
	    this.length = this.buf.length;
	}
	Pbf.Varint  = 0;
	Pbf.Fixed64 = 1;
	Pbf.Bytes   = 2;
	Pbf.Fixed32 = 5;
	var SHIFT_LEFT_32 = (1 << 16) * (1 << 16),
	    SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
	var TEXT_DECODER_MIN_LENGTH = 12;
	var utf8TextDecoder = typeof TextDecoder === 'undefined' ? null : new TextDecoder('utf8');
	Pbf.prototype = {
	    destroy: function() {
	        this.buf = null;
	    },
	    readFields: function(readField, result, end) {
	        end = end || this.length;
	        while (this.pos < end) {
	            var val = this.readVarint(),
	                tag = val >> 3,
	                startPos = this.pos;
	            this.type = val & 0x7;
	            readField(tag, result, this);
	            if (this.pos === startPos) this.skip(val);
	        }
	        return result;
	    },
	    readMessage: function(readField, result) {
	        return this.readFields(readField, result, this.readVarint() + this.pos);
	    },
	    readFixed32: function() {
	        var val = readUInt32(this.buf, this.pos);
	        this.pos += 4;
	        return val;
	    },
	    readSFixed32: function() {
	        var val = readInt32(this.buf, this.pos);
	        this.pos += 4;
	        return val;
	    },
	    readFixed64: function() {
	        var val = readUInt32(this.buf, this.pos) + readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
	        this.pos += 8;
	        return val;
	    },
	    readSFixed64: function() {
	        var val = readUInt32(this.buf, this.pos) + readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
	        this.pos += 8;
	        return val;
	    },
	    readFloat: function() {
	        var val = ieee754.read(this.buf, this.pos, true, 23, 4);
	        this.pos += 4;
	        return val;
	    },
	    readDouble: function() {
	        var val = ieee754.read(this.buf, this.pos, true, 52, 8);
	        this.pos += 8;
	        return val;
	    },
	    readVarint: function(isSigned) {
	        var buf = this.buf,
	            val, b;
	        b = buf[this.pos++]; val  =  b & 0x7f;        if (b < 0x80) return val;
	        b = buf[this.pos++]; val |= (b & 0x7f) << 7;  if (b < 0x80) return val;
	        b = buf[this.pos++]; val |= (b & 0x7f) << 14; if (b < 0x80) return val;
	        b = buf[this.pos++]; val |= (b & 0x7f) << 21; if (b < 0x80) return val;
	        b = buf[this.pos];   val |= (b & 0x0f) << 28;
	        return readVarintRemainder(val, isSigned, this);
	    },
	    readVarint64: function() {
	        return this.readVarint(true);
	    },
	    readSVarint: function() {
	        var num = this.readVarint();
	        return num % 2 === 1 ? (num + 1) / -2 : num / 2;
	    },
	    readBoolean: function() {
	        return Boolean(this.readVarint());
	    },
	    readString: function() {
	        var end = this.readVarint() + this.pos;
	        var pos = this.pos;
	        this.pos = end;
	        if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
	            return readUtf8TextDecoder(this.buf, pos, end);
	        }
	        return readUtf8(this.buf, pos, end);
	    },
	    readBytes: function() {
	        var end = this.readVarint() + this.pos,
	            buffer = this.buf.subarray(this.pos, end);
	        this.pos = end;
	        return buffer;
	    },
	    readPackedVarint: function(arr, isSigned) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readVarint(isSigned));
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readVarint(isSigned));
	        return arr;
	    },
	    readPackedSVarint: function(arr) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readSVarint());
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readSVarint());
	        return arr;
	    },
	    readPackedBoolean: function(arr) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readBoolean());
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readBoolean());
	        return arr;
	    },
	    readPackedFloat: function(arr) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readFloat());
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readFloat());
	        return arr;
	    },
	    readPackedDouble: function(arr) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readDouble());
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readDouble());
	        return arr;
	    },
	    readPackedFixed32: function(arr) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readFixed32());
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readFixed32());
	        return arr;
	    },
	    readPackedSFixed32: function(arr) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readSFixed32());
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readSFixed32());
	        return arr;
	    },
	    readPackedFixed64: function(arr) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readFixed64());
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readFixed64());
	        return arr;
	    },
	    readPackedSFixed64: function(arr) {
	        if (this.type !== Pbf.Bytes) return arr.push(this.readSFixed64());
	        var end = readPackedEnd(this);
	        arr = arr || [];
	        while (this.pos < end) arr.push(this.readSFixed64());
	        return arr;
	    },
	    skip: function(val) {
	        var type = val & 0x7;
	        if (type === Pbf.Varint) while (this.buf[this.pos++] > 0x7f) {}
	        else if (type === Pbf.Bytes) this.pos = this.readVarint() + this.pos;
	        else if (type === Pbf.Fixed32) this.pos += 4;
	        else if (type === Pbf.Fixed64) this.pos += 8;
	        else throw new Error('Unimplemented type: ' + type);
	    },
	    writeTag: function(tag, type) {
	        this.writeVarint((tag << 3) | type);
	    },
	    realloc: function(min) {
	        var length = this.length || 16;
	        while (length < this.pos + min) length *= 2;
	        if (length !== this.length) {
	            var buf = new Uint8Array(length);
	            buf.set(this.buf);
	            this.buf = buf;
	            this.length = length;
	        }
	    },
	    finish: function() {
	        this.length = this.pos;
	        this.pos = 0;
	        return this.buf.subarray(0, this.length);
	    },
	    writeFixed32: function(val) {
	        this.realloc(4);
	        writeInt32(this.buf, val, this.pos);
	        this.pos += 4;
	    },
	    writeSFixed32: function(val) {
	        this.realloc(4);
	        writeInt32(this.buf, val, this.pos);
	        this.pos += 4;
	    },
	    writeFixed64: function(val) {
	        this.realloc(8);
	        writeInt32(this.buf, val & -1, this.pos);
	        writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
	        this.pos += 8;
	    },
	    writeSFixed64: function(val) {
	        this.realloc(8);
	        writeInt32(this.buf, val & -1, this.pos);
	        writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
	        this.pos += 8;
	    },
	    writeVarint: function(val) {
	        val = +val || 0;
	        if (val > 0xfffffff || val < 0) {
	            writeBigVarint(val, this);
	            return;
	        }
	        this.realloc(4);
	        this.buf[this.pos++] =           val & 0x7f  | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
	        this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
	        this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
	        this.buf[this.pos++] =   (val >>> 7) & 0x7f;
	    },
	    writeSVarint: function(val) {
	        this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
	    },
	    writeBoolean: function(val) {
	        this.writeVarint(Boolean(val));
	    },
	    writeString: function(str) {
	        str = String(str);
	        this.realloc(str.length * 4);
	        this.pos++;
	        var startPos = this.pos;
	        this.pos = writeUtf8(this.buf, str, this.pos);
	        var len = this.pos - startPos;
	        if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);
	        this.pos = startPos - 1;
	        this.writeVarint(len);
	        this.pos += len;
	    },
	    writeFloat: function(val) {
	        this.realloc(4);
	        ieee754.write(this.buf, val, this.pos, true, 23, 4);
	        this.pos += 4;
	    },
	    writeDouble: function(val) {
	        this.realloc(8);
	        ieee754.write(this.buf, val, this.pos, true, 52, 8);
	        this.pos += 8;
	    },
	    writeBytes: function(buffer) {
	        var len = buffer.length;
	        this.writeVarint(len);
	        this.realloc(len);
	        for (var i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
	    },
	    writeRawMessage: function(fn, obj) {
	        this.pos++;
	        var startPos = this.pos;
	        fn(obj, this);
	        var len = this.pos - startPos;
	        if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);
	        this.pos = startPos - 1;
	        this.writeVarint(len);
	        this.pos += len;
	    },
	    writeMessage: function(tag, fn, obj) {
	        this.writeTag(tag, Pbf.Bytes);
	        this.writeRawMessage(fn, obj);
	    },
	    writePackedVarint:   function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedVarint, arr);   },
	    writePackedSVarint:  function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedSVarint, arr);  },
	    writePackedBoolean:  function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedBoolean, arr);  },
	    writePackedFloat:    function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedFloat, arr);    },
	    writePackedDouble:   function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedDouble, arr);   },
	    writePackedFixed32:  function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedFixed32, arr);  },
	    writePackedSFixed32: function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedSFixed32, arr); },
	    writePackedFixed64:  function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedFixed64, arr);  },
	    writePackedSFixed64: function(tag, arr) { if (arr.length) this.writeMessage(tag, writePackedSFixed64, arr); },
	    writeBytesField: function(tag, buffer) {
	        this.writeTag(tag, Pbf.Bytes);
	        this.writeBytes(buffer);
	    },
	    writeFixed32Field: function(tag, val) {
	        this.writeTag(tag, Pbf.Fixed32);
	        this.writeFixed32(val);
	    },
	    writeSFixed32Field: function(tag, val) {
	        this.writeTag(tag, Pbf.Fixed32);
	        this.writeSFixed32(val);
	    },
	    writeFixed64Field: function(tag, val) {
	        this.writeTag(tag, Pbf.Fixed64);
	        this.writeFixed64(val);
	    },
	    writeSFixed64Field: function(tag, val) {
	        this.writeTag(tag, Pbf.Fixed64);
	        this.writeSFixed64(val);
	    },
	    writeVarintField: function(tag, val) {
	        this.writeTag(tag, Pbf.Varint);
	        this.writeVarint(val);
	    },
	    writeSVarintField: function(tag, val) {
	        this.writeTag(tag, Pbf.Varint);
	        this.writeSVarint(val);
	    },
	    writeStringField: function(tag, str) {
	        this.writeTag(tag, Pbf.Bytes);
	        this.writeString(str);
	    },
	    writeFloatField: function(tag, val) {
	        this.writeTag(tag, Pbf.Fixed32);
	        this.writeFloat(val);
	    },
	    writeDoubleField: function(tag, val) {
	        this.writeTag(tag, Pbf.Fixed64);
	        this.writeDouble(val);
	    },
	    writeBooleanField: function(tag, val) {
	        this.writeVarintField(tag, Boolean(val));
	    }
	};
	function readVarintRemainder(l, s, p) {
	    var buf = p.buf,
	        h, b;
	    b = buf[p.pos++]; h  = (b & 0x70) >> 4;  if (b < 0x80) return toNum(l, h, s);
	    b = buf[p.pos++]; h |= (b & 0x7f) << 3;  if (b < 0x80) return toNum(l, h, s);
	    b = buf[p.pos++]; h |= (b & 0x7f) << 10; if (b < 0x80) return toNum(l, h, s);
	    b = buf[p.pos++]; h |= (b & 0x7f) << 17; if (b < 0x80) return toNum(l, h, s);
	    b = buf[p.pos++]; h |= (b & 0x7f) << 24; if (b < 0x80) return toNum(l, h, s);
	    b = buf[p.pos++]; h |= (b & 0x01) << 31; if (b < 0x80) return toNum(l, h, s);
	    throw new Error('Expected varint not more than 10 bytes');
	}
	function readPackedEnd(pbf) {
	    return pbf.type === Pbf.Bytes ?
	        pbf.readVarint() + pbf.pos : pbf.pos + 1;
	}
	function toNum(low, high, isSigned) {
	    if (isSigned) {
	        return high * 0x100000000 + (low >>> 0);
	    }
	    return ((high >>> 0) * 0x100000000) + (low >>> 0);
	}
	function writeBigVarint(val, pbf) {
	    var low, high;
	    if (val >= 0) {
	        low  = (val % 0x100000000) | 0;
	        high = (val / 0x100000000) | 0;
	    } else {
	        low  = ~(-val % 0x100000000);
	        high = ~(-val / 0x100000000);
	        if (low ^ 0xffffffff) {
	            low = (low + 1) | 0;
	        } else {
	            low = 0;
	            high = (high + 1) | 0;
	        }
	    }
	    if (val >= 0x10000000000000000 || val < -0x10000000000000000) {
	        throw new Error('Given varint doesn\'t fit into 10 bytes');
	    }
	    pbf.realloc(10);
	    writeBigVarintLow(low, high, pbf);
	    writeBigVarintHigh(high, pbf);
	}
	function writeBigVarintLow(low, high, pbf) {
	    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
	    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
	    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
	    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
	    pbf.buf[pbf.pos]   = low & 0x7f;
	}
	function writeBigVarintHigh(high, pbf) {
	    var lsb = (high & 0x07) << 4;
	    pbf.buf[pbf.pos++] |= lsb         | ((high >>>= 3) ? 0x80 : 0); if (!high) return;
	    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
	    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
	    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
	    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
	    pbf.buf[pbf.pos++]  = high & 0x7f;
	}
	function makeRoomForExtraLength(startPos, len, pbf) {
	    var extraLen =
	        len <= 0x3fff ? 1 :
	        len <= 0x1fffff ? 2 :
	        len <= 0xfffffff ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));
	    pbf.realloc(extraLen);
	    for (var i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
	}
	function writePackedVarint(arr, pbf)   { for (var i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);   }
	function writePackedSVarint(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);  }
	function writePackedFloat(arr, pbf)    { for (var i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);    }
	function writePackedDouble(arr, pbf)   { for (var i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);   }
	function writePackedBoolean(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);  }
	function writePackedFixed32(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);  }
	function writePackedSFixed32(arr, pbf) { for (var i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]); }
	function writePackedFixed64(arr, pbf)  { for (var i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);  }
	function writePackedSFixed64(arr, pbf) { for (var i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]); }
	function readUInt32(buf, pos) {
	    return ((buf[pos]) |
	        (buf[pos + 1] << 8) |
	        (buf[pos + 2] << 16)) +
	        (buf[pos + 3] * 0x1000000);
	}
	function writeInt32(buf, val, pos) {
	    buf[pos] = val;
	    buf[pos + 1] = (val >>> 8);
	    buf[pos + 2] = (val >>> 16);
	    buf[pos + 3] = (val >>> 24);
	}
	function readInt32(buf, pos) {
	    return ((buf[pos]) |
	        (buf[pos + 1] << 8) |
	        (buf[pos + 2] << 16)) +
	        (buf[pos + 3] << 24);
	}
	function readUtf8(buf, pos, end) {
	    var str = '';
	    var i = pos;
	    while (i < end) {
	        var b0 = buf[i];
	        var c = null;
	        var bytesPerSequence =
	            b0 > 0xEF ? 4 :
	            b0 > 0xDF ? 3 :
	            b0 > 0xBF ? 2 : 1;
	        if (i + bytesPerSequence > end) break;
	        var b1, b2, b3;
	        if (bytesPerSequence === 1) {
	            if (b0 < 0x80) {
	                c = b0;
	            }
	        } else if (bytesPerSequence === 2) {
	            b1 = buf[i + 1];
	            if ((b1 & 0xC0) === 0x80) {
	                c = (b0 & 0x1F) << 0x6 | (b1 & 0x3F);
	                if (c <= 0x7F) {
	                    c = null;
	                }
	            }
	        } else if (bytesPerSequence === 3) {
	            b1 = buf[i + 1];
	            b2 = buf[i + 2];
	            if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80) {
	                c = (b0 & 0xF) << 0xC | (b1 & 0x3F) << 0x6 | (b2 & 0x3F);
	                if (c <= 0x7FF || (c >= 0xD800 && c <= 0xDFFF)) {
	                    c = null;
	                }
	            }
	        } else if (bytesPerSequence === 4) {
	            b1 = buf[i + 1];
	            b2 = buf[i + 2];
	            b3 = buf[i + 3];
	            if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
	                c = (b0 & 0xF) << 0x12 | (b1 & 0x3F) << 0xC | (b2 & 0x3F) << 0x6 | (b3 & 0x3F);
	                if (c <= 0xFFFF || c >= 0x110000) {
	                    c = null;
	                }
	            }
	        }
	        if (c === null) {
	            c = 0xFFFD;
	            bytesPerSequence = 1;
	        } else if (c > 0xFFFF) {
	            c -= 0x10000;
	            str += String.fromCharCode(c >>> 10 & 0x3FF | 0xD800);
	            c = 0xDC00 | c & 0x3FF;
	        }
	        str += String.fromCharCode(c);
	        i += bytesPerSequence;
	    }
	    return str;
	}
	function readUtf8TextDecoder(buf, pos, end) {
	    return utf8TextDecoder.decode(buf.subarray(pos, end));
	}
	function writeUtf8(buf, str, pos) {
	    for (var i = 0, c, lead; i < str.length; i++) {
	        c = str.charCodeAt(i);
	        if (c > 0xD7FF && c < 0xE000) {
	            if (lead) {
	                if (c < 0xDC00) {
	                    buf[pos++] = 0xEF;
	                    buf[pos++] = 0xBF;
	                    buf[pos++] = 0xBD;
	                    lead = c;
	                    continue;
	                } else {
	                    c = lead - 0xD800 << 10 | c - 0xDC00 | 0x10000;
	                    lead = null;
	                }
	            } else {
	                if (c > 0xDBFF || (i + 1 === str.length)) {
	                    buf[pos++] = 0xEF;
	                    buf[pos++] = 0xBF;
	                    buf[pos++] = 0xBD;
	                } else {
	                    lead = c;
	                }
	                continue;
	            }
	        } else if (lead) {
	            buf[pos++] = 0xEF;
	            buf[pos++] = 0xBF;
	            buf[pos++] = 0xBD;
	            lead = null;
	        }
	        if (c < 0x80) {
	            buf[pos++] = c;
	        } else {
	            if (c < 0x800) {
	                buf[pos++] = c >> 0x6 | 0xC0;
	            } else {
	                if (c < 0x10000) {
	                    buf[pos++] = c >> 0xC | 0xE0;
	                } else {
	                    buf[pos++] = c >> 0x12 | 0xF0;
	                    buf[pos++] = c >> 0xC & 0x3F | 0x80;
	                }
	                buf[pos++] = c >> 0x6 & 0x3F | 0x80;
	            }
	            buf[pos++] = c & 0x3F | 0x80;
	        }
	    }
	    return pos;
	}

	const FeatureCollectionPBuffer = {};
	FeatureCollectionPBuffer.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer._readField, {version: '', queryResult: null}, end);
	};
	FeatureCollectionPBuffer._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.version = pbf.readString();
	  else if (tag === 2) obj.queryResult = FeatureCollectionPBuffer.QueryResult.read(pbf, pbf.readVarint() + pbf.pos);
	};
	FeatureCollectionPBuffer.write = function (obj, pbf) {
	  if (obj.version) pbf.writeStringField(1, obj.version);
	  if (obj.queryResult) pbf.writeMessage(2, FeatureCollectionPBuffer.QueryResult.write, obj.queryResult);
	};
	FeatureCollectionPBuffer.GeometryType = {
	  'esriGeometryTypePoint': {
	    'value': 0,
	    'options': {}
	  },
	  'esriGeometryTypeMultipoint': {
	    'value': 1,
	    'options': {}
	  },
	  'esriGeometryTypePolyline': {
	    'value': 2,
	    'options': {}
	  },
	  'esriGeometryTypePolygon': {
	    'value': 3,
	    'options': {}
	  },
	  'esriGeometryTypeMultipatch': {
	    'value': 4,
	    'options': {}
	  },
	  'esriGeometryTypeNone': {
	    'value': 127,
	    'options': {}
	  }
	};
	FeatureCollectionPBuffer.FieldType = {
	  'esriFieldTypeSmallInteger': {
	    'value': 0,
	    'options': {}
	  },
	  'esriFieldTypeInteger': {
	    'value': 1,
	    'options': {}
	  },
	  'esriFieldTypeSingle': {
	    'value': 2,
	    'options': {}
	  },
	  'esriFieldTypeDouble': {
	    'value': 3,
	    'options': {}
	  },
	  'esriFieldTypeString': {
	    'value': 4,
	    'options': {}
	  },
	  'esriFieldTypeDate': {
	    'value': 5,
	    'options': {}
	  },
	  'esriFieldTypeOID': {
	    'value': 6,
	    'options': {}
	  },
	  'esriFieldTypeGeometry': {
	    'value': 7,
	    'options': {}
	  },
	  'esriFieldTypeBlob': {
	    'value': 8,
	    'options': {}
	  },
	  'esriFieldTypeRaster': {
	    'value': 9,
	    'options': {}
	  },
	  'esriFieldTypeGUID': {
	    'value': 10,
	    'options': {}
	  },
	  'esriFieldTypeGlobalID': {
	    'value': 11,
	    'options': {}
	  },
	  'esriFieldTypeXML': {
	    'value': 12,
	    'options': {}
	  }
	};
	FeatureCollectionPBuffer.SQLType = {
	  'sqlTypeBigInt': {
	    'value': 0,
	    'options': {}
	  },
	  'sqlTypeBinary': {
	    'value': 1,
	    'options': {}
	  },
	  'sqlTypeBit': {
	    'value': 2,
	    'options': {}
	  },
	  'sqlTypeChar': {
	    'value': 3,
	    'options': {}
	  },
	  'sqlTypeDate': {
	    'value': 4,
	    'options': {}
	  },
	  'sqlTypeDecimal': {
	    'value': 5,
	    'options': {}
	  },
	  'sqlTypeDouble': {
	    'value': 6,
	    'options': {}
	  },
	  'sqlTypeFloat': {
	    'value': 7,
	    'options': {}
	  },
	  'sqlTypeGeometry': {
	    'value': 8,
	    'options': {}
	  },
	  'sqlTypeGUID': {
	    'value': 9,
	    'options': {}
	  },
	  'sqlTypeInteger': {
	    'value': 10,
	    'options': {}
	  },
	  'sqlTypeLongNVarchar': {
	    'value': 11,
	    'options': {}
	  },
	  'sqlTypeLongVarbinary': {
	    'value': 12,
	    'options': {}
	  },
	  'sqlTypeLongVarchar': {
	    'value': 13,
	    'options': {}
	  },
	  'sqlTypeNChar': {
	    'value': 14,
	    'options': {}
	  },
	  'sqlTypeNVarchar': {
	    'value': 15,
	    'options': {}
	  },
	  'sqlTypeOther': {
	    'value': 16,
	    'options': {}
	  },
	  'sqlTypeReal': {
	    'value': 17,
	    'options': {}
	  },
	  'sqlTypeSmallInt': {
	    'value': 18,
	    'options': {}
	  },
	  'sqlTypeSqlXml': {
	    'value': 19,
	    'options': {}
	  },
	  'sqlTypeTime': {
	    'value': 20,
	    'options': {}
	  },
	  'sqlTypeTimestamp': {
	    'value': 21,
	    'options': {}
	  },
	  'sqlTypeTimestamp2': {
	    'value': 22,
	    'options': {}
	  },
	  'sqlTypeTinyInt': {
	    'value': 23,
	    'options': {}
	  },
	  'sqlTypeVarbinary': {
	    'value': 24,
	    'options': {}
	  },
	  'sqlTypeVarchar': {
	    'value': 25,
	    'options': {}
	  }
	};
	FeatureCollectionPBuffer.QuantizeOriginPostion = {
	  'upperLeft': {
	    'value': 0,
	    'options': {}
	  },
	  'lowerLeft': {
	    'value': 1,
	    'options': {}
	  }
	};
	FeatureCollectionPBuffer.SpatialReference = {};
	FeatureCollectionPBuffer.SpatialReference.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.SpatialReference._readField, {wkid: 0, lastestWkid: 0, vcsWkid: 0, latestVcsWkid: 0, wkt: ''}, end);
	};
	FeatureCollectionPBuffer.SpatialReference._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.wkid = pbf.readVarint();
	  else if (tag === 2) obj.lastestWkid = pbf.readVarint();
	  else if (tag === 3) obj.vcsWkid = pbf.readVarint();
	  else if (tag === 4) obj.latestVcsWkid = pbf.readVarint();
	  else if (tag === 5) obj.wkt = pbf.readString();
	};
	FeatureCollectionPBuffer.SpatialReference.write = function (obj, pbf) {
	  if (obj.wkid) pbf.writeVarintField(1, obj.wkid);
	  if (obj.lastestWkid) pbf.writeVarintField(2, obj.lastestWkid);
	  if (obj.vcsWkid) pbf.writeVarintField(3, obj.vcsWkid);
	  if (obj.latestVcsWkid) pbf.writeVarintField(4, obj.latestVcsWkid);
	  if (obj.wkt) pbf.writeStringField(5, obj.wkt);
	};
	FeatureCollectionPBuffer.Field = {};
	FeatureCollectionPBuffer.Field.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.Field._readField, {name: '', fieldType: 0, alias: '', sqlType: 0, domain: '', defaultValue: ''}, end);
	};
	FeatureCollectionPBuffer.Field._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.name = pbf.readString();
	  else if (tag === 2) obj.fieldType = pbf.readVarint();
	  else if (tag === 3) obj.alias = pbf.readString();
	  else if (tag === 4) obj.sqlType = pbf.readVarint();
	  else if (tag === 5) obj.domain = pbf.readString();
	  else if (tag === 6) obj.defaultValue = pbf.readString();
	};
	FeatureCollectionPBuffer.Field.write = function (obj, pbf) {
	  if (obj.name) pbf.writeStringField(1, obj.name);
	  if (obj.fieldType) pbf.writeVarintField(2, obj.fieldType);
	  if (obj.alias) pbf.writeStringField(3, obj.alias);
	  if (obj.sqlType) pbf.writeVarintField(4, obj.sqlType);
	  if (obj.domain) pbf.writeStringField(5, obj.domain);
	  if (obj.defaultValue) pbf.writeStringField(6, obj.defaultValue);
	};
	FeatureCollectionPBuffer.Value = {};
	FeatureCollectionPBuffer.Value.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.Value._readField, {string_value: '', value_type: null, float_value: 0, double_value: 0, sint_value: 0, uint_value: 0, int64_value: 0, uint64_value: 0, sint64_value: 0, bool_value: false}, end);
	};
	FeatureCollectionPBuffer.Value._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.string_value = pbf.readString(), obj.value_type = 'string_value';
	  else if (tag === 2) obj.float_value = pbf.readFloat(), obj.value_type = 'float_value';
	  else if (tag === 3) obj.double_value = pbf.readDouble(), obj.value_type = 'double_value';
	  else if (tag === 4) obj.sint_value = pbf.readSVarint(), obj.value_type = 'sint_value';
	  else if (tag === 5) obj.uint_value = pbf.readVarint(), obj.value_type = 'uint_value';
	  else if (tag === 6) obj.int64_value = pbf.readVarint(true), obj.value_type = 'int64_value';
	  else if (tag === 7) obj.uint64_value = pbf.readVarint(), obj.value_type = 'uint64_value';
	  else if (tag === 8) obj.sint64_value = pbf.readSVarint(), obj.value_type = 'sint64_value';
	  else if (tag === 9) obj.bool_value = pbf.readBoolean(), obj.value_type = 'bool_value';
	};
	FeatureCollectionPBuffer.Value.write = function (obj, pbf) {
	  if (obj.string_value) pbf.writeStringField(1, obj.string_value);
	  if (obj.float_value) pbf.writeFloatField(2, obj.float_value);
	  if (obj.double_value) pbf.writeDoubleField(3, obj.double_value);
	  if (obj.sint_value) pbf.writeSVarintField(4, obj.sint_value);
	  if (obj.uint_value) pbf.writeVarintField(5, obj.uint_value);
	  if (obj.int64_value) pbf.writeVarintField(6, obj.int64_value);
	  if (obj.uint64_value) pbf.writeVarintField(7, obj.uint64_value);
	  if (obj.sint64_value) pbf.writeSVarintField(8, obj.sint64_value);
	  if (obj.bool_value) pbf.writeBooleanField(9, obj.bool_value);
	};
	FeatureCollectionPBuffer.Geometry = {};
	FeatureCollectionPBuffer.Geometry.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.Geometry._readField, {lengths: [], coords: []}, end);
	};
	FeatureCollectionPBuffer.Geometry._readField = function (tag, obj, pbf) {
	  if (tag === 2) pbf.readPackedVarint(obj.lengths);
	  else if (tag === 3) pbf.readPackedSVarint(obj.coords);
	};
	FeatureCollectionPBuffer.Geometry.write = function (obj, pbf) {
	  if (obj.lengths) pbf.writePackedVarint(2, obj.lengths);
	  if (obj.coords) pbf.writePackedSVarint(3, obj.coords);
	};
	FeatureCollectionPBuffer.esriShapeBuffer = {};
	FeatureCollectionPBuffer.esriShapeBuffer.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.esriShapeBuffer._readField, {bytes: null}, end);
	};
	FeatureCollectionPBuffer.esriShapeBuffer._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.bytes = pbf.readBytes();
	};
	FeatureCollectionPBuffer.esriShapeBuffer.write = function (obj, pbf) {
	  if (obj.bytes) pbf.writeBytesField(1, obj.bytes);
	};
	FeatureCollectionPBuffer.Feature = {};
	FeatureCollectionPBuffer.Feature.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.Feature._readField, {attributes: [], geometry: null, compressed_geometry: null, shapeBuffer: null, centroid: null}, end);
	};
	FeatureCollectionPBuffer.Feature._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.attributes.push(FeatureCollectionPBuffer.Value.read(pbf, pbf.readVarint() + pbf.pos));
	  else if (tag === 2) obj.geometry = FeatureCollectionPBuffer.Geometry.read(pbf, pbf.readVarint() + pbf.pos), obj.compressed_geometry = 'geometry';
	  else if (tag === 3) obj.shapeBuffer = FeatureCollectionPBuffer.esriShapeBuffer.read(pbf, pbf.readVarint() + pbf.pos), obj.compressed_geometry = 'shapeBuffer';
	  else if (tag === 4) obj.centroid = FeatureCollectionPBuffer.Geometry.read(pbf, pbf.readVarint() + pbf.pos);
	};
	FeatureCollectionPBuffer.Feature.write = function (obj, pbf) {
	  if (obj.attributes) for (let i = 0; i < obj.attributes.length; i++) pbf.writeMessage(1, FeatureCollectionPBuffer.Value.write, obj.attributes[i]);
	  if (obj.geometry) pbf.writeMessage(2, FeatureCollectionPBuffer.Geometry.write, obj.geometry);
	  if (obj.shapeBuffer) pbf.writeMessage(3, FeatureCollectionPBuffer.esriShapeBuffer.write, obj.shapeBuffer);
	  if (obj.centroid) pbf.writeMessage(4, FeatureCollectionPBuffer.Geometry.write, obj.centroid);
	};
	FeatureCollectionPBuffer.UniqueIdField = {};
	FeatureCollectionPBuffer.UniqueIdField.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.UniqueIdField._readField, {name: '', isSystemMaintained: false}, end);
	};
	FeatureCollectionPBuffer.UniqueIdField._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.name = pbf.readString();
	  else if (tag === 2) obj.isSystemMaintained = pbf.readBoolean();
	};
	FeatureCollectionPBuffer.UniqueIdField.write = function (obj, pbf) {
	  if (obj.name) pbf.writeStringField(1, obj.name);
	  if (obj.isSystemMaintained) pbf.writeBooleanField(2, obj.isSystemMaintained);
	};
	FeatureCollectionPBuffer.GeometryProperties = {};
	FeatureCollectionPBuffer.GeometryProperties.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.GeometryProperties._readField, {shapeAreaFieldName: '', shapeLengthFieldName: '', units: ''}, end);
	};
	FeatureCollectionPBuffer.GeometryProperties._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.shapeAreaFieldName = pbf.readString();
	  else if (tag === 2) obj.shapeLengthFieldName = pbf.readString();
	  else if (tag === 3) obj.units = pbf.readString();
	};
	FeatureCollectionPBuffer.GeometryProperties.write = function (obj, pbf) {
	  if (obj.shapeAreaFieldName) pbf.writeStringField(1, obj.shapeAreaFieldName);
	  if (obj.shapeLengthFieldName) pbf.writeStringField(2, obj.shapeLengthFieldName);
	  if (obj.units) pbf.writeStringField(3, obj.units);
	};
	FeatureCollectionPBuffer.ServerGens = {};
	FeatureCollectionPBuffer.ServerGens.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.ServerGens._readField, {minServerGen: 0, serverGen: 0}, end);
	};
	FeatureCollectionPBuffer.ServerGens._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.minServerGen = pbf.readVarint();
	  else if (tag === 2) obj.serverGen = pbf.readVarint();
	};
	FeatureCollectionPBuffer.ServerGens.write = function (obj, pbf) {
	  if (obj.minServerGen) pbf.writeVarintField(1, obj.minServerGen);
	  if (obj.serverGen) pbf.writeVarintField(2, obj.serverGen);
	};
	FeatureCollectionPBuffer.Scale = {};
	FeatureCollectionPBuffer.Scale.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.Scale._readField, {xScale: 0, yScale: 0, mScale: 0, zScale: 0}, end);
	};
	FeatureCollectionPBuffer.Scale._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.xScale = pbf.readDouble();
	  else if (tag === 2) obj.yScale = pbf.readDouble();
	  else if (tag === 3) obj.mScale = pbf.readDouble();
	  else if (tag === 4) obj.zScale = pbf.readDouble();
	};
	FeatureCollectionPBuffer.Scale.write = function (obj, pbf) {
	  if (obj.xScale) pbf.writeDoubleField(1, obj.xScale);
	  if (obj.yScale) pbf.writeDoubleField(2, obj.yScale);
	  if (obj.mScale) pbf.writeDoubleField(3, obj.mScale);
	  if (obj.zScale) pbf.writeDoubleField(4, obj.zScale);
	};
	FeatureCollectionPBuffer.Translate = {};
	FeatureCollectionPBuffer.Translate.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.Translate._readField, {xTranslate: 0, yTranslate: 0, mTranslate: 0, zTranslate: 0}, end);
	};
	FeatureCollectionPBuffer.Translate._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.xTranslate = pbf.readDouble();
	  else if (tag === 2) obj.yTranslate = pbf.readDouble();
	  else if (tag === 3) obj.mTranslate = pbf.readDouble();
	  else if (tag === 4) obj.zTranslate = pbf.readDouble();
	};
	FeatureCollectionPBuffer.Translate.write = function (obj, pbf) {
	  if (obj.xTranslate) pbf.writeDoubleField(1, obj.xTranslate);
	  if (obj.yTranslate) pbf.writeDoubleField(2, obj.yTranslate);
	  if (obj.mTranslate) pbf.writeDoubleField(3, obj.mTranslate);
	  if (obj.zTranslate) pbf.writeDoubleField(4, obj.zTranslate);
	};
	FeatureCollectionPBuffer.Transform = {};
	FeatureCollectionPBuffer.Transform.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.Transform._readField, {quantizeOriginPostion: 0, scale: null, translate: null}, end);
	};
	FeatureCollectionPBuffer.Transform._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.quantizeOriginPostion = pbf.readVarint();
	  else if (tag === 2) obj.scale = FeatureCollectionPBuffer.Scale.read(pbf, pbf.readVarint() + pbf.pos);
	  else if (tag === 3) obj.translate = FeatureCollectionPBuffer.Translate.read(pbf, pbf.readVarint() + pbf.pos);
	};
	FeatureCollectionPBuffer.Transform.write = function (obj, pbf) {
	  if (obj.quantizeOriginPostion) pbf.writeVarintField(1, obj.quantizeOriginPostion);
	  if (obj.scale) pbf.writeMessage(2, FeatureCollectionPBuffer.Scale.write, obj.scale);
	  if (obj.translate) pbf.writeMessage(3, FeatureCollectionPBuffer.Translate.write, obj.translate);
	};
	FeatureCollectionPBuffer.FeatureResult = {};
	FeatureCollectionPBuffer.FeatureResult.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.FeatureResult._readField, {objectIdFieldName: '', uniqueIdField: null, globalIdFieldName: '', geohashFieldName: '', geometryProperties: null, serverGens: null, geometryType: 0, spatialReference: null, exceededTransferLimit: false, hasZ: false, hasM: false, transform: null, fields: [], values: [], features: []}, end);
	};
	FeatureCollectionPBuffer.FeatureResult._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.objectIdFieldName = pbf.readString();
	  else if (tag === 2) obj.uniqueIdField = FeatureCollectionPBuffer.UniqueIdField.read(pbf, pbf.readVarint() + pbf.pos);
	  else if (tag === 3) obj.globalIdFieldName = pbf.readString();
	  else if (tag === 4) obj.geohashFieldName = pbf.readString();
	  else if (tag === 5) obj.geometryProperties = FeatureCollectionPBuffer.GeometryProperties.read(pbf, pbf.readVarint() + pbf.pos);
	  else if (tag === 6) obj.serverGens = FeatureCollectionPBuffer.ServerGens.read(pbf, pbf.readVarint() + pbf.pos);
	  else if (tag === 7) obj.geometryType = pbf.readVarint();
	  else if (tag === 8) obj.spatialReference = FeatureCollectionPBuffer.SpatialReference.read(pbf, pbf.readVarint() + pbf.pos);
	  else if (tag === 9) obj.exceededTransferLimit = pbf.readBoolean();
	  else if (tag === 10) obj.hasZ = pbf.readBoolean();
	  else if (tag === 11) obj.hasM = pbf.readBoolean();
	  else if (tag === 12) obj.transform = FeatureCollectionPBuffer.Transform.read(pbf, pbf.readVarint() + pbf.pos);
	  else if (tag === 13) obj.fields.push(FeatureCollectionPBuffer.Field.read(pbf, pbf.readVarint() + pbf.pos));
	  else if (tag === 14) obj.values.push(FeatureCollectionPBuffer.Value.read(pbf, pbf.readVarint() + pbf.pos));
	  else if (tag === 15) obj.features.push(FeatureCollectionPBuffer.Feature.read(pbf, pbf.readVarint() + pbf.pos));
	};
	FeatureCollectionPBuffer.FeatureResult.write = function (obj, pbf) {
	  if (obj.objectIdFieldName) pbf.writeStringField(1, obj.objectIdFieldName);
	  if (obj.uniqueIdField) pbf.writeMessage(2, FeatureCollectionPBuffer.UniqueIdField.write, obj.uniqueIdField);
	  if (obj.globalIdFieldName) pbf.writeStringField(3, obj.globalIdFieldName);
	  if (obj.geohashFieldName) pbf.writeStringField(4, obj.geohashFieldName);
	  if (obj.geometryProperties) pbf.writeMessage(5, FeatureCollectionPBuffer.GeometryProperties.write, obj.geometryProperties);
	  if (obj.serverGens) pbf.writeMessage(6, FeatureCollectionPBuffer.ServerGens.write, obj.serverGens);
	  if (obj.geometryType) pbf.writeVarintField(7, obj.geometryType);
	  if (obj.spatialReference) pbf.writeMessage(8, FeatureCollectionPBuffer.SpatialReference.write, obj.spatialReference);
	  if (obj.exceededTransferLimit) pbf.writeBooleanField(9, obj.exceededTransferLimit);
	  if (obj.hasZ) pbf.writeBooleanField(10, obj.hasZ);
	  if (obj.hasM) pbf.writeBooleanField(11, obj.hasM);
	  if (obj.transform) pbf.writeMessage(12, FeatureCollectionPBuffer.Transform.write, obj.transform);
	  if (obj.fields) for (var i = 0; i < obj.fields.length; i++) pbf.writeMessage(13, FeatureCollectionPBuffer.Field.write, obj.fields[i]);
	  if (obj.values) for (i = 0; i < obj.values.length; i++) pbf.writeMessage(14, FeatureCollectionPBuffer.Value.write, obj.values[i]);
	  if (obj.features) for (i = 0; i < obj.features.length; i++) pbf.writeMessage(15, FeatureCollectionPBuffer.Feature.write, obj.features[i]);
	};
	FeatureCollectionPBuffer.CountResult = {};
	FeatureCollectionPBuffer.CountResult.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.CountResult._readField, {count: 0}, end);
	};
	FeatureCollectionPBuffer.CountResult._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.count = pbf.readVarint();
	};
	FeatureCollectionPBuffer.CountResult.write = function (obj, pbf) {
	  if (obj.count) pbf.writeVarintField(1, obj.count);
	};
	FeatureCollectionPBuffer.ObjectIdsResult = {};
	FeatureCollectionPBuffer.ObjectIdsResult.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.ObjectIdsResult._readField, {objectIdFieldName: '', serverGens: null, objectIds: []}, end);
	};
	FeatureCollectionPBuffer.ObjectIdsResult._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.objectIdFieldName = pbf.readString();
	  else if (tag === 2) obj.serverGens = FeatureCollectionPBuffer.ServerGens.read(pbf, pbf.readVarint() + pbf.pos);
	  else if (tag === 3) pbf.readPackedVarint(obj.objectIds);
	};
	FeatureCollectionPBuffer.ObjectIdsResult.write = function (obj, pbf) {
	  if (obj.objectIdFieldName) pbf.writeStringField(1, obj.objectIdFieldName);
	  if (obj.serverGens) pbf.writeMessage(2, FeatureCollectionPBuffer.ServerGens.write, obj.serverGens);
	  if (obj.objectIds) pbf.writePackedVarint(3, obj.objectIds);
	};
	FeatureCollectionPBuffer.QueryResult = {};
	FeatureCollectionPBuffer.QueryResult.read = function (pbf, end) {
	  return pbf.readFields(FeatureCollectionPBuffer.QueryResult._readField, {featureResult: null, Results: null, countResult: null, idsResult: null}, end);
	};
	FeatureCollectionPBuffer.QueryResult._readField = function (tag, obj, pbf) {
	  if (tag === 1) obj.featureResult = FeatureCollectionPBuffer.FeatureResult.read(pbf, pbf.readVarint() + pbf.pos), obj.Results = 'featureResult';
	  else if (tag === 2) obj.countResult = FeatureCollectionPBuffer.CountResult.read(pbf, pbf.readVarint() + pbf.pos), obj.Results = 'countResult';
	  else if (tag === 3) obj.idsResult = FeatureCollectionPBuffer.ObjectIdsResult.read(pbf, pbf.readVarint() + pbf.pos), obj.Results = 'idsResult';
	};
	FeatureCollectionPBuffer.QueryResult.write = function (obj, pbf) {
	  if (obj.featureResult) pbf.writeMessage(1, FeatureCollectionPBuffer.FeatureResult.write, obj.featureResult);
	  if (obj.countResult) pbf.writeMessage(2, FeatureCollectionPBuffer.CountResult.write, obj.countResult);
	  if (obj.idsResult) pbf.writeMessage(3, FeatureCollectionPBuffer.ObjectIdsResult.write, obj.idsResult);
	};
	function decode(featureCollectionBuffer) {
	  let decodedObject;
	  try {
	    decodedObject = FeatureCollectionPBuffer.read(new pbf(featureCollectionBuffer));
	  } catch (error) {
	    throw new Error('Could not parse arcgis-pbf buffer')
	  }
	  const featureResult = decodedObject.queryResult.featureResult;
	  const transform = featureResult.transform;
	  const geometryType = featureResult.geometryType;
	  const objectIdField = featureResult.objectIdFieldName;
	  const fields = featureResult.fields;
	  for (let index = 0; index < fields.length; index++) {
	    const field = fields[index];
	    field.keyName = getKeyName(field);
	  }
	  const out = {
	    type: 'FeatureCollection',
	    features: []
	  };
	  const geometryParser = getGeometryParser(geometryType);
	  const featureLen = featureResult.features.length;
	  for (let index = 0; index < featureLen; index++) {
	    const f = featureResult.features[index];
	    out.features.push({
	      type: 'Feature',
	      id: getFeatureId(fields, f.attributes, objectIdField),
	      properties: collectAttributes(fields, f.attributes),
	      geometry: f.geometry && geometryParser(f, transform)
	    });
	  }
	  return {
	    featureCollection: out,
	    exceededTransferLimit: featureResult.exceededTransferLimit
	  }
	}
	function getGeometryParser (featureType) {
	  switch (featureType) {
	  case 3:
	    return createPolygon
	  case 2:
	    return createLine
	  case 0:
	    return createPoint
	  default:
	    return createPolygon
	  }
	}
	function createPoint (f, transform) {
	  const p = {
	    type: 'Point',
	    coordinates: transformTuple(f.geometry.coords, transform)
	  };
	  return p
	}
	function createLine (f, transform) {
	  let l = null;
	  const lengths = f.geometry.lengths.length;
	  if (lengths === 1) {
	    l = {
	      type: 'LineString',
	      coordinates: createLinearRing(f.geometry.coords, transform, 0, f.geometry.lengths[0] * 2)
	    };
	  } else if (lengths > 1) {
	    l = {
	      type: 'MultiLineString',
	      coordinates: []
	    };
	    let startPoint = 0;
	    for (let index = 0; index < lengths; index++) {
	      const stopPoint = startPoint + (f.geometry.lengths[index] * 2);
	      const line = createLinearRing(f.geometry.coords, transform, startPoint, stopPoint);
	      l.coordinates.push(line);
	      startPoint = stopPoint;
	    }
	  }
	  return l
	}
	function createPolygon (f, transform) {
	  const lengths = f.geometry.lengths.length;
	  const p = {
	    type: 'Polygon',
	    coordinates: []
	  };
	  if (lengths === 1) {
	    p.coordinates.push(createLinearRing(f.geometry.coords, transform, 0, f.geometry.lengths[0] * 2));
	  } else {
	    p.type = 'MultiPolygon';
	    let startPoint = 0;
	    for (let index = 0; index < lengths; index++) {
	      const stopPoint = startPoint + (f.geometry.lengths[index] * 2);
	      const ring = createLinearRing(f.geometry.coords, transform, startPoint, stopPoint);
	      if (ringIsClockwise(ring)) {
	        p.coordinates.push([ring]);
	      } else if (p.coordinates.length > 0) {
	        p.coordinates[p.coordinates.length - 1].push(ring);
	      }
	      startPoint = stopPoint;
	    }
	  }
	  return p
	}
	function ringIsClockwise (ringToTest) {
	  let total = 0;
	  let i = 0;
	  const rLength = ringToTest.length;
	  let pt1 = ringToTest[i];
	  let pt2;
	  for (i; i < rLength - 1; i++) {
	    pt2 = ringToTest[i + 1];
	    total += (pt2[0] - pt1[0]) * (pt2[1] + pt1[1]);
	    pt1 = pt2;
	  }
	  return (total >= 0)
	}
	function createLinearRing (arr, transform, startPoint, stopPoint) {
	  const out = [];
	  if (arr.length === 0) return out
	  const initialX = arr[startPoint];
	  const initialY = arr[startPoint + 1];
	  out.push(transformTuple([initialX, initialY], transform));
	  let prevX = initialX;
	  let prevY = initialY;
	  for (let i = startPoint + 2; i < stopPoint; i = i + 2) {
	    const x = difference(prevX, arr[i]);
	    const y = difference(prevY, arr[i + 1]);
	    const transformed = transformTuple([x, y], transform);
	    out.push(transformed);
	    prevX = x;
	    prevY = y;
	  }
	  return out
	}
	function collectAttributes(fields, featureAttributes) {
	  const out = {};
	  for (let i = 0; i < fields.length; i++) {
	    const f = fields[i];
	    if (featureAttributes[i][featureAttributes[i].value_type] !== undefined) out[f.name] = featureAttributes[i][featureAttributes[i].value_type];
	    else out[f.name] = null;
	  }
	  return out
	}
	function getFeatureId(fields, featureAttributes, featureIdField) {
	  for (let index = 0; index < fields.length; index++) {
	    const field = fields[index];
	    if (field.name === featureIdField) {
	      return featureAttributes[index][featureAttributes[index].value_type]
	    }
	  }
	  return null
	}
	function getKeyName (fields) {
	  switch (fields.fieldType) {
	  case 1:
	    return 'sintValue'
	  case 2:
	    return 'floatValue'
	  case 3:
	    return 'doubleValue'
	  case 4:
	    return 'stringValue'
	  case 5:
	    return 'sint64Value'
	  case 6:
	    return 'uintValue'
	  default:
	    return null
	  }
	}
	function transformTuple(coords, transform) {
	  let x = coords[0];
	  let y = coords[1];
	  let z = coords[2] ? coords[2] : undefined;
	  if (transform.scale) {
	    x *= transform.scale.xScale;
	    y *= -transform.scale.yScale;
	    if (undefined !== z) { z *= transform.scale.zScale; }
	  }
	  if (transform.translate) {
	    x += transform.translate.xTranslate;
	    y += transform.translate.yTranslate;
	    if (undefined !== z) { z += transform.translate.zTranslate; }
	  }
	  const ret = [x, y];
	  if (undefined !== z) { ret.push(z); }
	  return ret;
	}
	function difference(a, b) {
	  return a + b
	}

	var arcgisPbf = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': decode
	});

	var index_1 = dist.__moduleExports;

	var tileDecode = getCjsExportFromNamespace(arcgisPbf);

	var ArcGISFeatureLayerSource_1 = createCommonjsModule(function (module, exports) {
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
	    Object.defineProperty(o, "default", { enumerable: true, value: v });
	}) : function(o, v) {
	    o["default"] = v;
	});
	var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
	    if (mod && mod.__esModule) return mod;
	    var result = {};
	    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
	    __setModuleDefault(result, mod);
	    return result;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT = void 0;
	exports.isFeatureLayerSource = isFeatureLayerSource;
	exports.isArcgisFeatureLayerSource = isArcgisFeatureLayerSource;
	const tilebelt$1 = __importStar(tilebelt);
	exports.FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT = 2000000;
	function isFeatureLayerSource(source) {
	    return source.type === "ArcGISFeatureLayer";
	}
	class ArcGISFeatureLayerSource {
	    constructor(requestManager, options) {
	        var _a;
	        this._loading = true;
	        this.rawFeaturesHaveBeenFetched = false;
	        this.exceededBytesLimit = false;
	        this._styleIsResolved = false;
	        this.abortController = null;
	        this.tileFormat = "geojson";
	        this.paused = false;
	        this.type = "ArcGISFeatureLayer";
	        this.sourceId = options.sourceId || (0, esmBrowser.v4)();
	        this.options = options;
	        this.requestManager = requestManager;
	        this.url = this.options.url;
	        options.url = options.url.replace(/\/$/, "");
	        if (!/rest\/services/.test(options.url) ||
	            (!/MapServer/.test(options.url) && !/FeatureServer/.test(options.url))) {
	            throw new Error("Invalid ArcGIS REST Service URL");
	        }
	        if (!/\d+$/.test(options.url)) {
	            throw new Error("URL must end in /FeatureServer/{layerId} or /MapServer/{layerId}");
	        }
	        this.layerId = parseInt(((_a = options.url.match(/\d+$/)) === null || _a === void 0 ? void 0 : _a[0]) || "0");
	        this.initialFetchStrategy = options.fetchStrategy || "auto";
	        caches
	            .open((options === null || options === void 0 ? void 0 : options.cacheKey) || "seasketch-arcgis-rest-services")
	            .then((cache) => {
	            this.cache = cache;
	        });
	    }
	    async getComputedMetadata() {
	        try {
	            if (!this._computedMetadata) {
	                const { serviceMetadata, layers } = await this.getMetadata();
	                const { bounds, minzoom, maxzoom, attribution } = await this.getComputedProperties();
	                const layer = layers.layers.find((l) => l.id === this.layerId);
	                const glStyle = await this.getGLStyleLayers();
	                if (!layer) {
	                    throw new Error("Layer not found");
	                }
	                this._computedMetadata = {
	                    bounds,
	                    minzoom,
	                    maxzoom,
	                    attribution,
	                    supportsDynamicRendering: {
	                        layerOpacity: false,
	                        layerVisibility: false,
	                        layerOrder: false,
	                    },
	                    tableOfContentsItems: [
	                        {
	                            type: "data",
	                            defaultVisibility: true,
	                            id: this.sourceId,
	                            label: layer.name,
	                            metadata: (0, utils$1.generateMetadataForLayer)(this.options.url.replace(/\/\d+$/, ""), serviceMetadata, layer),
	                            glStyle: glStyle,
	                        },
	                    ],
	                };
	            }
	            return this._computedMetadata;
	        }
	        catch (e) {
	            this.error = e.toString();
	            throw e;
	        }
	    }
	    async getComputedProperties() {
	        const { serviceMetadata, layers } = await this.getMetadata();
	        const attribution = this.options.attributionOverride ||
	            (0, utils$1.contentOrFalse)(serviceMetadata.copyrightText) ||
	            undefined;
	        const layer = layers.layers.find((l) => l.id === this.layerId);
	        if (!layer) {
	            throw new Error(`Sublayer ${this.layerId} not found`);
	        }
	        const supportedFormats = ((layer === null || layer === void 0 ? void 0 : layer.supportedQueryFormats) || "")
	            .split(",")
	            .map((f) => f.toUpperCase().trim());
	        this.tileFormat = supportedFormats.includes("PBF") ? "pbf" : "geojson";
	        return {
	            minzoom: 0,
	            maxzoom: 24,
	            bounds: (await (0, utils$1.extentToLatLngBounds)((layer === null || layer === void 0 ? void 0 : layer.extent) || serviceMetadata.fullExtent)) || undefined,
	            attribution,
	            supportedFormats,
	        };
	    }
	    async updateFetchStrategy(fetchStrategy) {
	        var _a;
	        const map = this.map;
	        if (this.initialFetchStrategy !== fetchStrategy && map) {
	            this.initialFetchStrategy = fetchStrategy;
	            (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.abort();
	            const layers = await this.removeFromMap(map);
	            this.options.fetchStrategy = fetchStrategy;
	            delete this.featureData;
	            this.rawFeaturesHaveBeenFetched = false;
	            await this.addToMap(map);
	            for (const layer of layers) {
	                map.addLayer(layer);
	            }
	            this.exceededBytesLimit = false;
	        }
	    }
	    fireError(e) {
	        var _a;
	        (_a = this.map) === null || _a === void 0 ? void 0 : _a.fire("error", {
	            sourceId: this.sourceId,
	            error: e.message,
	        });
	    }
	    getMetadata() {
	        if (this.serviceMetadata && this.layerMetadata) {
	            return Promise.resolve({
	                serviceMetadata: this.serviceMetadata,
	                layers: this.layerMetadata,
	            });
	        }
	        else {
	            if (/FeatureServer/.test(this.options.url)) {
	                return this.requestManager
	                    .getFeatureServerMetadata(this.options.url.replace(/\/\d+$/, ""), {
	                    token: this.options.token,
	                })
	                    .then(({ serviceMetadata, layers }) => {
	                    this.serviceMetadata = serviceMetadata;
	                    this.layerMetadata = layers;
	                    return { serviceMetadata, layers };
	                });
	            }
	            else {
	                return this.requestManager
	                    .getMapServiceMetadata(this.options.url.replace(/\d+[\/]*$/, ""), {
	                    token: this.options.token,
	                })
	                    .then(({ serviceMetadata, layers }) => {
	                    this.serviceMetadata = serviceMetadata;
	                    this.layerMetadata = layers;
	                    return { serviceMetadata, layers };
	                });
	            }
	        }
	    }
	    get loading() {
	        var _a, _b;
	        if (this.paused) {
	            return false;
	        }
	        if (this.options.fetchStrategy === "raw") {
	            return Boolean(((_a = this.map) === null || _a === void 0 ? void 0 : _a.getSource(this.sourceId)) &&
	                ((_b = this.map) === null || _b === void 0 ? void 0 : _b.isSourceLoaded(this.sourceId)) === false);
	        }
	        else {
	            return this._loading;
	        }
	    }
	    async getGLStyleLayers() {
	        if (this._glStylePromise) {
	            return this._glStylePromise;
	        }
	        else {
	            this._glStylePromise = new Promise(async (resolve, reject) => {
	                const { serviceMetadata, layers } = await this.getMetadata();
	                const layer = layers.layers.find((l) => l.id === this.layerId);
	                if (!layer) {
	                    throw new Error("Layer not found");
	                }
	                const styleInfo = (0, index_1.styleForFeatureLayer)(this.options.url.replace(/\/\d+$/, ""), this.layerId, this.sourceId, layer);
	                this._styleIsResolved = true;
	                resolve(styleInfo);
	            });
	            return this._glStylePromise;
	        }
	    }
	    async getGLSource() {
	        const { attribution } = await this.getComputedProperties();
	        if (this.options.fetchStrategy === "raw") {
	            return {
	                type: "geojson",
	                data: (0, fetchData_1.urlForRawGeoJSONData)(this.options.url, "*", 6),
	                attribution: attribution ? attribution : "",
	            };
	        }
	        else {
	            return {
	                type: "geojson",
	                data: this.featureData || {
	                    type: "FeatureCollection",
	                    features: this.featureData || [],
	                },
	                attribution: attribution ? attribution : "",
	            };
	        }
	    }
	    addEventListeners(map) {
	        if (this.map && this.map === map) {
	            return;
	        }
	        else if (this.map) {
	            this.removeEventListeners(map);
	        }
	        this.map = map;
	        if (this.options.fetchStrategy === "raw") {
	            return;
	        }
	        this.QuantizedVectorRequestManager =
	            (0, QuantizedVectorRequestManager_1.getOrCreateQuantizedVectorRequestManager)(map);
	        this._loading = this.featureData ? false : true;
	        if (!this.rawFeaturesHaveBeenFetched) {
	            this.fetchFeatures();
	        }
	    }
	    removeEventListeners(map) {
	        var _a;
	        delete this.map;
	        if (this.options.fetchStrategy === "raw") {
	            return;
	        }
	        (_a = this.QuantizedVectorRequestManager) === null || _a === void 0 ? void 0 : _a.off("update");
	        delete this.QuantizedVectorRequestManager;
	    }
	    async addToMap(map) {
	        const source = await this.getGLSource();
	        map.addSource(this.sourceId, source);
	        this.addEventListeners(map);
	        return this.sourceId;
	    }
	    async fetchFeatures() {
	        var _a, _b, _c, _d;
	        if (this.paused) {
	            return;
	        }
	        if (((_a = this.options) === null || _a === void 0 ? void 0 : _a.fetchStrategy) === "tiled" ||
	            this.getCachedAutoFetchStrategy() === "tiled") {
	            this.options.fetchStrategy = "tiled";
	            this.QuantizedVectorRequestManager.on("update", this.fetchTiles.bind(this));
	            this.fetchTiles();
	            return;
	        }
	        if (this.abortController) {
	            this.abortController.abort();
	        }
	        this.abortController = new AbortController();
	        setTimeout(() => {
	            var _a;
	            (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.abort("timeout");
	        }, 10000);
	        if (this.exceededBytesLimit) {
	            return;
	        }
	        try {
	            const data = await (0, fetchData_1.fetchFeatureCollection)(this.options.url, 6, "*", this.options.fetchStrategy === "raw"
	                ? 120000000
	                : this.options.autoFetchByteLimit ||
	                    exports.FEATURE_LAYER_RECOMMENDED_BYTE_LIMIT, this.abortController, this.options.fetchStrategy === "auto");
	            this.featureData = data;
	            const source = (_b = this.map) === null || _b === void 0 ? void 0 : _b.getSource(this.sourceId);
	            if (source && source.type === "geojson") {
	                this.options.fetchStrategy = "raw";
	                source.setData(data);
	            }
	            this._loading = false;
	            this.rawFeaturesHaveBeenFetched = true;
	        }
	        catch (e) {
	            let shouldFireError = true;
	            let shouldSetLoading = true;
	            if ((typeof e === "string" && /timeout/.test(e)) ||
	                ("message" in e && /limit/i.test(e.message)) ||
	                ((_d = (_c = this.abortController) === null || _c === void 0 ? void 0 : _c.signal) === null || _d === void 0 ? void 0 : _d.reason) === "timeout") {
	                this.exceededBytesLimit = true;
	                if (this.options.fetchStrategy === "auto") {
	                    shouldFireError = false;
	                    shouldSetLoading = false;
	                    this.options.fetchStrategy = "tiled";
	                    this.QuantizedVectorRequestManager.on("update", this.fetchTiles.bind(this));
	                    this.fetchTiles();
	                    this.cacheAutoFetchStrategy("tiled");
	                }
	            }
	            if (shouldFireError) {
	                this.fireError(e);
	                console.error(e);
	            }
	            if (shouldSetLoading) {
	                this._loading = false;
	            }
	        }
	    }
	    cacheAutoFetchStrategy(mode) {
	        localStorage.setItem(`${this.options.url}/fetchStrategy`, `${mode}-${new Date().getTime()}`);
	    }
	    getCachedAutoFetchStrategy() {
	        const value = localStorage.getItem(`${this.options.url}/fetchStrategy`);
	        if (!value || value.length === 0) {
	            return null;
	        }
	        else {
	            const [mode, timestamp] = value.split("-");
	            if (new Date().getTime() - parseInt(timestamp) > 1000 * 60 * 60) {
	                localStorage.setItem(`${this.options.url}/fetchStrategy`, "");
	                return null;
	            }
	            else {
	                return mode;
	            }
	        }
	    }
	    async fetchTiles() {
	        var _a, _b, _c;
	        if (this.paused) {
	            return;
	        }
	        if (this.abortController) {
	            this.abortController.abort();
	        }
	        this.abortController = new AbortController();
	        this._loading = true;
	        if (!this.QuantizedVectorRequestManager) {
	            throw new Error("QuantizedVectorRequestManager not initialized");
	        }
	        else if (this.options.fetchStrategy !== "tiled") {
	            throw new Error("fetchTiles called when fetchStrategy is not quantized. Was " +
	                this.options.fetchStrategy);
	        }
	        const { tiles, tolerance } = this.QuantizedVectorRequestManager.viewportDetails;
	        const fc = {
	            type: "FeatureCollection",
	            features: [],
	        };
	        const featureIds = new Set();
	        try {
	            let wasAborted = false;
	            let errorCount = 0;
	            await Promise.all(tiles.map((tile) => (async () => {
	                var _a;
	                const tileBounds = tilebelt$1.tileToBBOX(tile);
	                const extent = {
	                    spatialReference: {
	                        latestWkid: 4326,
	                        wkid: 4326,
	                    },
	                    xmin: tileBounds[0],
	                    ymin: tileBounds[1],
	                    xmax: tileBounds[2],
	                    ymax: tileBounds[3],
	                };
	                const params = new URLSearchParams({
	                    f: this.tileFormat,
	                    geometry: JSON.stringify(extent),
	                    outFields: "*",
	                    outSR: "4326",
	                    returnZ: "false",
	                    returnM: "false",
	                    precision: "8",
	                    where: "1=1",
	                    setAttributionFromService: "true",
	                    quantizationParameters: JSON.stringify({
	                        extent,
	                        tolerance,
	                        mode: "view",
	                    }),
	                    resultType: "tile",
	                    spatialRel: "esriSpatialRelIntersects",
	                    maxAllowableOffset: this.tileFormat === "geojson" ? tolerance.toString() : "",
	                    geometryType: "esriGeometryEnvelope",
	                    inSR: "4326",
	                    ...this.options.queryParameters,
	                });
	                return (0, ArcGISRESTServiceRequestManager_1.fetchWithTTL)(`${`${this.options.url}/query?${params.toString()}`}`, 60 * 10, this.cache, { signal: (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.signal }, `${this.options.url}/query/tiled/${tilebelt$1.tileToQuadkey(tile)}/${params.get("f")}`)
	                    .then((response) => params.get("f") === "pbf"
	                    ? response.arrayBuffer()
	                    : response.json())
	                    .then((data) => {
	                    var _a, _b;
	                    if ((_b = (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.signal) === null || _b === void 0 ? void 0 : _b.aborted) {
	                        return;
	                    }
	                    const collection = params.get("f") === "pbf"
	                        ? tileDecode(new Uint8Array(data)).featureCollection
	                        : data;
	                    for (const feature of collection.features) {
	                        if (!featureIds.has(feature.id)) {
	                            featureIds.add(feature.id);
	                            fc.features.push(feature);
	                        }
	                    }
	                })
	                    .catch((e) => {
	                    if (!/aborted/i.test(e.toString())) {
	                        this.fireError(e);
	                        errorCount++;
	                        console.error(e);
	                    }
	                    else {
	                        wasAborted = true;
	                    }
	                });
	            })()));
	            if (((_b = (_a = this.abortController) === null || _a === void 0 ? void 0 : _a.signal) === null || _b === void 0 ? void 0 : _b.aborted) || wasAborted) {
	                return;
	            }
	            const source = (_c = this.map) === null || _c === void 0 ? void 0 : _c.getSource(this.sourceId);
	            if (source && source.type === "geojson" && errorCount < tiles.length) {
	                source.setData(fc);
	                this.featureData = fc;
	            }
	            this._loading = false;
	        }
	        catch (e) {
	            if (!/aborted/i.test(e.toString())) {
	                this.fireError(e);
	                console.error(e);
	            }
	            this._loading = false;
	        }
	    }
	    async updateLayers(layerSettings) {
	        const visible = Boolean(layerSettings.find((l) => l.id === this.sourceId));
	        if (this.map) {
	            const layers = this.map.getStyle().layers || [];
	            for (const layer of layers) {
	                if ("source" in layer && layer.source === this.sourceId) {
	                    this.map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
	                }
	            }
	        }
	        if (!visible) {
	            this.pauseUpdates();
	        }
	        else if (visible) {
	            this.resumeUpdates();
	        }
	    }
	    pauseUpdates() {
	        if (this.paused === false) {
	            this.paused = true;
	        }
	    }
	    resumeUpdates() {
	        if (this.paused === true) {
	            this.paused = false;
	            if ((this.options.fetchStrategy === "raw" ||
	                this.options.fetchStrategy === "auto") &&
	                !this.rawFeaturesHaveBeenFetched) {
	                this.fetchFeatures();
	            }
	            else if (this.options.fetchStrategy === "tiled") {
	                this.fetchTiles();
	            }
	        }
	    }
	    async removeFromMap(map) {
	        const removedLayers = [];
	        if (this.map) {
	            const source = map.getSource(this.sourceId);
	            if (source) {
	                const layers = map.getStyle().layers || [];
	                for (const layer of layers) {
	                    if ("source" in layer && layer.source === this.sourceId) {
	                        removedLayers.push(layer);
	                        map.removeLayer(layer.id);
	                    }
	                }
	                map.removeSource(this.sourceId);
	            }
	            this.removeEventListeners(map);
	        }
	        return removedLayers;
	    }
	    destroy() {
	        if (this.map) {
	            this.removeFromMap(this.map);
	        }
	        if (this.abortController) {
	            this.abortController.abort();
	        }
	    }
	    async getFetchStrategy() {
	        if (this.paused) {
	            this.resumeUpdates();
	        }
	        if (this.options.fetchStrategy === "auto") {
	            if (this.rawFeaturesHaveBeenFetched) {
	                return "raw";
	            }
	            else if (this.options.fetchStrategy === "auto" && !this.error) {
	                return new Promise((resolve) => {
	                    const interval = setInterval(() => {
	                        if (this.options.fetchStrategy !== "auto") {
	                            clearInterval(interval);
	                            resolve(this.options.fetchStrategy || "auto");
	                        }
	                    }, 500);
	                });
	            }
	            else {
	                return "auto";
	            }
	        }
	        else {
	            return this.options.fetchStrategy || "raw";
	        }
	    }
	    get ready() {
	        return this._styleIsResolved && Boolean(this._computedMetadata);
	    }
	    async prepare() {
	        await this.getComputedMetadata();
	        return;
	    }
	}
	exports.default = ArcGISFeatureLayerSource;
	function isArcgisFeatureLayerSource(source) {
	    return source.type === "ArcGISFeatureLayer";
	}
	});

	var utils = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.toTextAnchor = exports.ptToPx = exports.colorAndOpacity = exports.rgba = void 0;
	exports.setCanvasPolyfill = setCanvasPolyfill;
	exports.generateId = generateId;
	exports.createCanvas = createCanvas;
	let CANVAS_POLYFILL = null;
	function setCanvasPolyfill(polyfill) {
	    CANVAS_POLYFILL = polyfill;
	}
	function generateId() {
	    return (0, esmBrowser.v4)();
	}
	function createCanvas(w, h) {
	    if (CANVAS_POLYFILL) {
	        return CANVAS_POLYFILL(w, h);
	    }
	    else {
	        const canvas = document.createElement("canvas");
	        canvas.setAttribute("width", w.toString());
	        canvas.setAttribute("height", h.toString());
	        return canvas;
	    }
	}
	const rgba = (color) => {
	    color = color || [0, 0, 0, 0];
	    return `rgba(${color[0]},${color[1]},${color[2]},${color[3] / 255})`;
	};
	exports.rgba = rgba;
	const colorAndOpacity = (color) => {
	    color = color || [0, 0, 0, 0];
	    return {
	        color: `rgb(${color[0]},${color[1]},${color[2]})`,
	        opacity: color[3] / 255,
	    };
	};
	exports.colorAndOpacity = colorAndOpacity;
	const ptToPx = (pt) => Math.round(pt * 1.33);
	exports.ptToPx = ptToPx;
	const ANCHORS = {
	    esriServerPointLabelPlacementAboveCenter: "bottom",
	    esriServerPointLabelPlacementAboveLeft: "bottom-right",
	    esriServerPointLabelPlacementAboveRight: "bottom-left",
	    esriServerPointLabelPlacementBelowCenter: "top",
	    esriServerPointLabelPlacementBelowLeft: "top-right",
	    esriServerPointLabelPlacementBelowRight: "top-left",
	    esriServerPointLabelPlacementCenterCenter: "center",
	    esriServerPointLabelPlacementCenterLeft: "right",
	    esriServerPointLabelPlacementCenterRight: "left",
	    esriServerLinePlacementAboveAlong: "bottom",
	    esriServerLinePlacementAboveBefore: "bottom-left",
	    esriServerLinePlacementAboveStart: "bottom-left",
	    esriServerLinePlacementAboveEnd: "bottom-right",
	    esriServerLinePlacementBelowAfter: "top-right",
	    esriServerLinePlacementBelowAlong: "top",
	    esriServerLinePlacementBelowBefore: "top-left",
	    esriServerLinePlacementBelowStart: "top-left",
	    esriServerLinePlacementBelowEnd: "top-right",
	    esriServerLinePlacementCenterAfter: "right",
	    esriServerLinePlacementCenterAlong: "center",
	    esriServerLinePlacementCenterBefore: "center-left",
	    esriServerLinePlacementCenterStart: "center-left",
	    esriServerLinePlacementCenterEnd: "center-right",
	    esriServerPolygonPlacementAlwaysHorizontal: "center",
	};
	const toTextAnchor = (labelPlacement) => ANCHORS[labelPlacement] || "center";
	exports.toTextAnchor = toTextAnchor;
	});

	var linePatterns = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	const patterns = {
	    esriSLSDash: (strokeWidth) => [2, 0.5],
	    esriSLSDashDot: (strokeWidth) => [3, 1, 1, 1],
	    esriSLSDashDotDot: (strokeWidth) => [3, 1, 1, 1, 1, 1],
	    esriSLSNull: () => [0, 10],
	    esriSLSDot: (strokeWidth) => [1, 1],
	};
	exports.default = patterns;
	});

	var esriSLS = createCommonjsModule(function (module, exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	const linePatterns_1 = __importDefault(linePatterns);
	const utils_2 = utils;
	exports.default = (symbol, sourceId) => {
	    const { color, opacity } = (0, utils.colorAndOpacity)(symbol.color);
	    let strokeWidth = (0, utils.ptToPx)(symbol.width || 1);
	    if (strokeWidth === -1) {
	        strokeWidth = 1;
	    }
	    const style = symbol.style || "esriSLSSolid";
	    const layer = {
	        id: (0, utils_2.generateId)(),
	        type: "line",
	        paint: {
	            "line-color": color,
	            "line-opacity": opacity,
	            "line-width": strokeWidth,
	        },
	        layout: {},
	        source: sourceId,
	    };
	    if (style !== "esriSLSSolid") {
	        layer.paint["line-dasharray"] = linePatterns_1.default[style](strokeWidth);
	    }
	    return [layer];
	};
	});

	var esriSFS = createCommonjsModule(function (module, exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	const esriSLS_1 = __importDefault(esriSLS);
	const utils_2 = utils;
	exports.default = (symbol, sourceId, imageList) => {
	    const layers = [];
	    let useFillOutlineColor = symbol.outline &&
	        (0, utils.ptToPx)(symbol.outline.width || 1) === 1 &&
	        symbol.outline.style === "esriSLSSolid";
	    switch (symbol.style) {
	        case "esriSFSSolid":
	            if (symbol.color && symbol.color[3] === 0) {
	                useFillOutlineColor = false;
	            }
	            else {
	                layers.push({
	                    id: (0, utils_2.generateId)(),
	                    type: "fill",
	                    source: sourceId,
	                    paint: {
	                        "fill-color": (0, utils.rgba)(symbol.color),
	                        ...(useFillOutlineColor
	                            ? { "fill-outline-color": (0, utils.rgba)(symbol.outline.color) }
	                            : {}),
	                    },
	                });
	            }
	            break;
	        case "esriSFSNull":
	            break;
	        case "esriSFSBackwardDiagonal":
	        case "esriSFSCross":
	        case "esriSFSDiagonalCross":
	        case "esriSFSForwardDiagonal":
	        case "esriSFSHorizontal":
	        case "esriSFSVertical":
	            const imageId = imageList.addEsriSFS(symbol);
	            layers.push({
	                id: (0, utils_2.generateId)(),
	                source: sourceId,
	                type: "fill",
	                paint: {
	                    "fill-pattern": imageId,
	                    ...(useFillOutlineColor
	                        ? { "fill-outline-color": (0, utils.rgba)(symbol.outline.color) }
	                        : {}),
	                },
	            });
	            break;
	        default:
	            throw new Error(`Unknown fill style ${symbol.style}`);
	    }
	    if (symbol.outline && !useFillOutlineColor) {
	        let outline = (0, esriSLS_1.default)(symbol.outline, sourceId);
	        layers.push(...outline);
	    }
	    return layers;
	};
	});

	var esriPMS = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = (symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) => {
	    const imageId = imageList.addEsriPMS(symbol, serviceBaseUrl, sublayer, legendIndex);
	    return [
	        {
	            id: (0, utils.generateId)(),
	            source: sourceId,
	            type: "symbol",
	            paint: {},
	            layout: {
	                "icon-allow-overlap": true,
	                "icon-rotate": symbol.angle || 0,
	                "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
	                "icon-image": imageId,
	            },
	        },
	    ];
	};
	});

	var esriSMS = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = (symbol, sourceId, imageList) => {
	    var _a, _b;
	    if (symbol.style === "esriSMSCircle") {
	        return [
	            {
	                id: (0, utils.generateId)(),
	                type: "circle",
	                source: sourceId,
	                paint: {
	                    "circle-color": (0, utils.rgba)(symbol.color),
	                    "circle-radius": symbol.size,
	                    "circle-stroke-color": (0, utils.rgba)(((_a = symbol.outline) === null || _a === void 0 ? void 0 : _a.color) || symbol.color),
	                    "circle-stroke-width": ((_b = symbol.outline) === null || _b === void 0 ? void 0 : _b.width) || 0,
	                },
	                layout: {},
	            },
	        ];
	    }
	    else {
	        const imageId = imageList.addEsriSMS(symbol);
	        return [
	            {
	                id: (0, utils.generateId)(),
	                type: "symbol",
	                source: sourceId,
	                paint: {},
	                layout: {
	                    "icon-allow-overlap": true,
	                    "icon-rotate": symbol.angle,
	                    "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
	                    "icon-image": imageId,
	                    "icon-size": 1,
	                },
	            },
	        ];
	    }
	};
	});

	var esriPFS = createCommonjsModule(function (module, exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	const esriSLS_1 = __importDefault(esriSLS);
	exports.default = (symbol, sourceId, imageList) => {
	    const imageId = imageList.addEsriPFS(symbol);
	    const layers = [
	        {
	            id: (0, utils.generateId)(),
	            source: sourceId,
	            type: "fill",
	            paint: {
	                "fill-pattern": imageId,
	            },
	            layout: {},
	        },
	    ];
	    if ("outline" in symbol) {
	        let outline = (0, esriSLS_1.default)(symbol.outline, sourceId);
	        layers.push(...outline);
	    }
	    return layers;
	};
	});

	var symbols = createCommonjsModule(function (module, exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.symbolToLayers = symbolToLayers;
	const esriSLS_1 = __importDefault(esriSLS);
	const esriSFS_1 = __importDefault(esriSFS);
	const esriPMS_1 = __importDefault(esriPMS);
	const esriSMS_1 = __importDefault(esriSMS);
	const esriPFS_1 = __importDefault(esriPFS);
	function symbolToLayers(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) {
	    var layers;
	    switch (symbol.type) {
	        case "esriSFS":
	            layers = (0, esriSFS_1.default)(symbol, sourceId, imageList);
	            break;
	        case "esriPFS":
	            layers = (0, esriPFS_1.default)(symbol, sourceId, imageList);
	            break;
	        case "esriSLS":
	            layers = (0, esriSLS_1.default)(symbol, sourceId);
	            break;
	        case "esriPMS":
	            layers = (0, esriPMS_1.default)(symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex);
	            break;
	        case "esriSMS":
	            layers = (0, esriSMS_1.default)(symbol, sourceId, imageList);
	            break;
	        default:
	            throw new Error(`Unknown symbol type ${symbol.type}`);
	    }
	    return layers;
	}
	});

	var ImageList_1$1 = ImageList_1;

	var drawSMS = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = default_1;
	function default_1(symbol, pixelRatio) {
	    var _a, _b;
	    const size = (0, utils.ptToPx)(symbol.size || 13);
	    const scale = 2 ** (pixelRatio - 1);
	    const width = (size + 1 * 2 + (((_a = symbol.outline) === null || _a === void 0 ? void 0 : _a.width) || 0) * 2) * scale;
	    const height = width;
	    let canvas = (0, utils.createCanvas)(width, height);
	    var ctx = canvas.getContext("2d");
	    ctx.lineWidth =
	        (0, utils.ptToPx)(!!symbol.outline ? symbol.outline.width || 1 : 1) * scale;
	    ctx.strokeStyle = !!symbol.outline
	        ? (0, utils.rgba)((_b = symbol.outline) === null || _b === void 0 ? void 0 : _b.color)
	        : (0, utils.rgba)(symbol.color);
	    ctx.fillStyle = (0, utils.rgba)(symbol.color);
	    switch (symbol.style) {
	        case "esriSMSCircle":
	            ctx.beginPath();
	            var x = width / 2;
	            var y = height / 2;
	            var diameter = size * scale;
	            var radius = Math.round((diameter + ctx.lineWidth) / 2);
	            ctx.arc(x, y, radius, 0, Math.PI * 2, true);
	            ctx.fill();
	            ctx.stroke();
	            break;
	        case "esriSMSCross":
	            var w = size * scale;
	            ctx.lineWidth = Math.round(w / 4);
	            ctx.strokeStyle = (0, utils.rgba)(symbol.color);
	            ctx.moveTo(width / 2, (height - w) / 2);
	            ctx.lineTo(width / 2, height - (height - w) / 2);
	            ctx.moveTo((width - w) / 2, height / 2);
	            ctx.lineTo(width - (width - w) / 2, height / 2);
	            ctx.stroke();
	            ctx.fill();
	            break;
	        case "esriSMSX":
	            var w = size * scale;
	            ctx.translate(width / 2, height / 2);
	            ctx.rotate((45 * Math.PI) / 180);
	            ctx.translate(-width / 2, -height / 2);
	            ctx.moveTo(width / 2, (height - w) / 2);
	            ctx.lineTo(width / 2, height - (height - w) / 2);
	            ctx.moveTo((width - w) / 2, height / 2);
	            ctx.lineTo(width - (width - w) / 2, height / 2);
	            ctx.stroke();
	            ctx.fill();
	            ctx.setTransform(1, 0, 0, 1, 0, 0);
	            break;
	        case "esriSMSDiamond":
	            var w = size * scale;
	            var h = w;
	            var x = width / 2 - w / 2;
	            var y = height / 2 - h / 2;
	            ctx.translate(x + w / 2, y + h / 2);
	            ctx.rotate((45 * Math.PI) / 180);
	            ctx.fillRect(-w / 2, -h / 2, w, h);
	            ctx.strokeRect(-w / 2, -h / 2, w, h);
	            break;
	        case "esriSMSSquare":
	            var w = size * scale;
	            var h = w;
	            var x = width / 2 - w / 2;
	            var y = height / 2 - h / 2;
	            ctx.fillRect(x, y, w, h);
	            ctx.strokeRect(x, y, w, h);
	            break;
	        case "esriSMSTriangle":
	            ctx.beginPath();
	            var w = size * scale;
	            var h = w;
	            var midpoint = width / 2;
	            var x1 = midpoint;
	            var y1 = (height - width) / 2;
	            var x2 = width - (width - width) / 2;
	            var y2 = height - (height - width) / 2;
	            var x3 = (width - width) / 2;
	            var y3 = height - (height - width) / 2;
	            ctx.moveTo(x1, y1);
	            ctx.lineTo(x2, y2);
	            ctx.lineTo(x3, y3);
	            ctx.lineTo(x1, y1);
	            ctx.fill();
	            ctx.stroke();
	            break;
	        default:
	            throw new Error(`Unknown symbol type ${symbol.style}`);
	    }
	    const data = (0, ImageList_1$1.CANVAS_TO_DATA_URL)(canvas);
	    console.log("canvas data", data);
	    return { width, height, data };
	}
	});

	var fillPatterns = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = {
	    esriSFSVertical: (ctx, strokeStyle = "#000000") => {
	        ctx.strokeStyle = strokeStyle || "#000000";
	        ctx.lineWidth = 1;
	        ctx.beginPath();
	        ctx.moveTo(8, -4);
	        ctx.lineTo(8, 20);
	        ctx.stroke();
	    },
	    esriSFSHorizontal: (ctx, strokeStyle = "#000000") => {
	        ctx.strokeStyle = strokeStyle || "#000000";
	        ctx.lineWidth = 1;
	        ctx.beginPath();
	        ctx.moveTo(-4, 8);
	        ctx.lineTo(20, 8);
	        ctx.stroke();
	    },
	    esriSFSBackwardDiagonal: (ctx, strokeStyle = "#000000") => {
	        ctx.strokeStyle = strokeStyle;
	        ctx.lineWidth = 1;
	        ctx.beginPath();
	        ctx.moveTo(-1, 9);
	        ctx.lineTo(9, -1);
	        ctx.stroke();
	        ctx.beginPath();
	        ctx.moveTo(17, 7);
	        ctx.lineTo(7, 17);
	        ctx.stroke();
	    },
	    esriSFSForwardDiagonal: (ctx, strokeStyle = "#000000") => {
	        ctx.strokeStyle = strokeStyle;
	        ctx.lineWidth = 1;
	        ctx.beginPath();
	        ctx.moveTo(-1, 7);
	        ctx.lineTo(9, 17);
	        ctx.stroke();
	        ctx.beginPath();
	        ctx.moveTo(7, -1);
	        ctx.lineTo(17, 9);
	        ctx.stroke();
	    },
	    esriSFSCross: (ctx, strokeStyle = "#000000") => {
	        ctx.strokeStyle = strokeStyle;
	        ctx.lineWidth = 1;
	        ctx.beginPath();
	        ctx.moveTo(-1, 8);
	        ctx.lineTo(17, 8);
	        ctx.stroke();
	        ctx.beginPath();
	        ctx.moveTo(8, -1);
	        ctx.lineTo(8, 17);
	        ctx.stroke();
	    },
	    esriSFSDiagonalCross: (ctx, strokeStyle = "#000000") => {
	        ctx.strokeStyle = strokeStyle;
	        ctx.lineWidth = 1;
	        ctx.beginPath();
	        ctx.moveTo(-1, 7);
	        ctx.lineTo(9, 17);
	        ctx.stroke();
	        ctx.beginPath();
	        ctx.moveTo(7, -1);
	        ctx.lineTo(17, 9);
	        ctx.stroke();
	        ctx.beginPath();
	        ctx.moveTo(-1, 9);
	        ctx.lineTo(9, -1);
	        ctx.stroke();
	        ctx.beginPath();
	        ctx.moveTo(7, 17);
	        ctx.lineTo(17, 7);
	        ctx.stroke();
	    },
	};
	});

	var ImageList_1 = createCommonjsModule(function (module, exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CANVAS_TO_DATA_URL = exports.ImageList = void 0;
	exports.setCanvasToDataURLPolyfill = setCanvasToDataURLPolyfill;
	const drawSMS_1 = __importDefault(drawSMS);
	const fillPatterns_1 = __importDefault(fillPatterns);
	class ImageList {
	    constructor(arcGISVersion, imageSets) {
	        this.imageSets = [];
	        this.supportsHighDPILegends = false;
	        if (arcGISVersion && arcGISVersion >= 10.6) {
	            this.supportsHighDPILegends = true;
	        }
	        if (imageSets) {
	            this.imageSets = imageSets;
	        }
	    }
	    toJSON() {
	        return Promise.all(this.imageSets).then((imageSets) => {
	            return imageSets;
	        });
	    }
	    addEsriPFS(symbol) {
	        const imageid = (0, esmBrowser.v4)();
	        this.imageSets.push({
	            id: imageid,
	            images: [
	                {
	                    pixelRatio: 1,
	                    dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
	                    width: (0, utils.ptToPx)(symbol.width),
	                    height: (0, utils.ptToPx)(symbol.height),
	                },
	            ],
	        });
	        return imageid;
	    }
	    addEsriPMS(symbol, serviceBaseUrl, sublayer, legendIndex) {
	        const imageid = (0, esmBrowser.v4)();
	        this.imageSets.push({
	            id: imageid,
	            images: [
	                {
	                    pixelRatio: 1,
	                    dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
	                    width: (0, utils.ptToPx)(symbol.width),
	                    height: (0, utils.ptToPx)(symbol.height),
	                },
	            ],
	        });
	        return imageid;
	    }
	    addEsriSMS(symbol) {
	        const imageid = (0, esmBrowser.v4)();
	        const images = [1, 2, 3].map((pixelRatio) => {
	            const marker = (0, drawSMS_1.default)(symbol, pixelRatio);
	            if (pixelRatio === 1)
	                marker.width;
	            return {
	                dataURI: marker.data,
	                pixelRatio,
	                width: marker.width,
	                height: marker.height,
	            };
	        });
	        this.imageSets.push({
	            id: imageid,
	            images: images,
	        });
	        return imageid;
	    }
	    addEsriSFS(symbol) {
	        const imageId = (0, esmBrowser.v4)();
	        const pattern = fillPatterns_1.default[symbol.style];
	        this.imageSets.push({
	            id: imageId,
	            images: [
	                createFillImage(pattern, (0, utils.rgba)(symbol.color)),
	            ],
	        });
	        return imageId;
	    }
	    addToMap(map) {
	        return Promise.all(this.imageSets.map(async (imageSet) => {
	            if (imageSet instanceof Promise) {
	                imageSet = await imageSet;
	            }
	            let imageData = imageSet.images[0];
	            if (imageSet.images.length > 1) {
	                imageData =
	                    imageSet.images.find((i) => i.pixelRatio === Math.round(window.devicePixelRatio)) || imageData;
	            }
	            const image = await createImage(imageData.width, imageData.height, imageData.dataURI);
	            map.addImage(imageSet.id, image, {
	                pixelRatio: imageData.pixelRatio,
	            });
	        }));
	    }
	    removeFromMap(map) {
	        return Promise.all(this.imageSets.map(async (imageSet) => {
	            if (imageSet instanceof Promise) {
	                imageSet = await imageSet;
	            }
	            map.removeImage(imageSet.id);
	        }));
	    }
	}
	exports.ImageList = ImageList;
	async function createImage(width, height, dataURI) {
	    return new Promise((resolve) => {
	        const image = new Image(width, height);
	        image.src = dataURI;
	        image.onload = () => {
	            resolve(image);
	        };
	    });
	}
	function createFillImage(pattern, strokeStyle) {
	    const canvas = (0, utils.createCanvas)(16, 16);
	    const ctx = canvas.getContext("2d");
	    ctx.imageSmoothingEnabled = true;
	    pattern(ctx, strokeStyle);
	    return {
	        pixelRatio: 2,
	        dataURI: (0, exports.CANVAS_TO_DATA_URL)(canvas),
	        width: 16,
	        height: 16,
	    };
	}
	let CANVAS_TO_DATA_URL = (canvas) => {
	    return canvas.toDataURL();
	};
	exports.CANVAS_TO_DATA_URL = CANVAS_TO_DATA_URL;
	function setCanvasToDataURLPolyfill(polyfill) {
	    exports.CANVAS_TO_DATA_URL = polyfill;
	}
	});

	var esriTS = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = (labelingInfo, geometryType, fieldNames) => {
	    return {
	        id: (0, utils.generateId)(),
	        type: "symbol",
	        layout: {
	            "text-field": toExpression(labelingInfo.labelExpression, fieldNames),
	            "text-anchor": (0, utils.toTextAnchor)(labelingInfo.labelPlacement),
	            "text-size": (0, utils.ptToPx)(labelingInfo.symbol.font.size || 13),
	            "symbol-placement": geometryType === "line" ? "line" : "point",
	            "text-max-angle": 20,
	        },
	        paint: {
	            "text-color": (0, utils.rgba)(labelingInfo.symbol.color),
	            "text-halo-width": (0, utils.ptToPx)(labelingInfo.symbol.haloSize || 0),
	            "text-halo-color": (0, utils.rgba)(labelingInfo.symbol.haloColor || [255, 255, 255, 255]),
	            "text-halo-blur": (0, utils.ptToPx)(labelingInfo.symbol.haloSize || 0) * 0.5,
	        },
	    };
	};
	function toExpression(labelExpression, fieldNames) {
	    const fields = (labelExpression.match(/\[\w+\]/g) || [])
	        .map((val) => val.replace(/[\[\]]/g, ""))
	        .map((val) => fieldNames.find((name) => name.toLowerCase() === val.toLowerCase()));
	    const strings = labelExpression.split(/\[\w+\]/g);
	    const expression = ["format"];
	    while (strings.length) {
	        expression.push(strings.shift());
	        const field = fields.shift();
	        if (field) {
	            expression.push(["get", field]);
	        }
	    }
	    return expression;
	}
	});

	var styleForFeatureLayer_1 = createCommonjsModule(function (module, exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	const esriTS_1 = __importDefault(esriTS);
	async function styleForFeatureLayer(serviceBaseUrl, sublayer, sourceId, serviceMetadata) {
	    serviceBaseUrl = serviceBaseUrl.replace(/\/$/, "");
	    const url = `${serviceBaseUrl}/${sublayer}`;
	    serviceMetadata =
	        serviceMetadata || (await fetch(url + "?f=json").then((r) => r.json()));
	    const renderer = serviceMetadata.drawingInfo.renderer;
	    let layers = [];
	    const imageList = new ImageList_1$1.ImageList(serviceMetadata.currentVersion);
	    let legendItemIndex = 0;
	    switch (renderer.type) {
	        case "uniqueValue": {
	            const fields = [renderer.field1];
	            if (renderer.field2) {
	                fields.push(renderer.field2);
	                if (renderer.field3) {
	                    fields.push(renderer.field3);
	                }
	            }
	            const filters = [];
	            const field = renderer.field1;
	            legendItemIndex = renderer.defaultSymbol ? 1 : 0;
	            const fieldTypes = fields.map((f) => {
	                const fieldRecord = serviceMetadata.fields.find((r) => r.name === f);
	                return FIELD_TYPES[fieldRecord === null || fieldRecord === void 0 ? void 0 : fieldRecord.type] || "string";
	            });
	            for (const info of renderer.uniqueValueInfos) {
	                const values = normalizeValuesForFieldTypes(info.value, renderer.fieldDelimiter, fieldTypes);
	                layers.push(...(0, symbols.symbolToLayers)(info.symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendItemIndex++).map((lyr) => {
	                    var _a;
	                    if ((_a = info.label) === null || _a === void 0 ? void 0 : _a.length) {
	                        lyr.metadata = { label: info.label };
	                    }
	                    if (fields.length === 1) {
	                        lyr.filter = ["==", ["get", field], values[0]];
	                        filters.push(lyr.filter);
	                    }
	                    else {
	                        lyr.filter = [
	                            "all",
	                            ...fields.map((field) => [
	                                "==",
	                                ["get", field],
	                                values[fields.indexOf(field)],
	                            ]),
	                        ];
	                        filters.push(lyr.filter);
	                    }
	                    return lyr;
	                }));
	            }
	            if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
	                layers.push(...(0, symbols.symbolToLayers)(renderer.defaultSymbol, sourceId, imageList, serviceBaseUrl, sublayer, 0).map((lyr) => {
	                    lyr.filter = ["!=", ["any", ...filters], true];
	                    lyr.metadata = { label: "Default" };
	                    return lyr;
	                }));
	            }
	            break;
	        }
	        case "classBreaks":
	            if (renderer.backgroundFillSymbol) {
	                layers.push(...(0, symbols.symbolToLayers)(renderer.backgroundFillSymbol, sourceId, imageList, serviceBaseUrl, sublayer, 0));
	            }
	            const field = renderer.field;
	            const filters = [];
	            legendItemIndex = renderer.classBreakInfos.length - 1;
	            let minValue = 0;
	            const minMaxValues = renderer.classBreakInfos.map((b) => {
	                const values = [b.classMinValue || minValue, b.classMaxValue];
	                minValue = values[1];
	                return values;
	            });
	            for (const info of [...renderer.classBreakInfos].reverse()) {
	                layers.push(...(0, symbols.symbolToLayers)(info.symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendItemIndex--).map((lyr) => {
	                    var _a;
	                    const [min, max] = minMaxValues[renderer.classBreakInfos.indexOf(info)];
	                    if (renderer.classBreakInfos.indexOf(info) === 0) {
	                        lyr.filter = ["all", ["<=", ["get", field], max]];
	                    }
	                    else {
	                        lyr.filter = [
	                            "all",
	                            [">", ["get", field], min],
	                            ["<=", ["get", field], max],
	                        ];
	                    }
	                    if ((_a = info.label) === null || _a === void 0 ? void 0 : _a.length) {
	                        lyr.metadata = { label: info.label };
	                    }
	                    filters.push(lyr.filter);
	                    return lyr;
	                }));
	            }
	            if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
	                const defaultLayers = await (0, symbols.symbolToLayers)(renderer.defaultSymbol, sourceId, imageList, serviceBaseUrl, sublayer, 0);
	                for (const index in defaultLayers) {
	                    defaultLayers[index].filter = ["none", filters];
	                    defaultLayers[index].metadata = { label: "Default" };
	                }
	                layers.push(...defaultLayers);
	            }
	            break;
	        default:
	            layers = (0, symbols.symbolToLayers)(renderer.symbol, sourceId, imageList, serviceBaseUrl, sublayer, 0);
	            break;
	    }
	    if (serviceMetadata.drawingInfo.labelingInfo) {
	        for (const info of serviceMetadata.drawingInfo.labelingInfo) {
	            if (info.labelExpression) {
	                const layer = (0, esriTS_1.default)(info, serviceMetadata.geometryType, serviceMetadata.fields.map((f) => f.name));
	                layer.source = sourceId;
	                layer.id = (0, utils.generateId)();
	                layers.push(layer);
	            }
	        }
	    }
	    return {
	        imageList,
	        layers,
	    };
	}
	function normalizeValuesForFieldTypes(value, delimiter, fieldTypes) {
	    const values = value.split(delimiter);
	    return values.map((v, i) => {
	        if (fieldTypes[i] === "string") {
	            return v;
	        }
	        else if (fieldTypes[i] === "integer") {
	            return parseInt(v);
	        }
	        else if (fieldTypes[i] === "float") {
	            return parseFloat(v);
	        }
	    });
	}
	const FIELD_TYPES = {
	    esriFieldTypeSmallInteger: "integer",
	    esriFieldTypeInteger: "integer",
	    esriFieldTypeSingle: "float",
	    esriFieldTypeDouble: "float",
	    esriFieldTypeString: "string",
	    esriFieldTypeDate: "string",
	    esriFieldTypeOID: "integer",
	    esriFieldTypeGeometry: "string",
	    esriFieldTypeBlob: "string",
	    esriFieldTypeRaster: "string",
	    esriFieldTypeGUID: "string",
	    esriFieldTypeGlobalID: "string",
	    esriFieldTypeXML: "string",
	};
	exports.default = styleForFeatureLayer;
	});

	var dist = createCommonjsModule(function (module, exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.setCanvasToDataURLPolyfill = exports.setCanvasPolyfill = exports.fetchFeatureLayerData = exports.ImageList = exports.styleForFeatureLayer = exports.generateMetadataForLayer = exports.ArcGISFeatureLayerSource = exports.ArcGISRESTServiceRequestManager = exports.ArcGISVectorSource = exports.ArcGISDynamicMapService = exports.ArcGISTiledMapService = void 0;
	Object.defineProperty(exports, "ArcGISDynamicMapService", { enumerable: true, get: function () { return ArcGISDynamicMapService_1.ArcGISDynamicMapService; } });
	Object.defineProperty(exports, "ArcGISVectorSource", { enumerable: true, get: function () { return ArcGISVectorSource_1.ArcGISVectorSource; } });
	Object.defineProperty(exports, "ArcGISRESTServiceRequestManager", { enumerable: true, get: function () { return ArcGISRESTServiceRequestManager_1.ArcGISRESTServiceRequestManager; } });
	Object.defineProperty(exports, "ArcGISTiledMapService", { enumerable: true, get: function () { return ArcGISTiledMapService_1.ArcGISTiledMapService; } });
	Object.defineProperty(exports, "ArcGISFeatureLayerSource", { enumerable: true, get: function () { return __importDefault(ArcGISFeatureLayerSource_1).default; } });
	Object.defineProperty(exports, "generateMetadataForLayer", { enumerable: true, get: function () { return utils$1.generateMetadataForLayer; } });
	Object.defineProperty(exports, "styleForFeatureLayer", { enumerable: true, get: function () { return __importDefault(styleForFeatureLayer_1).default; } });
	Object.defineProperty(exports, "ImageList", { enumerable: true, get: function () { return ImageList_1$1.ImageList; } });
	var ArcGISVectorSource_2 = ArcGISVectorSource_1;
	Object.defineProperty(exports, "fetchFeatureLayerData", { enumerable: true, get: function () { return ArcGISVectorSource_2.fetchFeatureLayerData; } });
	Object.defineProperty(exports, "setCanvasPolyfill", { enumerable: true, get: function () { return utils.setCanvasPolyfill; } });
	var ImageList_2 = ImageList_1$1;
	Object.defineProperty(exports, "setCanvasToDataURLPolyfill", { enumerable: true, get: function () { return ImageList_2.setCanvasToDataURLPolyfill; } });
	});

	return dist;

})();
