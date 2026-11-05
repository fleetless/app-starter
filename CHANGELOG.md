# Changelog

What changed in the template. A copy made with "Use this template" keeps
none of this repository's history, so this file and the release tags are
how you find what changed since you copied, and what to port. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the
versions follow [semver](https://semver.org/spec/v2.0.0.html) over what a
copy has to change.

## [Unreleased]

### Added

- `collections.yaml`, the schema of the app's own data, with one collection: a
  logbook per robot. A Logbook tab on the robot page lists the entries newest
  first, follows them live and adds new ones, as far as the role's `access` in
  the file allows. The README's "Data: collections" explains how to publish it.
- Sentences for the refusals of a record write: `required_missing`,
  `record_changed`, and `plan_limit` when it is the collection data that is
  full.

## [1.4.0] — 2026-11-04

### Added

- Account › Security now shows the app's two-factor policy before setup or
  removal, including its required label. Invitations announce required setup
  before acceptance.

### Changed

- Policy reads that fail or omit a valid two-factor policy show Retry and
  withhold Security actions and invitation acceptance until a successful read.
  A refused read keeps its own sentence, such as a rate limit's wait. The
  sign-in form does not need the policy and keeps working without one.
- The SDK dependency is pinned to 4.6.0 for `SignInMethods.twoFactor`.
- `AGENT-SETUP.md` now calls the bundled MCP tools with explicit actions and
  looks up each action's exact inputs with `docs.describe` before using it.
- `sdk-bump.yml` pins an `@fleetless/sdk` version only once it is promoted
  to production, never a release still on npm's `staging` dist-tag alone
  (spec 2026-10-06-staging-environment §9.6). It now runs on the
  `sdk-promoted` dispatch from `fleetless/fleetless promote.yml`, not on
  sdk's own release; `scripts/promoted.mjs` is the gate.

## [1.3.0] — 2026-10-05

### Added

- A 3D tab on the robot page renders the robot's synced URDF, its textures
  and `.dae`-embedded images included, with `assets.prepareUrdfScene`. It
  moves the joints from a `joint_states` datapoint when the role grants it.
  `three` and `urdf-loader` are pinned exactly.

## [1.2.0] — 2026-10-04

### Added

- A sentence for `plan_limit`, "This app has no room for another user on its plan.", on the OIDC callback and on registration, where the organisation's plan is full. `quota_exceeded` keeps "This app has reached its user limit." for the protection ceiling.

### Changed

- `@fleetless/sdk` 4.4.0, which recognises `plan_limit` from a federated sign-in.

## [1.1.0] — 2026-10-02

### Added

- Sign-in by emailed code, beside or instead of the password, as the app's Sign-in page says.
- Two-factor: the challenge and recovery code at sign-in, the setup an app can require, and Account › Security to turn it on or off.
- The invitation asks for no password when the app signs in by email code only.

### Changed

- `@fleetless/sdk` 4.3.0. Every sign-in step answers a result that can ask for a second factor; the token pages follow it.
- The URL step in the README and AGENT-SETUP.md is optional: Fleetless's hosted pages answer mailed links and the MCP sign-in until the starter runs somewhere reachable.

## [1.0.0] — 2026-09-24

### Added

- This changelog and releases: the template is versioned from 1.0.0 on.
