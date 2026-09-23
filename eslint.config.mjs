// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // The shared release library, copied byte for byte from the ops
    // repository (see .github/release/). Nobody edits a copy, so it does
    // not answer to this project's style either.
    ignores: ['.github/**']
  },
  {
    rules: {
      'vue/no-multiple-template-root': 'off',
      'vue/max-attributes-per-line': ['error', { singleline: 3 }]
    }
  }
)
