# 🤖 Set it up with an agent

The five console steps in the README can also be handled by an agent. Paste
the prompt into an MCP client connected to the Fleetless central endpoint,
`https://mcp.fleetless.dev`, signed in as a Fleetless user of your
organisation — Claude, Cursor, Claude Code, anything that speaks MCP. The
agent asks you seven things once, an eighth only if there is no role `operate`,
and does the rest.

It needs from you: an app name and identifier, the origin the starter runs on
(`http://localhost:3000` until you deploy it), which robots to attach, the
email address of the first app user, whether that person gets the invitation
by mail or as a link you pass on, and whether mailed links should open in the
starter rather than on Fleetless's hosted pages (not until it runs somewhere
the people you invite can reach).

It cannot choose a password — the invitation is where the person sets one,
when the app signs in by password — and it cannot publish a robot that
exposes nothing. A robot whose configuration has no datapoints, actions,
services, publishers or cameras is attached and named in the report.

The first user holds the organisation role `operate`, which every organisation
starts with. What that role reaches follows each robot's `fleetless.yaml` and
the organisation's defaults, so the agent grants nothing per robot; if the
role is gone, it asks which role key to use instead.

## The prompt

```text
You are setting up a Fleetless app for the app-starter template using the Fleetless MCP tools on the central endpoint. Call docs with action describe before the first use of each action to read its exact inputs and conditions. Work through the steps in order, call the tools rather than describing them, ask me only the questions in step 1 and the role question in step 4, and invent no values. If a tool refuses, stop, quote the code and the sentence it returned, and ask me how to continue.

1. Ask me for, in one message:
   (a) the app name;
   (b) the app identifier — lowercase letters, digits and underscores, starting with a letter;
   (c) the origin the app runs on, default http://localhost:3000;
   (d) which robots to attach — call console_robots_read with action list first and show me their names;
   (e) the email address of the first app user;
   (f) whether Fleetless should mail the invitation, or hand me the link;
   (g) whether mailed links and the MCP sign-in should open in this app instead of on Fleetless's hosted pages — default no; yes only once the app runs at an origin the people I invite can reach.

2. Create the app with console_apps_write, action create: name, identifier and the chosen robot_ids. Keep the app id.

3. Read the auth configuration with console_apps_read, action auth_config, to see the current self_registration, allowed_domains and app_url. Then write each slice with console_apps_write, carrying every field that slice takes:
   - action set_registration: self_registration and allowed_domains exactly as read, allowed_origins set to the origin from (c), bare — scheme, host and port, no path, no trailing slash
   - action set_mcp: mcp_enabled true
   - only if I said yes in (g), action set_urls: app_url exactly as read, invite_url <origin>/auth/invite/{token}, verify_url <origin>/auth/verify/{token}, reset_url <origin>/auth/reset/{token}, mcp_login_url <origin>/mcp/{interaction}; otherwise leave the URLs unset, and Fleetless's hosted pages answer those links

4. Use the organization role with the key operate. Call console_roles_read with action list. If no role has the key operate, stop and ask me which role key the first user should hold, and use that key wherever the steps below say operate. Under the organization's defaults, operate reaches the datapoints, cameras, assets, services, actions, publishers and job history of every attached robot unless a robot's fleetless.yaml asks for a stricter role, and it holds observe by inheritance.

5. Make that role the app's default: call console_apps_read with action access for the app, then console_apps_write with action set_access, default_role set to that key, and locked_kinds and locked exactly as access returned them.

6. Invite the first user with console_app_users_write, action invite: the email from (e), role set to that key, send_mail true if I chose mail in (f), otherwise false.

7. Report, and nothing else:
   - the line for .env: NUXT_PUBLIC_APP_IDENTIFIER=<identifier>
   - the invitation: "mailed to <email>", or the accept_url exactly as returned
   - whether the mailed links open in this app or on Fleetless's hosted pages
   - for every attached robot, what that role reaches (console_roles_read, action effective_rights, with the app id and the role), and any robot that exposes nothing
   - anything that was refused, with the code and the sentence
```

## What you do afterwards

Put the `.env` line into `.env`, start the app (`pnpm dev`), open the
invitation link. It opens Fleetless's hosted page, or the starter's own when
you said so in (g). Accept it, then sign in here.

The robot appears; click it. Everything the prompt set is visible and
editable in the [Fleetless Console](https://console.fleetless.dev), under the
app it created.
