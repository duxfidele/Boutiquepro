import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const tscBin = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "boutiquepro-tests-"));

function collectTestFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTestFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      results.push(full);
    }
  }
  return results.sort();
}

try {
  console.log("[Lot 5 Tests] Compilation TypeScript des modules réels & scénarios...");
  execFileSync(
    process.execPath,
    [tscBin, "-p", path.join(projectRoot, "tsconfig.test.json"), "--outDir", tmpOut],
    {
      cwd: projectRoot,
      stdio: "inherit",
    }
  );

  const registerHookPath = path.join(tmpOut, "register-paths.cjs");
  const srcOutRoot = path.join(tmpOut, "src");
  const repoNodeModules = path.join(projectRoot, "node_modules");

  fs.writeFileSync(
    registerHookPath,
    `
const Module = require("node:module");
const path = require("node:path");

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key-lot5";
process.env.BOUTIQUEPRO_PROJECT_ROOT = ${JSON.stringify(projectRoot)};

if (typeof globalThis.WebSocket === "undefined") {
  class StubWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url) {
      this.url = url;
      this.readyState = StubWebSocket.CLOSED;
      this.CONNECTING = 0;
      this.OPEN = 1;
      this.CLOSING = 2;
      this.CLOSED = 3;
      this.binaryType = "blob";
      this.bufferedAmount = 0;
      this.extensions = "";
      this.protocol = "";
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
    }
    send() {}
    close() {
      this.readyState = StubWebSocket.CLOSED;
    }
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  }
  globalThis.WebSocket = StubWebSocket;
}

const srcRoot = ${JSON.stringify(srcOutRoot)};
const extraNodeModules = ${JSON.stringify(repoNodeModules)};
const origResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    const mapped = path.join(srcRoot, request.slice(2));
    return origResolve.call(this, mapped, parent, isMain, options);
  }
  try {
    return origResolve.call(this, request, parent, isMain, options);
  } catch (err) {
    const nextOpts = Object.assign({}, options || {}, {
      paths: [...((options && options.paths) || []), extraNodeModules],
    });
    return origResolve.call(this, request, parent, isMain, nextOpts);
  }
};
`.trimStart(),
    "utf8"
  );

  const testFiles = collectTestFiles(path.join(tmpOut, "tests"));
  if (testFiles.length === 0) {
    console.error("[Lot 5 Tests] Aucun fichier *.test.js trouvé dans", tmpOut);
    process.exitCode = 1;
  } else {
    console.log(`[Lot 5 Tests] Exécution de ${testFiles.length} suites de tests...`);
    const run = spawnSync(
      process.execPath,
      ["--test", "--require", registerHookPath, ...testFiles],
      {
        cwd: projectRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key-lot5",
          BOUTIQUEPRO_PROJECT_ROOT: projectRoot,
        },
      }
    );
    process.exitCode = run.status ?? 1;
  }
} finally {
  fs.rmSync(tmpOut, { recursive: true, force: true });
}

