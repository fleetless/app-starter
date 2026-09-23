# Contributing to the Fleetless App Starter

This is a template, not a running service: what you improve here is what
every app built from it starts with.

## Setup

Node 22 and pnpm (through corepack):

```sh
nvm use 22
corepack enable
pnpm install
```

## The checks

```sh
pnpm lint && pnpm typecheck && pnpm test && node --test '.github/release/*.test.mjs' && pnpm build
```

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint over the project. |
| `pnpm typecheck` | Nuxt's typecheck, plus the `test/` project — a widened union in a fixture typechecks clean under the first alone. |
| `pnpm test` | The vitest suite. |
| `node --test '.github/release/*.test.mjs'` | The release logic's own tests. |
| `pnpm build` | The production build. |

## Pull requests

**CI runs on GitHub-hosted runners** (`ubuntu-latest`): this is a public
repository, and a pull request here is a stranger's code. `verify.yml` runs
these same commands on every push and every pull request, forks included.
Running them yourself first still saves you a round trip.

## Recording a change, and releasing

A pull request that changes what a new app starts with adds its entry
under `## [Unreleased]` in `CHANGELOG.md`. A release refuses an empty one:
the changelog is all a copy of this template has.

**Release** in the Actions tab (`release.yml`, on `main`) releases `main`.
The version comes from the Conventional Commits since the last tag. The run
opens a pull request that turns `Unreleased` into that version, merges it
once `verify` passes, tags the merge commit and publishes a GitHub release
with the notes. Nothing is deployed.

When `@fleetless/sdk` is released, a workflow here opens the pull request
that pins it (`sdk-bump.yml`). It is not merged by itself, because a major
can need code changes. Merge it once CI is green.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `refactor:`, `test:`.

Everything here is written in **English** — code, comments, commit messages,
documentation.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licence

MIT — see [LICENSE](LICENSE). A contribution is accepted under the same
licence as the rest of the repository.
