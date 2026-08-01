export const EXPLICACAO_RESULTADO =
  ' Como a média e a situação são calculadas: a média acumulada de cada disciplina é a média aritmética das notas dos bimestres lançados, arredondada a 1 casa decimal. Bimestres sem nota lançada não são considerados e disciplinas sem nenhuma nota lançada não entram na média; uma nota 0 lançada é considerada uma nota efetivamente lançada. A situação de cada estudante é definida pela frequência e pela quantidade de disciplinas com média inferior a 6,0: nenhuma disciplina abaixo e frequência ≥ 75% → Em Aprovação/Aprovado; 1 a 6 disciplinas abaixo e frequência ≥ 75% → Em Recuperação/Recuperação Final; frequência < 75% ou mais de 6 disciplinas abaixo → Em Reprovação/Reprovado. A classificação considera apenas estudantes com todas as disciplinas com notas lançadas; estudantes com alguma disciplina sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram na classificação de Aprovação, Recuperação ou Reprovação. Os percentuais de Aprovação, Recuperação e Reprovação são calculados sobre o total de estudantes classificados (com todas as notas lançadas) e somam 100% entre si; o percentual do card "Sem Notas Lançadas" é calculado sobre o total de estudantes importados, de forma independente. A frequência é a média dos percentuais registrados; frequência inferior a 75% resulta em reprovação, independentemente da média.';

export function termosSituacao(periodo) {
  if (periodo === 'anual') {
    return {
      card: { aprovado: 'Aprovação', recuperacao: 'Recuperação', reprovado: 'Reprovação' },
      label: { aprovado: 'Aprovados', recuperacao: 'Recuperação', reprovado: 'Reprovados' },
      tituloGrafico: 'Distribuição dos Resultados Finais',
      explicacaoGrafico: 'Classifica os estudantes pela frequência e pelo número de disciplinas com média anual inferior a 6,0: Aprovado (nenhuma disciplina abaixo e frequência ≥ 75%), Recuperação (1 a 6 disciplinas abaixo com frequência ≥ 75%) e Reprovado (frequência < 75% ou mais de 6 disciplinas abaixo). Apenas estudantes com todas as disciplinas com notas lançadas são classificados; os percentuais são calculados sobre esses estudantes classificados e somam 100% entre si. Estudantes com alguma disciplina sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram nesta distribuição.',
    };
  }
  return {
    card: { aprovado: 'Em Aprovação', recuperacao: 'Em Recuperação', reprovado: 'Em Reprovação' },
    label: { aprovado: 'Em Aprovação', recuperacao: 'Em Recuperação', reprovado: 'Em Reprovação' },
    tituloGrafico: 'Distribuição das Situações Parciais',
    explicacaoGrafico: 'Classifica a situação parcial dos estudantes até o momento: Em Aprovação (nenhuma disciplina com média acumulada inferior a 6,0 e frequência ≥ 75%), Em Recuperação (1 a 6 disciplinas abaixo com frequência ≥ 75%) e Em Reprovação (frequência < 75% ou mais de 6 disciplinas abaixo). Apenas estudantes com todas as disciplinas com notas lançadas são classificados; os percentuais são calculados sobre esses estudantes classificados e somam 100% entre si. Estudantes com alguma disciplina sem nenhuma nota lançada ficam no card "Sem Notas Lançadas" e não entram nesta distribuição. Ao final do ano letivo, a situação é consolidada em Aprovado, Recuperação Final ou Reprovado.',
  };
}

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
