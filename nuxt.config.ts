export default defineNuxtConfig({
  compatibilityDate: '2026-06-24',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  nitro: {
    preset: 'cloudflare-pages'
  },
  typescript: {
    strict: true
  }
})
