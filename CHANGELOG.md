# Changelog

What changed in the template. A copy made with "Use this template" keeps
none of this repository's history, so this file and the release tags are
how you find what changed since you copied, and what to port. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the
versions follow [semver](https://semver.org/spec/v2.0.0.html) over what a
copy has to change.

## [Unreleased]

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
