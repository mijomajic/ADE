# ADE

An agent development environment built on [T3 Code](https://github.com/pingdotgg/t3code), with a focused, Vercel-inspired workspace.

ADE keeps T3 Code's real agent sessions, terminal, Git worktrees, diff review, provider accounts, and remote connections. It adds a workspace overview and a quieter, more readable interface for moving between projects.

## Run from source

Requires Node.js 24 and pnpm 11.10.0 (the version is pinned in `package.json`).

```sh
git clone https://github.com/mijomajic/ADE.git
cd ADE
pnpm install --frozen-lockfile
pnpm run ade:dev
```

The startup log prints the local address and a one-time pairing link. Open that link to connect, then add a project and configure an installed provider in **Settings → Providers**. You can use an authenticated Codex, Claude Code, Cursor, Grok Build, OpenCode, or Antigravity installation. ADE does not include a model subscription.

For the Electron development app:

```sh
pnpm run ade:desktop
```

Both commands keep development state in this checkout's ignored `.ade` directory. Installed ADE uses `~/.ade` and a separate Electron profile; it does not import or overwrite T3 Code's state. Internal package names and `T3CODE_*` configuration variables remain compatible with the upstream architecture. An explicit `T3CODE_HOME` or server `--base-dir` overrides the installed default.

## Your workspace

- **Overview:** projects, recent threads, live agent work, and requests needing your attention. Click the ADE wordmark or the overview icon to return home.
- **Find your work:** filter by thread title, project, or branch; narrow to working threads or requests needing attention. Archived threads stay out of the overview.
- **Start in the right project:** selecting a project in the sidebar also scopes New, its keyboard shortcut, and the command palette. Grouped projects preserve the selected machine when possible.
- **Safer drafts:** discarding a draft asks first and preserves text, uploads, and context when cancelled.
- **Readable by default:** locally bundled Geist fonts, neutral light and dark palettes, clearer message surfaces, and account initials that remain legible on custom accent colors.
- **Honest connection state:** disconnected environments show cached threads as offline instead of counting them as live agent work.

Provider setup and installation are documented in [the ADE install guide](docs/user/install.md). See [Updating ADE](docs/user/updating.md) when moving to a newer checkout or installer. Some inherited workflow guides still use T3 Code terminology.

## Building

```sh
# Web client
pnpm exec vp run --filter @t3tools/web build

# Desktop application and bundled server
pnpm run build:desktop

# macOS Apple Silicon artifact
pnpm run dist:desktop:dmg:arm64
```

Native distribution builds require the platform's packaging tools. Signing, notarization, and release publishing need your own credentials. ADE's updater targets this fork; it will not install T3 Code releases. Desktop update feeds stay disabled until an ADE feed is explicitly configured. The inherited native mobile app is not packaged or rebranded for ADE; use the responsive web client on mobile.

## Upstream and license

ADE is an independent personal fork, not an official T3 Tools or Vercel product. The application is MIT licensed; the [original T3 Tools copyright and license](LICENSE) are retained. Geist and Geist Mono are bundled under the [SIL Open Font License](apps/web/public/fonts/OFL.txt).

The improvements draw on public reports about [project-scoped creation](https://github.com/pingdotgg/t3code/issues/11895), [accidental draft deletion](https://github.com/pingdotgg/t3code/issues/12735), [provider badge contrast](https://github.com/pingdotgg/t3code/issues/11641), and [message separation](https://github.com/pingdotgg/t3code/discussions/8921). These are focused changes to this fork, not a claim that every upstream request is resolved.
