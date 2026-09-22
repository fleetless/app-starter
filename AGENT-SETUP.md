# 🤖 Set it up with an agent

The five console steps in the README are also eleven tool calls, one more per
extra robot. Paste the prompt below into an MCP client connected to the
Fleetless central endpoint, `https://mcp.fleetless.dev`, signed in as a
Fleetless user of your organisation — Claude, Cursor, Claude Code, anything
that speaks MCP. The agent asks you six things once and does the rest.

It needs from you: an app name and identifier, the origin the starter runs on
(`http://localhost:3000` until you deploy it), which robots to attach, the
email address of the first app user, and whether that person gets the
invitation by mail or as a link you pass on.

It cannot choose a password — the invitation link is where the person sets
one — and it cannot publish a robot that exposes nothing. A robot whose
configuration has no datapoints, actions, services, publishers or cameras is
attached, granted nothing, and named in the report.

## The prompt

```text
You are setting up a Fleetless app for the app-starter template using the Fleetless MCP tools on the central endpoint. Work through the steps in order, call the tools rather than describing them, ask me only the questions in step 1, and invent no values. If a tool refuses, stop, quote the code and the sentence it returned, and ask me how to continue.

1. Ask me for, in one message:
   (a) the app name;
   (b) the app identifier — lowercase letters, digits and underscores, starting with a letter;
   (c) the origin the app runs on, default http://localhost:3000;
   (d) which robots to attach — call console_robots_list first and show me their names;
   (e) the email address of the first app user;
   (f) whether Fleetless should mail the invitation, or hand me the link.

2. Create the app with console_app_create: name, identifier and the chosen robot_ids. Keep the app id.

3. Read the auth configuration with console_app_auth_config_get, to see the current self_registration and allowed_domains. Then write each slice, carrying every field that slice takes:
   - console_app_auth_config_registration_put: self_registration and allowed_domains exactly as read, allowed_origins set to the origin from (c), bare — scheme, host and port, no path, no trailing slash
   - console_app_auth_config_urls_put: verify_url <origin>/auth/verify/{token}, reset_url <origin>/auth/reset/{token}, invite_url <origin>/auth/invite/{token}
   - console_app_auth_config_mcp_put: mcp_login_url <origin>/mcp/{interaction}, mcp_enabled true

4. Create a role named "Operator" with console_role_create and keep its id. For every attached robot call console_robot_exposures and collect its slugs. Then call console_role_permissions_put once, with one grant per robot carrying all of that robot's slugs, and the capabilities action_history, presence and assets all true. A robot with no exposures gets no grant; note it for the report.

5. Make that role the app's default with console_app_update, default_role_id.

6. Invite the first user with console_app_user_invite: the email from (e), role_id of the Operator role, send_mail true if I chose mail in (f), otherwise false.

7. Report, and nothing else:
   - the line for .env: NUXT_PUBLIC_APP_IDENTIFIER=<identifier>
   - the invitation: "mailed to <email>", or the accept_url exactly as returned
   - every robot that was attached and what it was granted, and any robot that exposes nothing
   - anything that was refused, with the code and the sentence
```

## What you do afterwards

Put the `.env` line into `.env`, start the app (`pnpm dev`), open the
invitation link in the same browser, choose a password, sign in. The robot
appears; click it. Everything the prompt set is visible and editable in the
[Fleetless Console](https://console.fleetless.dev), under the app it created.
