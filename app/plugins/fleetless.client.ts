import { createClient, type StoredSession, type TokenStore } from '@fleetless/sdk'

const STORAGE_KEY = 'fleetless-session'

/**
 * The SDK's default store is memory, which signs everybody out on reload.
 * localStorage keeps the session for this browser. A stolen access token
 * keeps working for up to fifteen minutes after sign-out — the SDK reference
 * says why — so a kiosk or a shared workstation wants a shorter-lived store.
 */
function localStorageTokenStore(): TokenStore {
  return {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as StoredSession) : null
      } catch {
        return null
      }
    },
    save(session) {
      try {
        if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
        else localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Storage refused (private mode, quota). The session lives for this page.
      }
    }
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const client = createClient({
    apiUrl: config.public.apiUrl,
    appIdentifier: config.public.appIdentifier,
    tokenStore: localStorageTokenStore()
  })
  return { provide: { fleetless: client } }
})
