/* Copy dashboards from Safari to the Home Screen app with a short one-time code.
   The browser encrypts everything with a random key before it leaves the device.
   The Worker only stores ciphertext, and the code holds the id plus the key. */
(function (root) {
  "use strict";
  var ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var ID_LEN = 8;
  var KEY_BYTES = 10;
  var KEY_CHARS = 16;

  function isStandalone() {
    try {
      return !!(root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) ||
        root.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function backendUrl() {
    var c = root.AO_CONFIG || {};
    return String(c.backendUrl || "").replace(/\/+$/, "");
  }
  function normalize(raw) {
    return String(raw || "")
      .toUpperCase()
      .replace(/[IL]/g, "1")
      .replace(/O/g, "0")
      .replace(/[^0-9A-HJKMNP-TV-Z]/g, "");
  }
  function encode(bytes) {
    var bits = 0, n = 0, out = "", i;
    for (i = 0; i < bytes.length; i++) {
      n = (n << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        out += ALPHA[(n >> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits) out += ALPHA[(n << (5 - bits)) & 31];
    return out;
  }
  function decode(str) {
    var s = normalize(str), bits = 0, n = 0, out = [], i, v;
    for (i = 0; i < s.length; i++) {
      v = ALPHA.indexOf(s.charAt(i));
      if (v < 0) continue;
      n = (n << 5) | v;
      bits += 5;
      if (bits >= 8) {
        out.push((n >> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return new Uint8Array(out);
  }
  function formatCode(id, keyChars) {
    var raw = normalize(id) + normalize(keyChars);
    var parts = [];
    for (var i = 0; i < raw.length; i += 4) parts.push(raw.slice(i, i + 4));
    return parts.join("-");
  }
  function parseCode(input) {
    var raw = normalize(input);
    if (raw.length !== ID_LEN + KEY_CHARS) return null;
    return { id: raw.slice(0, ID_LEN), keyChars: raw.slice(ID_LEN) };
  }
  function b64(bytes) {
    var s = "", i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function fromB64(str) {
    var s = atob(str), out = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function aesKey(bytes) {
    return root.crypto.subtle.digest("SHA-256", bytes).then(function (hash) {
      return root.crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
    });
  }
  function encrypt(obj, keyBytes) {
    var iv = root.crypto.getRandomValues(new Uint8Array(12));
    var pt = new TextEncoder().encode(JSON.stringify(obj));
    return aesKey(keyBytes).then(function (key) {
      return root.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, pt);
    }).then(function (buf) {
      var ct = new Uint8Array(buf);
      var all = new Uint8Array(iv.length + ct.length);
      all.set(iv, 0);
      all.set(ct, 12);
      return b64(all);
    });
  }
  function decrypt(blob, keyBytes) {
    var all = fromB64(blob);
    if (all.length < 29) return Promise.reject(new Error("That code didn’t contain a complete copy."));
    var iv = all.slice(0, 12);
    var ct = all.slice(12);
    return aesKey(keyBytes).then(function (key) {
      return root.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
    }).then(function (buf) {
      return JSON.parse(new TextDecoder().decode(buf));
    });
  }
  function api(path, body) {
    var url = backendUrl();
    if (!url) return Promise.reject(new Error("Copying to the Home Screen app isn’t switched on yet."));
    return fetch(url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || "That didn’t work. Please try again.");
        return j;
      }, function () { throw new Error("That didn’t work. Please try again."); });
    });
  }

  function createCode() {
    var S = root.AOStore;
    if (!S || !S.exportAll) return Promise.reject(new Error("Something didn’t load. Please refresh and try again."));
    var payload = S.exportAll();
    if (!payload.meta || !payload.meta.dashboards || !payload.meta.dashboards.length) {
      return Promise.reject(new Error("Set up a dashboard in Safari first, then create a code."));
    }
    var keyBytes = root.crypto.getRandomValues(new Uint8Array(KEY_BYTES));
    var keyChars = encode(keyBytes).slice(0, KEY_CHARS);
    return encrypt(payload, keyBytes).then(function (blob) {
      return api("/handoff", { blob: blob }).then(function (r) {
        if (!r || !r.id) throw new Error("That didn’t work. Please try again.");
        return { code: formatCode(r.id, keyChars), expiresIn: r.expiresIn || 600 };
      });
    });
  }

  function redeemCode(input) {
    var parsed = parseCode(input);
    if (!parsed) return Promise.reject(new Error("That code doesn’t look right. It should be 24 letters and numbers, in groups of four."));
    var S = root.AOStore;
    if (!S || !S.importAll) return Promise.reject(new Error("Something didn’t load. Please refresh and try again."));
    var keyBytes = decode(parsed.keyChars);
    if (keyBytes.length < KEY_BYTES) return Promise.reject(new Error("That code doesn’t look right. Check it and try again."));
    keyBytes = keyBytes.slice(0, KEY_BYTES);
    return api("/handoff/redeem", { id: parsed.id }).then(function (r) {
      if (!r || !r.blob) throw new Error("That code has expired or has already been used.");
      return decrypt(r.blob, keyBytes);
    }).then(function (payload) {
      S.importAll(payload);
    });
  }

  root.AOHandoff = {
    isStandalone: isStandalone,
    formatCode: formatCode,
    parseCode: parseCode,
    normalize: normalize,
    createCode: createCode,
    redeemCode: redeemCode,
    encrypt: encrypt,
    decrypt: decrypt
  };
})(window);
