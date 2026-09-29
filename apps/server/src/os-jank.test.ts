import * as NodeOS from "node:os";
import * as NodePathService from "@effect/platform-node/NodePath";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";

import { hydratePosixHome, resolveBaseDir } from "./os-jank.ts";

it.effect("keeps ADE's default state separate from T3 Code", () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    for (const input of [undefined, "", "  "]) {
      const resolved = yield* resolveBaseDir(input).pipe(Effect.provide(NodePathService.layer));
      assert.equal(resolved, path.join(NodeOS.homedir(), ".ade"));
    }
  }).pipe(Effect.provide(NodePathService.layer)),
);

it.effect("preserves an explicit server data directory", () =>
  Effect.gen(function* () {
    const resolved = yield* resolveBaseDir(" /custom/ade ").pipe(
      Effect.provide(NodePathService.layerPosix),
    );
    assert.equal(resolved, "/custom/ade");
  }),
);

it("hydrates HOME for minimal service environments from the user account", () => {
  const env: NodeJS.ProcessEnv = {};

  hydratePosixHome(env);

  assert.equal(env.HOME, NodeOS.userInfo().homedir);
});

it("hydrates HOME independently of a blank process HOME", () => {
  const originalHome = process.env.HOME;
  const env: NodeJS.ProcessEnv = { HOME: " " };

  try {
    process.env.HOME = " ";
    hydratePosixHome(env);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  }

  assert.equal(env.HOME, NodeOS.userInfo().homedir);
});

it("preserves an explicitly configured HOME", () => {
  const env: NodeJS.ProcessEnv = { HOME: "/custom/home" };

  hydratePosixHome(env, () => {
    throw new Error("HOME lookup should not run");
  });

  assert.equal(env.HOME, "/custom/home");
});
