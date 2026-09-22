# Fleetless App Starter

**Your robot, as an app. This is where the app starts.**

A template on [`@fleetless/sdk`](https://www.npmjs.com/package/@fleetless/sdk)
and the [Nuxt UI dashboard](https://github.com/nuxt-ui-templates/dashboard):
every screen an app user can reach, already built. Sign-in, registration,
verification, invitations, password reset, single sign-on, the MCP consent
screen; the robots the signed-in person reaches; and on each robot every
datapoint, action, service, publisher, camera, run history and asset their
role grants. Fleetless has no end-user UI of its own. This is yours.

What a screen shows is decided by the person's **role** in the [Fleetless
Console](https://console.fleetless.dev), re-read on every call. A role that
grants nothing sees a polite empty page; a role that grants everything sees
it all. The app does not decide, it draws.

## 🚀 Run it

Node 22 and pnpm (`corepack enable`).

```sh
pnpm install
cp .env.example .env      # fill in NUXT_PUBLIC_APP_IDENTIFIER
pnpm dev                  # http://localhost:3000
```

`NUXT_PUBLIC_API_URL` is the cloud the app talks to: `http://localhost:8080`
for a local dev stack, `https://api.fleetless.dev` for the real one.

Reaching the dev server by DNS name — a tunnel, a machine on the office
network — means listing that name in `NUXT_DEV_ALLOWED_HOSTS`. Vite refuses
a host header it was not told about, which is what stops a DNS-rebinding
attack on your dev server; localhost and plain IP addresses need no entry.

## 🧭 Set it up in the console

**Or let an agent do it.** [`AGENT-SETUP.md`](AGENT-SETUP.md) is a prompt to
paste into an MCP client connected to `https://mcp.fleetless.dev`; it performs
every step below and reports the `.env` line and the invitation. The steps
stay here for the person who wants to see each setting.

Five settings, in this order. Each names the refusal you see without it, so
you can tell a missing setting from a broken app.

1. **Create an app** on the Apps page. Its identifier goes into `.env` as
   `NUXT_PUBLIC_APP_IDENTIFIER`. (Without it: every call answers `not_found`.)
2. **Registration page.** `allowed_origins`: `http://localhost:3000`, a bare
   origin, no path, no trailing slash. (Without it: every call fails as a
   network error with no status and no body — the browser refuses the answer
   before your code sees it.) Then, on **App URLs** and **MCP**, the three
   token URLs and the MCP one, each pointing into this app:

   | Setting | Value |
   |---|---|
   | `verify_url` | `http://localhost:3000/auth/verify/{token}` |
   | `reset_url` | `http://localhost:3000/auth/reset/{token}` |
   | `invite_url` | `http://localhost:3000/auth/invite/{token}` |
   | `mcp_login_url` | `http://localhost:3000/mcp/{interaction}` (with `mcp_enabled` on) |

3. **Settings page.** `default_role_id`: the role a self-registered account
   gets. (Without it: registration answers `target_state_conflict`.)
4. **Roles page.** Tick datapoints, actions, services, publishers and cameras
   for the role, and the `action_history` and `assets` capabilities if the
   Activity and Assets tabs should exist. A new role grants nothing.
   (Without it: sign-in works and the robot list is empty.)
5. **Attach a robot** to the app on its page, and **create or invite an app
   user** on the Users page. That user's email and password sign in here. Your
   own console login will not: it is a Fleetless user, a different identity
   space.

Then sign in. The robot appears; click it.

## 🎨 Make it yours

- `app/app.config.ts` — the app's name, its description, the four brand
  files, the primary colour.
- `public/brand/` — four files, replaced in place; nothing reads them by
  another name. `icon-light.svg` and `logo-light.svg` are dark ink for a
  light ground; `icon-dark.svg` and `logo-dark.svg` are light ink for a dark
  one. The page picks by theme, because an `<img>` takes no colour from the
  document around it. The favicon is the dark-ground icon for both tab
  strips.
- Add a page under `app/pages/`; the auth guard covers it. Add a tab to the
  robot page by extending `tabsFor` in `app/utils/datasheet.ts`.

## 🗂️ What is where

| Path | What |
|---|---|
| `app/plugins/fleetless.client.ts` | The one SDK client, with a `localStorage` token store. |
| `app/composables/useSession.ts` | Who is signed in, and where an expired session goes. |
| `app/middleware/auth.global.ts` | Everything but `/auth/*` and `/mcp/*` needs a session. |
| `app/pages/auth/*` | Login, register, verify, forgot, reset, invite, the OIDC callback. |
| `app/pages/mcp/[interaction].vue` | The consent screen an AI tool sends its user to. |
| `app/pages/robots/*` | The list, and the robot page whose tabs come from the datasheet. |
| `app/components/robot/ParameterForm.vue` | A form from a datasheet's `input_schema`. |
| `app/utils/errors.ts` | Every refusal's one sentence. |

The SDK reference at [docs.fleetless.dev](https://docs.fleetless.dev/reference/sdk/)
is the reference for everything this app calls; [manage users and
roles](https://docs.fleetless.dev/concepts/manage-users-and-roles/) explains
the model and the refusals behind `app/pages/auth/*`.

## 🧪 Checks

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`pnpm generate` writes a static `dist/` any web server can serve; the cloud
is the only backend.

## 🔒 Reporting a security issue

Email **security@fleetless.dev** rather than opening a public issue. See
[SECURITY.md](SECURITY.md).

## 📜 Licence

MIT — see [LICENSE](LICENSE). Maintained by
[Dehne Robotik GmbH](https://dehne-robotik.de). Questions: hello@fleetless.dev.
