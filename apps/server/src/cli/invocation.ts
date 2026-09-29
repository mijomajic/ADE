import * as Effect from "effect/Effect";

import {
  HostProcessArguments,
  HostProcessExecutablePath,
  HostProcessIsExecutable,
  HostProcessPlatform,
} from "@t3tools/shared/hostProcess";

const quotePosixArgument = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;
const quotePowerShellArgument = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Reuse this fork's actual script instead of resolving the upstream npm package. */
export function formatCliCommand(input: {
  readonly subcommand: string;
  readonly entryPath: string;
  readonly executablePath: string;
  readonly isExecutable: boolean;
  readonly platform: NodeJS.Platform;
}): string | null {
  if (input.isExecutable) return `ade ${input.subcommand}`;
  if (!/\.(?:[cm]?js|[cm]?ts)$/i.test(input.entryPath) || !input.executablePath) return null;
  const args = [input.executablePath, input.entryPath, input.subcommand];
  if (input.platform === "win32") {
    // A copied command may enter cmd.exe or PowerShell. Encoding the literal
    // PowerShell invocation prevents either outer shell expanding path characters.
    const script = `& ${args.map(quotePowerShellArgument).join(" ")}`;
    return `powershell.exe -NoProfile -EncodedCommand ${Buffer.from(script, "utf16le").toString("base64")}`;
  }
  return args.map(quotePosixArgument).join(" ");
}

export const resolveCliCommand = (subcommand: string) =>
  Effect.gen(function* () {
    const processArguments = yield* HostProcessArguments;
    return formatCliCommand({
      subcommand,
      entryPath: processArguments[1] ?? "",
      executablePath: yield* HostProcessExecutablePath,
      isExecutable: yield* HostProcessIsExecutable,
      platform: yield* HostProcessPlatform,
    });
  });
