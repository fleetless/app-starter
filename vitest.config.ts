import { defineVitestConfig } from '@nuxt/test-utils/config'

// The `nuxt` environment gives tests the real runtime: auto-imports, runtime
// config and Nuxt UI components render as they do in the app.
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['test/**/*.test.ts']
  }
})
