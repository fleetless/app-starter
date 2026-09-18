# Security policy

## Reporting a vulnerability

Email **security@fleetless.dev**. Please do not open a public GitHub issue for
a security report.

Include what you found, the browser or Node version it happens on, and the
smallest sequence of steps that shows it. A reproduction against a fresh
`pnpm install` of this template is the most useful thing you can send.

We acknowledge every report within **3 working days** and follow up with
either a fix or a written plan within **30 days**. If a report leads to a
released fix, we credit you by name unless you ask us not to.

## What is in scope

This repository is a template app for **the app starter** — a Nuxt
application that runs in your users' browsers and holds credentials while it
does. That is its security surface.

Specifically in scope:

### The token store

`app/plugins/fleetless.client.ts` hands the SDK a `TokenStore` backed by
`localStorage`, keyed under `fleetless-session`. A report is in scope if the
store:

- writes a token somewhere other than that one key — a global, a URL, a
  log line, an error message;
- fails to clear itself when the SDK asks it to (a `save(null)` after
  sign-out or a spent refresh token);
- can be made to load or save a session that was not the SDK's to give it.

### The OIDC state and verifier in `sessionStorage`

`app/utils/oidc.ts` remembers the PKCE verifier and the `state` value between
`beginOidcLogin` and the redirect back, under the key `fleetless-oidc`, and
`useOidcReturn` (`app/composables/useOidcReturn.ts`) consumes them exactly
once — `takeOidc()` removes the entry before the exchange runs, so a replayed
callback URL finds nothing to replay against. The destination to return to
rides along under the same key and is guarded on the way out.

In scope: a path that reads or exchanges the remembered pair more than once;
a path that reaches `completeOidcLogin` without `takeOidc()` having run first;
`expectedState` or `codeVerifier` falling back to something other than an
empty string, which is what makes two absent values fail to compare equal.

### The `next` redirect

`app/middleware/auth.global.ts` and `app/pages/auth/login.vue` pass the page a
visitor was on through `?next=` and return there after sign-in; a provider
sign-in carries it through `sessionStorage` rather than the redirect URI,
which the provider matches exactly. The check is `safeNext()` in
`app/utils/routes.ts`, and it accepts only a path starting with a single `/` —
no `//host` and no `/\host`, whitespace between the separators included, all
of which a browser can read as a different origin. It runs on the query
parameter and again on what comes back out of the store. A report is in scope
if any value reaches `navigateTo()` from this parameter without passing that
check, or if the check itself accepts a value it should not.

## What is not in scope

**`@fleetless/sdk` is not in this repository.** Its token handling, its OIDC
exchange, its request construction and its realtime channel have their own
policy in that package's `SECURITY.md`; report an issue there to
<security@fleetless.dev> the same way and say which package you were looking
at.

**The Fleetless cloud is not in this repository either.** A server that fails
to enforce a permission, an authentication or authorisation flaw in the
platform, a rate limit, a data leak from an API endpoint — none of that lives
here and none of it can be fixed by a change to this template. Report it to
the same address; we will route it.

Also out of scope here: the Fleetless console, the robot-side bridge, the
`@fleetless/contracts` schemas, and the documentation site.

Out of scope for any app built from this template: how a downstream fork
protects pages it added, or an XSS in code it wrote — an attacker who can run
script in the page can read anything the page can, and no template design
prevents that.

## Supported versions

This is a template, not a published package: an app is created by copying it
once and diverging from there. A fix here lands as a commit to this
repository; it reaches an existing app only when that app's maintainer pulls
it in. There is no version number to be behind.
