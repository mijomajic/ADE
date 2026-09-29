// @effect-diagnostics nodeBuiltinImport:off - Executes a harmless source fixture to verify copied shell commands.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { assert, it } from "@effect/vitest";
import { HostProcessExecutablePath, HostProcessPlatform } from "@t3tools/shared/hostProcess";
import { formatCliCommand } from "./invocation.ts";

const source = {
  subcommand: "serve",
  entryPath: "/repo with spaces/apps/server/src/bin.ts",
  executablePath: "/usr/local/bin/node",
  isExecutable: false,
  platform: "linux",
} as const;

it("uses the ADE launcher only for a packaged executable", () => {
  assert.equal(formatCliCommand({ ...source, isExecutable: true }), "ade serve");
  assert.equal(formatCliCommand({ ...source, entryPath: "" }), null);
  assert.equal(formatCliCommand({ ...source, entryPath: "serve" }), null);
});

it("never resolves source or inherited package cache paths through upstream npm", () => {
  for (const entryPath of [
    source.entryPath,
    "/repo/apps/server/dist/bin.mjs",
    "/home/user/.npm/_npx/cache/node_modules/t3/dist/bin.mjs",
  ]) {
    const command = formatCliCommand({ ...source, entryPath })!;
    assert.include(command, `'${entryPath}'`);
    assert.notMatch(command, /^(?:npx|bunx|pnpm|ade) /);
  }
});

it("preserves source paths containing spaces and shell metacharacters in a real POSIX shell", () => {
  if (HostProcessPlatform.defaultValue() === "win32") return;
  const directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "ade-invocation-"));
  try {
    const entryPath = NodePath.join(directory, "source 'quote' $HOME `literal` &;!.mjs");
    NodeFS.writeFileSync(
      entryPath,
      "process.stdout.write(JSON.stringify(process.argv.slice(1)));\n",
    );
    const command = formatCliCommand({
      ...source,
      executablePath: HostProcessExecutablePath.defaultValue(),
      entryPath,
    })!;
    const result = NodeChildProcess.execFileSync("sh", ["-c", command], { encoding: "utf8" });
    assert.deepEqual(JSON.parse(result), [entryPath, "serve"]);
  } finally {
    NodeFS.rmSync(directory, { recursive: true, force: true });
  }
});

it("keeps Windows shell metacharacters inside PowerShell literal arguments", () => {
  const command = formatCliCommand({
    ...source,
    platform: "win32",
    executablePath: String.raw`C:\Program Files\Node's $runtime\node.exe`,
    entryPath: String.raw`C:\Users\O'Brien\ADE %TEMP% & $(whoami)\bin.mjs`,
  })!;
  const prefix = "powershell.exe -NoProfile -EncodedCommand ";
  assert.isTrue(command.startsWith(prefix));
  assert.match(command.slice(prefix.length), /^[A-Za-z0-9+/=]+$/);
  assert.equal(
    Buffer.from(command.slice(prefix.length), "base64").toString("utf16le"),
    String.raw`& 'C:\Program Files\Node''s $runtime\node.exe' 'C:\Users\O''Brien\ADE %TEMP% & $(whoami)\bin.mjs' 'serve'`,
  );
});
