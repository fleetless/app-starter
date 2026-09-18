export default defineAppConfig({
  // Rename here, replace the two files under public/brand/, pick a colour.
  starter: {
    name: 'Fleetless App',
    brand: {
      icon: '/brand/icon.svg',
      logo: '/brand/logo.svg'
    }
  },
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc'
    }
  }
})
