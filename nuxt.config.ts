// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/test-utils/module',
    '@vueuse/nuxt'
  ],

  // A single-page app on purpose. The session lives in the browser (the SDK's
  // token store), so a server could not render anything an app user sees;
  // without SSR there is no Nitro to run, and `nuxt generate` gives a `dist/`
  // any static host serves. The cloud is the backend.
  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // NUXT_PUBLIC_API_URL and NUXT_PUBLIC_APP_IDENTIFIER, see .env.example.
  runtimeConfig: {
    public: {
      apiUrl: 'http://localhost:8080',
      appIdentifier: ''
    }
  },

  compatibilityDate: '2026-06-30',

  // Vite answers localhost and any IP address on its own; a dev server
  // reached by DNS name needs that name listed, or the host check refuses it.
  // An empty list is Vite's own default, so nobody loses the DNS-rebinding
  // check by copying this template. `nuxt dev` only; a build never reads it.
  vite: {
    server: {
      allowedHosts: process.env.NUXT_DEV_ALLOWED_HOSTS?.split(',').map(s => s.trim()).filter(Boolean) ?? []
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // Every icon this app names is bundled at build time; none is fetched from
  // a CDN at runtime, so a CSP a developer writes does not have to allow one.
  icon: {
    fallbackToApi: false,
    clientBundle: {
      scan: {
        globInclude: ['**/*.{vue,jsx,tsx,ts,md,mdc,mdx,yml,yaml}']
      }
    }
  }
})
