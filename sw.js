const CACHE_NAME = 'sieac-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo.jpg',
  './css/theme.css',
  './css/base/variables.css',
  './css/base/reset.css',
  './css/base/typography.css',
  './css/components/sidebar.css',
  './css/components/header.css',
  './css/components/cards.css',
  './css/components/filters.css',
  './css/components/charts.css',
  './css/components/import.css',
  './css/components/auth.css',
  './css/components/tables.css',
  './assets/vendor/bootstrap.min.css',
  './assets/vendor/bootstrap-icons.min.css',
  './assets/vendor/bootstrap.bundle.min.js',
  './assets/vendor/chart.umd.min.js',
  './assets/vendor/xlsx.full.min.js',
  './assets/vendor/jspdf.umd.min.js',
  './assets/vendor/jspdf.plugin.autotable.min.js',
  './js/app.js',
  './js/router.js',
  './js/config.js',
  './js/utils/validators.js',
  './js/utils/pdf.js',
  './js/utils/helpers.js',
  './js/utils/formatters.js',
  './js/utils/explanation.js',
  './js/utils/estudanteFiltros.js',
  './js/services/importService.js',
  './js/services/authService.js',
  './js/services/turmaService.js',
  './js/services/supabase.js',
  './js/services/logService.js',
  './js/repositories/necessidadesRepository.js',
  './js/repositories/dashboardRepository.js',
  './js/components/FilterPanel.js',
  './js/components/Charts.js',
  './js/components/SearchSelect.js',
  './js/components/Sidebar.js',
  './js/pages/usuariosPage.js',
  './js/pages/turmasPage.js',
  './js/pages/relatoriosSemNotas.js',
  './js/pages/relatoriosPage.js',
  './js/pages/relatorioNee.js',
  './js/pages/logsPage.js',
  './js/pages/importPage.js',
  './js/pages/dashboardGeral.js',
  './js/pages/dashboardFrequencia.js',
  './js/pages/dashboardEstudante.js',
  './js/pages/dashboardDesempenho.js',
  './js/pages/dashboardComparativo.js',
  './js/pages/cadastroEstudantes.js',
  './js/pages/authPage.js',
  './assets/icons/icon-16.png',
  './assets/icons/icon-32.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png'
];

const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.hostname.endsWith('.supabase.co')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
