export default defineAppConfig({
  // Rename here, replace the four files under public/brand/, pick a colour.
  starter: {
    name: 'Fleetless App',
    description: 'An app on Fleetless.',
    brand: {
      // An <img> cannot be recoloured by CSS, so each mark ships twice: the
      // light file is dark ink for a light ground, the dark file light ink.
      icon: { light: '/brand/icon-light.svg', dark: '/brand/icon-dark.svg' },
      logo: { light: '/brand/logo-light.svg', dark: '/brand/logo-dark.svg' },
      // One file for both tab strips: a browser picks the favicon before it
      // tells anyone the theme, and white strokes on green fills read on a
      // dark strip and on a light one.
      favicon: '/brand/icon-dark.svg'
    }
  },
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc'
    }
  }
})
