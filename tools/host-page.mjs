// Packs a build's web folder for the private play pages. It is hosting, the same for both builds, and
// counts for neither. The play pages' host wants one page file with no <html>, <head> or <body> tags
// of its own, and takes no file over 15 MB. So this:
//   - lifts the build's own index.html into that one page, unchanged apart from the tags the host adds itself,
//   - gzips any file over 14 MB and adds a few lines that unpack it in the browser when the game asks for it,
//   - lists the files to publish beside the page.
//
//   node tools/host-page.mjs <web folder> <out folder> "<page title>"
//
// Out: play.html, files/ and files.json in the out folder, plus index.html, a stand-in for the host's
// wrapper, so the packed page can be checked locally with tools/check-web.cjs.
import fs from "fs";
import path from "path";
import zlib from "zlib";

const [web, out, title] = [path.resolve(process.argv[2]), path.resolve(process.argv[3]), process.argv[4] || "Play page"];
const LIMIT = 14 * 1024 * 1024;
const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".png": "image/png", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".txt": "text/plain" };

const html = fs.readFileSync(path.join(web, "index.html"), "utf8");
const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ""])[1]
  .replace(/<meta[^>]*charset[^>]*>/gi, "").replace(/<meta[^>]*name=["']viewport["'][^>]*>/gi, "").replace(/<title>[\s\S]*?<\/title>/gi, "");
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [, html])[1];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "files"), { recursive: true });
const packed = {}, files = {};
const walk = (dir, rel = "") => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
  const r = rel ? rel + "/" + e.name : e.name;
  if (e.isDirectory()) return walk(path.join(dir, e.name), r);
  if (r === "index.html" || e.name.startsWith(".")) return;
  const data = fs.readFileSync(path.join(dir, e.name)), ext = path.extname(e.name).toLowerCase();
  fs.mkdirSync(path.dirname(path.join(out, "files", r)), { recursive: true });
  if (data.length > LIMIT) {
    const gz = zlib.gzipSync(data, { level: 9 });
    if (gz.length > 15 * 1024 * 1024) throw new Error(r + " is still over 15 MB gzipped");
    fs.writeFileSync(path.join(out, "files", r + ".gz"), gz);
    packed[e.name] = e.name + ".gz";
    files[r + ".gz"] = { from: "files/" + r + ".gz", contentType: "application/wasm", bytes: gz.length, plainBytes: data.length };
  } else {
    fs.writeFileSync(path.join(out, "files", r), data);
    // The host knows only common web types; anything else goes up as a plain binary type it takes.
    files[r] = { from: "files/" + r, contentType: TYPES[ext] || "application/wasm", bytes: data.length };
  }
});
walk(web);

// Unpacks a gzipped file when the game asks for the plain one. A host that already unpacked it on the way
// is spotted by the first two bytes.
const shim = `<script>
(function () {
  var PACKED = ${JSON.stringify(packed)}, real = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.href ? input.href : input && input.url ? input.url : String(input);
    var name = url.split("#")[0].split("?")[0].split("/").pop();
    if (!PACKED[name]) return real(input, init);
    return real(url.replace(name, PACKED[name]), init).then(function (r) {
      if (!r.ok) return r;
      return r.arrayBuffer().then(function (buf) {
        var b = new Uint8Array(buf), gz = b[0] === 0x1f && b[1] === 0x8b, stream = new Blob([buf]).stream();
        return new Response(gz ? stream.pipeThrough(new DecompressionStream("gzip")) : stream, { status: 200, headers: { "Content-Type": "application/wasm" } });
      });
    });
  };
})();
</script>`;

const page = `<title>${title.replace(/</g, "&lt;")}</title>
<style>:root { color-scheme: dark; } html, body { height: 100%; }</style>
${head.trim()}
${Object.keys(packed).length ? shim : ""}
${body.trim()}
`;
fs.writeFileSync(path.join(out, "play.html"), page);
fs.writeFileSync(path.join(out, "files.json"), JSON.stringify(files, null, 2) + "\n");
// A stand-in for the host's own wrapper, for checking the packed page locally.
fs.writeFileSync(path.join(out, "files", "index.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0;font:14px system-ui}</style></head><body>${page}</body></html>`);
const total = Object.values(files).reduce((n, f) => n + f.bytes, 0) + Buffer.byteLength(page);
console.log(JSON.stringify({ page: path.join(out, "play.html"), pageBytes: Buffer.byteLength(page), files: Object.keys(files).length, downloadBytes: total, packed }, null, 2));
