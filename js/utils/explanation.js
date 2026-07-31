export const EXPLICACAO_RESULTADO =
  ' Como a média e o resultado são calculados: a média final (media_final) vem da coluna "MÉDIA FINAL" da planilha; quando zerada ou ausente, é calculada pela média das notas dos 4 bimestres (considerando apenas notas maiores que zero) e arredondada a 1 casa decimal. O resultado final (resultado_final) é o valor da coluna "RESULTADO FINAL"; se vazio ou "MATRICULADO", é derivado da média: APROVADO quando média ≥ 6 e REPROVADO quando média < 6. Sem média válida, o resultado final fica vazio.';

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
