# Updating ADE

Update ADE from the same repository or installer you used to set it up. This
fork does not currently publish a desktop update feed or standalone CLI releases.
T3 Code's npm package and releases install the upstream application.

## Source checkout

Stop the development process you started, then run these commands in your ADE
checkout:

```sh
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm run ade:dev
```

Use `pnpm run ade:desktop` for the Electron development app. If Git reports local
changes or a diverged branch, preserve your changes and resolve that before
updating. A source server started from `apps/server/dist/bin.mjs` also needs
`pnpm run build:desktop` before restarting it.

## Packaged desktop app

Build a new ADE installer from the updated checkout, quit ADE, and replace the
installed application. Your data remains in `~/.ade`; do not delete it when
replacing the app. See [Install ADE](./install.md#desktop-app).

Automatic desktop updates are disabled until an ADE release feed is explicitly
configured. A future packaged CLI can use `ade update` once this repository has
matching releases.

## Connected environments

The interface and the server running your agents can be on different machines.
A version notice names the environment that needs updating. Use that machine's
original ADE installation method. Remote update controls are available only when
the server advertises support for them.

Restarting a server interrupts its connections and may interrupt agent turns and
terminal commands. Saved threads, settings, and project files remain.
**Settings → General → Continue threads after restarts** can resume supported
threads once ADE starts again; it does not enable automatic startup.

When connecting ADE to an existing T3 Code server, update that server through its
own installation. Client compatibility does not change which application owns
the server or its data.

## Provider updates

Agent CLI versions are separate from ADE's version. Check **Settings → Providers**
on the environment where the agents run. Use the provider's offered update action
or its original installer.
