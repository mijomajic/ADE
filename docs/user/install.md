# Install ADE

ADE runs coding agents on your computer and lets you work through its desktop
or web interface. Set up the machine where your agents will run first.

## Run from source

Install Node.js 24 and pnpm 11.10.0, then run:

```sh
git clone https://github.com/mijomajic/ADE.git
cd ADE
pnpm install --frozen-lockfile
pnpm run ade:dev
```

Open the pairing link printed in the startup log. Development data stays in
this checkout's `.ade` directory. Keep the terminal running while you use ADE.

For the Electron development app, use `pnpm run ade:desktop` instead. Build its
native helpers with the platform prerequisites in the
[development guide](../operations/development.md#desktop-artifacts).

You can open ADE before installing a provider. Configure one in
**Settings → Providers** before sending your first agent message.

## Desktop app

ADE's installers are built from this repository. To build a macOS Apple Silicon
installer after installing the prerequisites:

```sh
pnpm run dist:desktop:dmg:arm64
```

The installer is written under `release/`. Open the DMG, copy **ADE (Alpha)** to
Applications, and launch it. Local builds are not notarized unless you configure
your own signing credentials. Windows and Linux build commands are in the
[development guide](../operations/development.md#desktop-artifacts).

This fork does not currently publish releases or package-manager packages.
T3 Code's Homebrew, winget, npm package, and install scripts install T3 Code.
Use this checkout or an ADE installer built from it.

Installed ADE keeps its data under `~/.ade` and uses a separate desktop profile.
It does not import T3 Code's saved threads or settings. An explicit `T3CODE_HOME`
or server `--base-dir` can select a different data directory.

### Windows Subsystem for Linux

In a Windows desktop build with the bundled WSL runtime, choose a distro in
**Settings → Connections** to run agents and projects there. Install provider
CLIs inside that distro. Its ADE runtime is separate from a T3 Code install.

## Command line

After building the server, run it from this checkout:

```sh
pnpm run build:desktop
node apps/server/dist/bin.mjs serve
```

Run `node apps/server/dist/bin.mjs --help` for supported commands. Source builds
are updated with Git and a rebuild; they are not npm installations.

A packaged ADE CLI uses the `ade` command. The repository's install scripts and
`ade update` target ADE releases, which must be published before those paths can
be used. The standalone CLI's background service is described in
[Running ADE in the background](./background-service.md).

## Connect another device

On the computer with your code, open **Settings → Connections**, enable network
access or Tailscale HTTPS, then choose **Create link**. Open the pairing link in
the other device's browser, or paste it into ADE's pairing form. Keep ADE running
on the host computer.

The responsive web interface works on phones. This fork does not distribute an
ADE native mobile app. The inherited mobile source and T3 Connect integration
require their own build and service configuration.

## Providers

Open **Settings → Providers** in the web or desktop app, select the environment,
and enable the provider you want. Installation, login, and configuration belong
to that environment's machine, even when you connect from a phone or another
computer.

| Provider    | Install and authenticate                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- |
| Codex       | Install [Codex CLI](https://developers.openai.com/codex/cli), then run `codex login`.        |
| Claude      | Install [Claude Code](https://claude.com/product/claude-code), then run `claude auth login`. |
| Cursor      | Install [Cursor CLI](https://cursor.com/cli), then run `agent login`.                        |
| Grok Build  | Install [Grok Build CLI](https://x.ai/cli), then run `grok login`.                           |
| OpenCode    | Install [OpenCode](https://opencode.ai), then run `opencode auth login`.                     |
| Antigravity | Install and sign in with Google from ADE's provider settings.                                |

Provider CLIs must be on the server's `PATH`. If ADE cannot find one, set its
**Binary path** in provider settings, especially when using a version manager.
Cursor's executable is `cursor-agent`, although its login command is
`agent login`. Antigravity can use its managed runtime without a `PATH` entry.

ADE warns when a provider version has known compatibility problems with your
release. Check **Settings → Providers** on that environment for the recommended
version or range. When its package manager supports installing a specific version,
you can install the recommendation there. Otherwise use the provider's installer
on the environment's machine. An unlisted version is unverified.

When a provider CLI is behind its latest release, its provider card shows the
available version. **Update now** appears only when ADE can tell which
installer owns the CLI (its own update command, Homebrew, or a global npm, pnpm,
bun, or Vite+ install) and runs that installer. Otherwise update the CLI the same
way you installed it. Homebrew installs compare against the version Homebrew
offers, which can trail the npm release by a few hours.

Add another provider instance for a separate account or configuration. Each
instance can have its own environment variables, such as API keys or a custom
base URL. Mark secret values as sensitive; after saving, ADE does not display
their original values.

For provider-specific setup and accounts, see [Codex](./providers-codex.md),
[Claude](./providers-claude.md), [OpenCode](./providers-opencode.md), and
[Antigravity](./providers-antigravity.md).

## Next steps

- [Working with threads](./thread-sidebar.md): start tasks and organize parallel work.
- [Permission modes](./permission-modes.md): choose when agents ask before acting.
- [Remote access](./remote-access.md): connection modes inherited from T3 Code.
- [Updating ADE](./updating.md): update your checkout and desktop app.
