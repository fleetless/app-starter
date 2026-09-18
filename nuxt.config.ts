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

  // A dev server reached by LAN address or DNS name fails Vite's host check
  // by default. `nuxt dev` only; a production build never reads this.
  vite: {
    server: {
      allowedHosts: true
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
