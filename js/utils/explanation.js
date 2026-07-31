function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function infoBtn(titulo, texto) {
  return `<button type="button" class="info-btn" data-info-titulo="${esc(titulo)}" data-info="${esc(texto)}" title="Como é calculado?" aria-label="Como é calculado?">
    <i class="bi bi-question-circle"></i>
  </button>`;
}

export function initInfoButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.info-btn');
    if (!btn) return;
    e.preventDefault();

    let modalEl = document.getElementById('info-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'info-modal';
      modalEl.className = 'modal fade';
      modalEl.tabIndex = -1;
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="info-modal-title"></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body" id="info-modal-body" style="font-size:0.9rem;line-height:1.7;"></div>
          </div>
        </div>`;
      document.body.appendChild(modalEl);
    }

    document.getElementById('info-modal-title').textContent = btn.dataset.infoTitulo || 'Como é calculado?';
    document.getElementById('info-modal-body').textContent = btn.dataset.info || '';
    new bootstrap.Modal(modalEl).show();
  });
}
