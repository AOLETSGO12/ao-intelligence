// A tiny in-process IMAP server used only by the tests.
import net from "node:net";

export function startFakeImap({ user = "me@example.com", pass = "app-pass", messages, supportsPlain = true } = {}) {
  const state = { appended: [], logins: 0 };
  const server = net.createServer((sock) => {
    sock.write("* OK fake imap ready\r\n");
    let buf = Buffer.alloc(0), pendingAppend = null;
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (pendingAppend) {
          if (buf.length < pendingAppend.size + 2) return;
          state.appended.push({ folder: pendingAppend.folder, message: buf.subarray(0, pendingAppend.size).toString("utf8") });
          buf = buf.subarray(pendingAppend.size + 2);
          sock.write(`${pendingAppend.tag} OK APPEND completed\r\n`);
          pendingAppend = null;
          continue;
        }
        const i = buf.indexOf("\r\n");
        if (i < 0) return;
        const line = buf.subarray(0, i).toString("utf8");
        buf = buf.subarray(i + 2);
        if (state.awaitingPlain) {
          const { tag } = state.awaitingPlain; state.awaitingPlain = null;
          const [, u, p] = Buffer.from(line, "base64").toString("utf8").split("\0");
          if (u === user && p === pass) { state.logins++; sock.write(`${tag} OK authenticated\r\n`); } else sock.write(`${tag} NO [AUTHENTICATIONFAILED] bad credentials\r\n`);
          continue;
        }
        const [tag, cmd, ...rest] = line.split(" ");
        const arg = rest.join(" ");
        if (cmd === "AUTHENTICATE") {
          if (!supportsPlain) { sock.write(`${tag} NO unsupported\r\n`); continue; }
          state.awaitingPlain = { tag }; sock.write("+ \r\n");
        } else if (cmd === "LOGIN") {
          const m = arg.match(/^"((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)"$/);
          if (m && m[1] === user && m[2] === pass) { state.logins++; sock.write(`${tag} OK logged in\r\n`); } else sock.write(`${tag} NO bad credentials\r\n`);
        } else if (cmd === "EXAMINE" || cmd === "SELECT") {
          sock.write(`* ${messages.length} EXISTS\r\n${tag} OK [READ-ONLY] done\r\n`);
        } else if (cmd === "UID" && /^SEARCH/.test(arg)) {
          sock.write(`* SEARCH ${messages.map((m) => m.uid).join(" ")}\r\n${tag} OK search done\r\n`);
        } else if (cmd === "UID" && /^FETCH/.test(arg)) {
          const ids = arg.split(" ")[1].split(",").map(Number);
          messages.filter((m) => ids.includes(m.uid)).forEach((m, idx) => {
            const h = Buffer.from(m.headers, "utf8"), b = Buffer.from(m.body, "utf8");
            sock.write(`* ${idx + 1} FETCH (UID ${m.uid} FLAGS (${m.flags || ""}) INTERNALDATE "${m.date}" BODY[HEADER.FIELDS (FROM REPLY-TO SUBJECT)] {${h.length}}\r\n`);
            sock.write(h); sock.write(` BODY[TEXT]<0> {${b.length}}\r\n`); sock.write(b); sock.write(")\r\n");
          });
          sock.write(`${tag} OK fetch done\r\n`);
        } else if (cmd === "LIST") {
          sock.write(`* LIST (\\HasNoChildren) "/" "INBOX"\r\n* LIST (\\HasNoChildren \\Drafts) "/" "Entwürfe"\r\n${tag} OK list done\r\n`);
        } else if (cmd === "APPEND") {
          const m = arg.match(/^"((?:[^"\\]|\\.)*)" .*\{(\d+)\}$/);
          pendingAppend = { tag, folder: m[1], size: parseInt(m[2], 10) };
          sock.write("+ Ready for literal data\r\n");
        } else if (cmd === "LOGOUT") { sock.write(`* BYE\r\n${tag} OK bye\r\n`); sock.end(); }
        else sock.write(`${tag} BAD unknown\r\n`);
      }
    });
    sock.on("error", () => {});
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, state, close: () => server.close() })));
}

export function nodeSocket(port) {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, "127.0.0.1");
    const queue = []; let wake = null, ended = false;
    s.on("data", (d) => { queue.push(new Uint8Array(d)); if (wake) { wake(); wake = null; } });
    s.on("end", () => { ended = true; if (wake) { wake(); wake = null; } });
    s.on("error", reject);
    s.on("connect", () => resolve({
      read: () => new Promise((res) => { const go = () => (queue.length ? res(queue.shift()) : ended ? res(null) : (wake = go)); go(); }),
      write: (u8) => new Promise((r) => s.write(Buffer.from(u8), r)),
      close: () => s.destroy(),
    }));
  });
}
