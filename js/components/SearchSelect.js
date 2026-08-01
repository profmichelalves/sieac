function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function createSearchSelect({ items = [], getText = it => String(it), getValue = it => it, onSelect = null, placeholder = '', disabled = false }) {
  const root = document.createElement('div');
  root.className = 'search-select';
  root.innerHTML = `
    <div class="search-select-control">
      <input type="text" class="search-select-input" autocomplete="off" spellcheck="false">
      <span class="search-select-caret"></span>
    </div>
    <ul class="search-select-dropdown" hidden></ul>
  `;

  const input = root.querySelector('.search-select-input');
  const dropdown = root.querySelector('.search-select-dropdown');

  let currentItems = [...items];
  let selectedValue = '';
  let selectedText = '';
  let isDisabled = false;
  let destroyed = false;
  let open = false;
  let highlight = -1;

  input.placeholder = placeholder;

  function buildFiltered() {
    const term = norm(input.value);
    const filtered = [];
    currentItems.forEach((it, idx) => {
      if (norm(getText(it)).includes(term)) filtered.push({ it, idx });
    });
    return filtered;
  }

  function render() {
    if (destroyed) return;
    const filtered = buildFiltered();
    if (!filtered.length) {
      dropdown.innerHTML = '<li class="search-select-empty">Nenhuma opção encontrada</li>';
    } else {
      dropdown.innerHTML = filtered.map(({ it, idx }, pos) => {
        const isSel = String(getValue(it)) === String(selectedValue);
        return `<li role="option" data-idx="${idx}" class="search-select-option${isSel ? ' selected' : ''}${pos === highlight ? ' highlight' : ''}">${esc(getText(it))}</li>`;
      }).join('');
    }
    dropdown.hidden = false;
  }

  function openList() {
    if (isDisabled || destroyed) return;
    const filtered = buildFiltered();
    const selPos = filtered.findIndex(({ it }) => String(getValue(it)) === String(selectedValue));
    highlight = selPos;
    render();
    open = true;
  }

  function closeList() {
    open = false;
    dropdown.hidden = true;
  }

  function selectItem(it) {
    selectedValue = String(getValue(it));
    selectedText = getText(it);
    input.value = selectedText;
    closeList();
    if (onSelect) onSelect(selectedValue, it);
  }

  input.addEventListener('input', () => { highlight = -1; openList(); });
  input.addEventListener('focus', () => openList());

  input.addEventListener('keydown', (e) => {
    if (isDisabled || destroyed) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    const options = [...dropdown.querySelectorAll('.search-select-option')];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight = Math.min(highlight + 1, options.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight = Math.max(highlight - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) selectItem(currentItems[Number(opt.dataset.idx)]);
    } else if (e.key === 'Escape') {
      closeList();
    } else if (e.key === 'Tab') {
      closeList();
    }
  });

  dropdown.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const opt = e.target.closest('.search-select-option');
    if (!opt) return;
    selectItem(currentItems[Number(opt.dataset.idx)]);
  });

  document.addEventListener('click', (e) => {
    if (destroyed) return;
    if (!root.contains(e.target)) closeList();
  });

  function setDisabled(d) {
    isDisabled = d;
    input.disabled = d;
    if (d) closeList();
  }
  setDisabled(disabled);

  return {
    el: root,
    setItems(items) {
      currentItems = [...items];
      if (open) render();
    },
    setValue(v) {
      selectedValue = v == null ? '' : String(v);
      const it = currentItems.find(x => String(getValue(x)) === selectedValue);
      selectedText = it ? getText(it) : '';
      input.value = selectedText;
    },
    getValue() { return selectedValue; },
    getText() { return selectedText; },
    clear() {
      selectedValue = '';
      selectedText = '';
      input.value = '';
      closeList();
    },
    setDisabled,
    destroy() {
      destroyed = true;
      closeList();
    },
  };
}
