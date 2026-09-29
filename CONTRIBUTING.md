# Contributing

## Developer Setup

See the [development runbook](docs/operations/development.md#first-checkout) for the initial checkout,
development commands, tests, and platform-specific desktop packaging prerequisites.

## Reporting ADE problems

ADE is an independent fork of [T3 Code](https://github.com/pingdotgg/t3code). Report
ADE problems in [this repository's issue tracker](https://github.com/mijomajic/ADE/issues)
when Issues are enabled. Include the ADE version and commit, how you launched it,
reproduction steps, and relevant logs with credentials and private paths removed.
`ade triage` can help prepare a report with your coding agent.

If Issues are disabled, keep the report locally until the ADE maintainer enables
them. Do not send fork-specific bugs or feature requests to the upstream T3 Code
tracker or Discussions. Upstream reports can be linked as supporting evidence for
shared code, but they are not ADE support channels.

## Read This First

We are not actively accepting contributions right now.

You can still report a bug or open a PR, but please do so knowing there is a high chance we close it, defer it forever, or never look at it.

Feature requests and proposals need agreement from the ADE maintainer before implementation. This fork has no dedicated public Discussions channel.

If that sounds annoying, that is because it is. This project is still early and we are trying to keep scope, quality, and direction under control.

PRs are automatically labeled with a `vouch:*` trust status and a `size:*` diff size based on changed lines.

If you are an external contributor, expect `vouch:unvouched` until we explicitly add you to [.github/VOUCHED.td](.github/VOUCHED.td).

## What We Are Most Likely To Accept

Small, focused bug fixes.

Small reliability fixes.

Small performance improvements.

Tightly scoped maintenance work that clearly improves the project without changing its direction.

## What We Are Least Likely To Accept

Large PRs.

Drive-by feature work.

Opinionated rewrites.

Anything that expands product scope without us asking for it first.

If you open a 1,000+ line PR full of new features, we will probably close it quickly and remember that you ignored the clearly written instructions.

## If You Still Want To Open A PR

Keep it small.

Explain exactly what changed.

Explain exactly why the change should exist.

Follow the [documentation rules](AGENTS.md#documentation). Keep internal docs for decisions and
hard-to-discover constraints. Update user guides when how to use a feature changes; skip descriptions
of obvious controls and cosmetic changes.

Do not mix unrelated fixes together.

If the PR makes anything resembling a UI change, include clear before/after images.

If the change depends on motion, timing, transitions, or interaction details, include a short video.

If we have to guess what changed, we are much less likely to review it.

## Discuss Changes First

If you are thinking about a non-trivial change, agree on its scope with the ADE maintainer first. Issues are reserved for bug reports.

That still does not mean we will want the PR, but it gives you a chance to avoid wasting your time.

## Be Realistic

Opening a PR does not create an obligation on our side.

We may close it. We may ignore it. We may ask you to shrink it. We may reimplement the idea ourselves later.

If you are fine with that, proceed.
