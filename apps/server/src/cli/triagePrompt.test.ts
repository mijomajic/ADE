// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { assert, it } from "@effect/vitest";

import {
  buildTriageContext,
  buildTriageLaunchPrompt,
  buildTriageSeedPrompt,
  TRIAGE_PLAYBOOK,
} from "./triagePrompt.ts";

it("stays byte-identical to .github/triage/PLAYBOOK.md", () => {
  // Old releases fetch the repo copy from `main` and follow it when it differs
  // from their bundled playbook. The two must say the same thing at HEAD, or a
  // playbook edit silently changes behavior only for old (or only for new)
  // installs. Edit both files together.
  const canonicalPath = NodePath.join(
    import.meta.dirname,
    "../../../../.github/triage/PLAYBOOK.md",
  );
  assert.equal(TRIAGE_PLAYBOOK, NodeFS.readFileSync(canonicalPath, "utf8"));
});

it("seed prompt names the context file and embeds the playbook", () => {
  const prompt = buildTriageSeedPrompt("/tmp/triage-run/context.md");
  assert.include(prompt, "/tmp/triage-run/context.md");
  assert.include(prompt, TRIAGE_PLAYBOOK);
});

it("launch prompt stays a single argv-safe line naming the prompt file", () => {
  // The launch argument goes through cmd.exe on Windows (.cmd shims), which
  // cannot carry newlines; the playbook itself must stay on disk.
  const launch = buildTriageLaunchPrompt(String.raw`C:\Users\a b\.ade\userdata\triage\x\prompt.md`);
  assert.notInclude(launch, "\n");
  assert.include(launch, String.raw`C:\Users\a b\.ade\userdata\triage\x\prompt.md`);
  assert.isBelow(launch.length, 1_000);
});

it("context file carries every path the playbook depends on", () => {
  const context = buildTriageContext({
    generatedAt: "2026-08-13T00:00:00.000Z",
    version: "0.0.33",
    releaseTag: "v0.0.33",
    os: "linux x64 (7.0.0)",
    nodeVersion: "v24.0.0",
    launchedAs: "ade triage",
    server: "running (pid 42, http://127.0.0.1:4501)",
    paths: {
      stateDir: "/home/u/.ade/userdata",
      dbPath: "/home/u/.ade/userdata/state.sqlite",
      settingsPath: "/home/u/.ade/userdata/settings.json",
      logsDir: "/home/u/.ade/userdata/logs",
      serviceLogPath: "/home/u/.ade/userdata/logs/boot-service.log",
      desktopBackendLogGlob: "/home/u/.ade/userdata/logs/server-child*.log*",
      serverTracePath: "/home/u/.ade/userdata/logs/server.trace.ndjson",
      providerEventLogPath: "/home/u/.ade/userdata/logs/provider/events.log",
      terminalLogsDir: "/home/u/.ade/userdata/logs/terminals",
      providerStatusCacheDir: "/home/u/.ade/caches",
      secretsDir: "/home/u/.ade/userdata/secrets",
      sourceCacheDir: "/home/u/.ade/source",
    },
  });
  assert.include(context, "/home/u/.ade/userdata/state.sqlite");
  assert.include(context, "/home/u/.ade/userdata/logs/server.trace.ndjson");
  assert.include(context, "/home/u/.ade/userdata/logs/boot-service.log");
  assert.include(context, "/home/u/.ade/userdata/logs/server-child*.log*");
  assert.include(context, "/home/u/.ade/userdata/logs/provider/events.log");
  assert.include(context, "/home/u/.ade/userdata/secrets");
  assert.include(context, "/home/u/.ade/source");
  assert.include(context, "ade triage");
  assert.include(context, "v0.0.33");
  assert.include(context, "- Repo: https://github.com/mijomajic/ADE\n");
  assert.include(context, "- Upstream (reference only): https://github.com/pingdotgg/t3code");
});

it("directs diagnosis and reporting to ADE while retaining upstream attribution", () => {
  assert.include(
    TRIAGE_PLAYBOOK,
    "https://raw.githubusercontent.com/mijomajic/ADE/main/.github/triage/PLAYBOOK.md",
  );
  assert.include(TRIAGE_PLAYBOOK, "git clone --filter=blob:none https://github.com/mijomajic/ADE");
  assert.include(TRIAGE_PLAYBOOK, "https://github.com/mijomajic/ADE/issues/new");
  assert.include(TRIAGE_PLAYBOOK, "--repo mijomajic/ADE");
  assert.include(TRIAGE_PLAYBOOK, "fork of T3 Code (https://github.com/pingdotgg/t3code)");
  assert.notInclude(TRIAGE_PLAYBOOK, "https://github.com/pingdotgg/t3code/issues");
  assert.notInclude(TRIAGE_PLAYBOOK, "https://raw.githubusercontent.com/pingdotgg/t3code");
});

it("keeps public issue-template help links in the ADE repository", () => {
  for (const file of ["config.yml", "bug_report.yml", "via-triage.yml"]) {
    const template = NodeFS.readFileSync(
      NodePath.join(import.meta.dirname, "../../../../.github/ISSUE_TEMPLATE", file),
      "utf8",
    );
    const repositoryLinks = Array.from(
      template.matchAll(/https:\/\/github\.com\/([^/\s)]+\/[^/\s)]+)/g),
      (match) => match[1],
    );
    for (const repository of repositoryLinks) {
      assert.equal(repository, "mijomajic/ADE", `${file} links outside this fork`);
    }
    assert.notInclude(template, "npx t3", `${file} recommends an upstream package`);
  }
});
