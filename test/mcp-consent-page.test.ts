import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import type { ClientMcpInteraction, McpConsentGrant } from '@fleetless/sdk'
import { fakeAuth } from './fake-auth'
import ConsentPage from '~/pages/mcp/[interaction].vue'
import ConnectionsPage from '~/pages/account/connections.vue'

/**
 * fleetless/fleetless#1218: a client may present the URL of its Client ID
 * Metadata Document. The consent page shows the domain that document came
 * from, where the answer goes, and warns when that is this computer; the
 * connections list shows the domain beside the unverified name.
 */
const fake = vi.hoisted(() => ({ auth: null as ReturnType<typeof fakeAuth> | null }))
mockNuxtImport('useFleetless', () => () => ({ auth: fake.auth }))
mockNuxtImport('useOidcReturn', () => async () => ({ problem: null }))

const INTERACTION: ClientMcpInteraction = {
  id: 'mcpint_1',
  app_id: '11111111-1111-4111-8111-111111111111',
  client_name: 'Claude',
  client_name_verified: false,
  client_id_host: 'claude.ai',
  redirect_uri_host: '127.0.0.1',
  redirect_uri_loopback: true,
  scopes: [],
  already_granted: false,
  expires_at: '2026-11-25T20:00:00.000Z'
}

async function consent(interaction: ClientMcpInteraction) {
  fake.auth!.mcpInteraction.mockResolvedValue(interaction as never)
  const { onSignedIn } = useSession()
  await onSignedIn()
  const page = await mountSuspended(ConsentPage, { route: '/mcp/mcpint_1' })
  await flushPromises()
  return page
}

describe('MCP consent', () => {
  beforeEach(() => {
    fake.auth = fakeAuth()
  })

  it('names the checked domain and the answer host, and warns for a loopback answer', async () => {
    const page = await consent(INTERACTION)
    expect(page.find('[data-test="mcp-origin"]').text()).toContain('Its domain is claude.ai, checked by fetching its metadata document.')
    expect(page.find('[data-test="mcp-origin"]').text()).toContain('The answer goes to 127.0.0.1.')
    expect(page.text()).toContain('This client receives the answer on this computer (127.0.0.1). Approve only if you started it here.')
  })

  it('shows no domain for a self-registered client and no warning for a web answer', async () => {
    const page = await consent({ ...INTERACTION, client_id_host: null, redirect_uri_host: 'app.example.com', redirect_uri_loopback: false })
    expect(page.find('[data-test="mcp-origin"]').text()).not.toContain('domain')
    expect(page.find('[data-test="mcp-origin"]').text()).toContain('The answer goes to app.example.com.')
    expect(page.find('[data-test="mcp-loopback"]').exists()).toBe(false)
  })
})

describe('Account › Connections', () => {
  beforeEach(() => {
    fake.auth = fakeAuth()
  })

  it('shows a metadata-document client\'s domain, and none for a self-registered one', async () => {
    const grants: McpConsentGrant[] = [
      { client_id: 'https://claude.ai/oauth/mcp.json', client_name: 'Claude', client_name_verified: false, client_id_host: 'claude.ai', granted_at: '2026-11-25T19:00:00.000Z' },
      { client_id: 'mcpdyn_abc', client_name: 'mcp-remote', client_name_verified: false, client_id_host: null, granted_at: '2026-11-25T18:00:00.000Z' }
    ]
    fake.auth!.listMcpGrants.mockResolvedValue(grants as never)
    const { onSignedIn } = useSession()
    await onSignedIn()
    const page = await mountSuspended(ConnectionsPage, { route: '/account/connections' })
    await flushPromises()
    const domains = page.findAll('[data-test="grant-domain"]').map(d => d.text())
    expect(domains).toEqual(['claude.ai'])
  })
})
