const el = document.getElementById('app-loading');

export function showAppLoading() {
  el?.classList.remove('hidden');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar?.classList.remove('open');
  backdrop?.classList.remove('show');
  document.body.classList.remove('sidebar-open');
}

export function hideAppLoading() {
  el?.classList.add('hidden');
}

export function isAppLoadingVisible() {
  return !!el && !el.classList.contains('hidden');
}