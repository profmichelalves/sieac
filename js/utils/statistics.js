export function media(arr) {
  const v = arr.filter(n => isNum(n));
  if (!v.length) return NaN;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function mediana(arr) {
  const v = arr.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function varianciaPop(arr) {
  const v = arr.filter(isNum);
  if (!v.length) return NaN;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length;
}

export function desvioPadraoPop(arr) {
  return Math.sqrt(varianciaPop(arr));
}

export function coefVariacao(arr) {
  const m = media(arr);
  if (!isFinite(m) || m === 0) return NaN;
  return (desvioPadraoPop(arr) / m) * 100;
}

export function quartis(arr) {
  const v = arr.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return { q1: NaN, mediana: NaN, q3: NaN, min: NaN, max: NaN };
  const med = (a, b) => v.length % 2
    ? v[Math.floor(a + ((b - a) / 2))]
    : (v[Math.floor(a + (b - a) / 2 - 1)] + v[Math.floor(a + (b - a) / 2)]) / 2;
  const q1 = med(0, Math.floor(v.length / 2));
  const q3 = med(Math.ceil(v.length / 2), v.length - 1);
  return {
    q1,
    mediana: mediana(v),
    q3,
    min: v[0],
    max: v[v.length - 1],
  };
}

export function outliers(arr) {
  const q = quartis(arr);
  if (!isFinite(q.q1) || !isFinite(q.q3)) return [];
  const iqr = q.q3 - q.q1;
  const limInf = q.q1 - 1.5 * iqr;
  const limSup = q.q3 + 1.5 * iqr;
  return arr.filter(n => isNum(n) && (n < limInf || n > limSup));
}

export function correlacaoPearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  const sx = [], sy = [];
  for (let i = 0; i < n; i++) {
    const a = Number(x[i]), b = Number(y[i]);
    if (!isNum(a) || !isNum(b)) continue;
    sx.push(a); sy.push(b);
  }
  const len = sx.length;
  if (len < 2) return NaN;
  const mx = sx.reduce((s, v) => s + v, 0) / len;
  const my = sy.reduce((s, v) => s + v, 0) / len;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < len; i++) {
    num += (sx[i] - mx) * (sy[i] - my);
    dx += (sx[i] - mx) * (sx[i] - mx);
    dy += (sy[i] - my) * (sy[i] - my);
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? NaN : num / den;
}

export function regressaoLinear(x, y) {
  const sx = [], sy = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const a = Number(x[i]), b = Number(y[i]);
    if (!isNum(a) || !isNum(b)) continue;
    sx.push(a); sy.push(b);
  }
  const n = sx.length;
  if (n < 2) return { slope: NaN, intercept: NaN, r2: NaN, prever: () => NaN };
  const mx = sx.reduce((s, v) => s + v, 0) / n;
  const my = sy.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (sx[i] - mx) * (sy[i] - my);
    den += (sx[i] - mx) * (sx[i] - mx);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (sy[i] - my) * (sy[i] - my);
    const pred = slope * sx[i] + intercept;
    ssRes += (sy[i] - pred) * (sy[i] - pred);
  }
  const r2 = ssTot === 0 ? NaN : 1 - ssRes / ssTot;
  return { slope, intercept, r2, prever: v => slope * v + intercept };
}

export function normalizar(arr) {
  const v = arr.filter(isNum);
  if (!v.length) return { dados: arr.map(() => 0), min: 0, max: 0 };
  const min = Math.min(...v);
  const max = Math.max(...v);
  const range = max - min;
  return {
    dados: arr.map(x => (range === 0 ? 0 : ((Number(x) - min) / range))),
    min,
    max,
  };
}

export function meanNormalizar(arr) {
  const v = arr.filter(isNum);
  if (!v.length) return { dados: arr.map(() => 0), media: 0, dp: 1 };
  const m = v.reduce((s, a) => s + a, 0) / v.length;
  const dp = desvioPadraoPop(v) || 1;
  return {
    dados: arr.map(x => (Number(x) - m) / dp),
    media: m,
    dp,
  };
}

function sigmoide(z) {
  return 1 / (1 + Math.exp(-z));
}

export function regressaoLogistica(X, y, { lr = 0.1, iteracoes = 2000, regul = 0.001 } = {}) {
  const n = X.length;
  if (!n) return { weights: [], prever: () => 0 };
  const dims = (X[0] || []).length;
  if (!dims) return { weights: [], prever: () => 0 };
  let w = new Array(dims).fill(0);
  for (let it = 0; it < iteracoes; it++) {
    const grads = new Array(dims).fill(0);
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      const z = xi.reduce((s, v, k) => s + v * w[k], 0);
      const pred = sigmoide(z);
      const err = pred - y[i];
      for (let k = 0; k < dims; k++) grads[k] += err * xi[k];
    }
    for (let k = 0; k < dims; k++) {
      w[k] = w[k] - (lr * grads[k]) / n - regul * w[k];
    }
  }
  const prever = xi => {
    const z = xi.reduce((s, v, k) => s + v * w[k], 0);
    return sigmoide(z);
  };
  return { weights: w, prever };
}

export function kMeans(pontos, k = 3, iteracoes = 50) {
  const kk = Math.max(1, Math.min(k, pontos.length || 1));
  if (!pontos.length) return { clusters: [], centoides: [] };
  const dims = (pontos[0] || []).length || 1;
  const cent = [];
  const indices = new Set();
  while (indices.size < kk) indices.add(Math.floor(Math.random() * pontos.length));
  [...indices].forEach(i => cent.push([...pontos[i]]));

  let assign = new Array(pontos.length).fill(0);
  for (let it = 0; it < iteracoes; it++) {
    assign = pontos.map(p => {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < kk; c++) {
        let d = 0;
        for (let j = 0; j < dims; j++) d += (p[j] - cent[c][j]) * (p[j] - cent[c][j]);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    });
    for (let c = 0; c < kk; c++) {
      const membros = [];
      assign.forEach((a, i) => { if (a === c) membros.push(pontos[i]); });
      if (!membros.length) continue;
      for (let j = 0; j < dims; j++) {
        cent[c][j] = membros.reduce((s, m) => s + m[j], 0) / membros.length;
      }
    }
  }
  const clusters = [];
  for (let c = 0; c < kk; c++) {
    clusters.push(pontos.map((p, i) => ({ ponto: p, idx: i })).filter(x => assign[x.idx] === c).map(x => x.idx));
  }
  return { clusters, centoides: cent, assign };
}

function isNum(v) {
  return typeof v === 'number' && isFinite(v);
}
