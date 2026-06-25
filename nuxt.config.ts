// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false, // Must be SPA mode for compatibility with Electron static rendering
  devServer: {
    port: 5656
  },
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => ['webview'].includes(tag)
    }
  },
  modules: [
    '@nuxtjs/tailwindcss'
  ],
  css: [
    '~/assets/css/main.scss'
  ],
  app: {
    head: {
      title: 'Multi-View DevBrowser',
      meta: [
        { name: 'description', content: 'Simultaneous responsive web preview and testing tool with multi-session isolation.' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap' }
      ],
      script: [
        {
          children: `
            window.addEventListener('error', (event) => {
              console.error('[Browser Runtime Error] ' + event.message + ' at ' + event.filename + ':' + event.lineno);
            });
            window.addEventListener('unhandledrejection', (event) => {
              console.error('[Browser Unhandled Rejection] ' + event.reason);
            });
            console.log('[Browser Bootstrapping] Global error listeners active.');
          `
        }
      ]
    }
  }
})
