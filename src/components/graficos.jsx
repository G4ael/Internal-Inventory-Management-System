// ============================================================================
// graficos.jsx — gráficos do painel, em SVG puro (sem biblioteca)
// Linhas de 2px, grade fina e discreta, dica ao passar o mouse ou ao
// navegar com as setas do teclado, e os números também em tabela.
// ============================================================================
import { useState, useEffect, useRef, useId } from 'react';

const useLargura = () => {
  const ref = useRef(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura];
};

// Topo "redondo" do eixo Y: 0 / 2.500 / 5.000 / 7.500 …
const escala = (max, passos = 3) => {
  if (!(max > 0)) return { topo: passos, passo: 1 };
  const bruto = max / passos;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  const passo = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return { topo: passo * Math.max(1, Math.ceil(max / passo)), passo };
};

// Curva suave que respeita a subida/descida dos dados (Fritsch–Carlson):
// não inventa picos nem desce abaixo do zero entre dois pontos.
const curva = (pts) => {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  const f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f(pts[i][0] + h)},${f(pts[i][1] + t[i] * h)} ${f(pts[i + 1][0] - h)},${f(pts[i + 1][1] - t[i + 1] * h)} ${f(pts[i + 1][0])},${f(pts[i + 1][1])}`;
  }
  return d;
};

/* ─── Área: período atual (linha cheia) × período anterior (tracejada) ─── */
export const GraficoArea = ({ pontos, formatarEixo, formatarValor, nomeAtual, nomeAnterior, altura = 240 }) => {
  const [ref, largura] = useLargura();
  const [ativo, setAtivo] = useState(null);
  const id = useId().replace(/:/g, '');
  const n = pontos.length;
  const m = { t: 14, r: 10, b: 28, l: 64 };
  const iw = Math.max(10, largura - m.l - m.r);
  const ih = altura - m.t - m.b;
  const max = Math.max(0, ...pontos.map(p => Math.max(p.valor, p.anterior ?? 0)));
  const { topo, passo } = escala(max);
  const x = (i) => m.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => m.t + ih - (v / topo) * ih;
  const caminho = (campo) => curva(pontos.map((p, i) => [x(i), y(p[campo] ?? 0)]));
  const linhaAtual = caminho('valor');
  const area = `${linhaAtual}L${x(n - 1).toFixed(1)},${m.t + ih}L${x(0).toFixed(1)},${m.t + ih}Z`;
  const temAnterior = pontos.some(p => p.anterior != null);

  const ticksY = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) ticksY.push(v);
  // Rótulos do eixo X com ~80px de folga entre eles, sempre com o primeiro e o último
  const passoX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 80))));
  const ticksX = pontos.map((_, i) => i).filter(i => i % passoX === 0 && (n - 1 - i >= passoX / 2 || i === n - 1));
  if (!ticksX.includes(n - 1)) ticksX.push(n - 1);

  const escolher = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const px = clientX - r.left - m.l;
    const i = n <= 1 ? 0 : Math.round((px / iw) * (n - 1));
    setAtivo(Math.min(n - 1, Math.max(0, i)));
  };
  const teclado = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setAtivo(a => Math.min(n - 1, (a ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setAtivo(a => Math.max(0, (a ?? n) - 1)); }
  };
  const p = ativo != null ? pontos[ativo] : null;

  return (
    <div className="grafico" ref={ref}>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label={`Gráfico: ${nomeAtual}`}>
          <defs>
            <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--acento)" stopOpacity=".16" />
              <stop offset="100%" stopColor="var(--acento)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticksY.map(v => (
            <g key={v}>
              <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke="var(--grade)" strokeWidth="1" />
              <text x={m.l - 10} y={y(v)} textAnchor="end" dominantBaseline="middle">{formatarEixo(v)}</text>
            </g>
          ))}
          {ticksX.map((i, k) => (
            <text key={i} x={x(i)} y={altura - 6} textAnchor={k === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{pontos[i].rotulo}</text>
          ))}
          <path d={area} fill={`url(#g${id})`} />
          {temAnterior && <path d={caminho('anterior')} fill="none" stroke="var(--serie-ant)" strokeWidth="1.5" strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />}
          <path d={linhaAtual} fill="none" stroke="var(--acento)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {p && (
            <g>
              <line x1={x(ativo)} x2={x(ativo)} y1={m.t} y2={m.t + ih} stroke="var(--linha-forte)" strokeWidth="1" />
              {temAnterior && <circle cx={x(ativo)} cy={y(p.anterior ?? 0)} r="4" fill="var(--serie-ant)" stroke="var(--superficie)" strokeWidth="2" />}
              <circle cx={x(ativo)} cy={y(p.valor)} r="5" fill="var(--acento)" stroke="var(--superficie)" strokeWidth="2" />
            </g>
          )}
          <rect className="alvo" x={m.l - 8} y={m.t} width={iw + 16} height={ih} fill="transparent" tabIndex={0}
            aria-label="Use as setas para ver cada ponto"
            onPointerMove={(e) => escolher(e.clientX)} onPointerLeave={() => setAtivo(null)}
            onFocus={() => setAtivo(a => a ?? n - 1)} onBlur={() => setAtivo(null)} onKeyDown={teclado} />
        </svg>
      )}
      {p && (
        <div className="dica" style={{ left: Math.min(Math.max(x(ativo), 90), largura - 90), top: y(Math.max(p.valor, p.anterior ?? 0)) }}>
          <div className="dica-titulo">{p.rotuloLongo || p.rotulo}</div>
          <div className="dica-linha"><i className="chave-linha" /><b>{formatarValor(p.valor)}</b> {nomeAtual}</div>
          {temAnterior && <div className="dica-linha"><i className="chave-linha tracejada" /><b>{formatarValor(p.anterior ?? 0)}</b> {nomeAnterior}</div>}
        </div>
      )}
      <div className="legenda" style={{ marginTop: 6 }}>
        <span><i className="chave-linha" />{nomeAtual}</span>
        {temAnterior && <span><i className="chave-linha tracejada" />{nomeAnterior}</span>}
      </div>
      <details className="tabela-dados">
        <summary>Ver os números em tabela</summary>
        <table>
          <thead><tr><th>Período</th><th>{nomeAtual}</th>{temAnterior && <th>{nomeAnterior}</th>}</tr></thead>
          <tbody>
            {pontos.map((q, i) => (
              <tr key={i}><td>{q.rotuloLongo || q.rotulo}</td><td className="num">{formatarValor(q.valor)}</td>{temAnterior && <td className="num">{formatarValor(q.anterior ?? 0)}</td>}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};

/* ─── Colunas: uma por dia da semana, o maior em destaque ─── */
export const BarrasSemana = ({ dados, unidade = ['serviço', 'serviços'], altura = 200 }) => {
  const [ref, largura] = useLargura();
  const [ativo, setAtivo] = useState(null);
  const m = { t: 26, b: 26 };
  const ih = altura - m.t - m.b;
  const max = Math.max(1, ...dados.map(d => d.valor));
  const idxMax = dados.reduce((mi, d, i) => (d.valor > dados[mi].valor ? i : mi), 0);
  const slot = largura / dados.length;
  const bw = Math.min(36, slot * 0.62);
  const nome = (v) => `${v} ${v === 1 ? unidade[0] : unidade[1]}`;
  // Coluna com cantos de cima arredondados e base reta
  const coluna = (cx, h) => {
    const r = Math.min(8, bw / 2, h);
    const x0 = cx - bw / 2, x1 = cx + bw / 2, yb = m.t + ih, yt = yb - h;
    if (h <= 0) return '';
    return `M${x0},${yb}V${yt + r}Q${x0},${yt} ${x0 + r},${yt}H${x1 - r}Q${x1},${yt} ${x1},${yt + r}V${yb}Z`;
  };

  return (
    <div className="grafico" ref={ref}>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Serviços por dia da semana">
          <line x1="0" x2={largura} y1={m.t + ih} y2={m.t + ih} stroke="var(--linha)" strokeWidth="1" />
          {dados.map((d, i) => {
            const cx = slot * i + slot / 2;
            const h = (d.valor / max) * ih;
            const destaque = i === idxMax && d.valor > 0;
            const fill = destaque ? 'var(--acento)' : ativo === i ? 'var(--linha-forte)' : 'var(--tile-2)';
            return (
              <g key={d.rotulo} tabIndex={0} aria-label={`${d.longo}: ${nome(d.valor)}`}
                onPointerEnter={() => setAtivo(i)} onPointerLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} style={{ outline: 'none' }}>
                <rect x={slot * i} y={0} width={slot} height={altura} fill="transparent" />
                {h > 0
                  ? <path d={coluna(cx, Math.max(h, 4))} fill={fill} style={{ transition: 'fill .15s' }} />
                  : <rect x={cx - bw / 2} y={m.t + ih - 3} width={bw} height="3" rx="1.5" fill="var(--tile-2)" />}
                {destaque && <text x={cx} y={m.t + ih - Math.max(h, 4) - 8} textAnchor="middle" style={{ fill: 'var(--tinta)', fontWeight: 600, fontSize: 13 }}>{d.valor}</text>}
                <text x={cx} y={altura - 6} textAnchor="middle" style={destaque ? { fill: 'var(--tinta)', fontWeight: 600 } : undefined}>{d.rotulo}</text>
              </g>
            );
          })}
        </svg>
      )}
      {ativo != null && ativo !== idxMax && (
        <div className="dica" style={{ left: slot * ativo + slot / 2, top: m.t + ih - Math.max((dados[ativo].valor / max) * ih, 4) }}>
          <div className="dica-titulo">{dados[ativo].longo}</div>
          <div className="dica-linha"><b>{nome(dados[ativo].valor)}</b></div>
        </div>
      )}
    </div>
  );
};

/* ─── Medidor em arco de tracinhos (taxa de 0 a 100%) ─── */
export const Medidor = ({ pct, largura = 260 }) => {
  const N = 36;
  const cx = largura / 2, cy = largura / 2, R = largura / 2 - 6, r = R - 22;
  const cheios = Math.round(Math.max(0, Math.min(1, pct)) * N);
  return (
    <svg width={largura} height={largura / 2 + 6} viewBox={`0 0 ${largura} ${largura / 2 + 6}`} aria-hidden="true" style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}>
      {Array.from({ length: N }, (_, i) => {
        const a = Math.PI - (i * Math.PI) / (N - 1);
        return (
          <line key={i} x1={cx + r * Math.cos(a)} y1={cy - r * Math.sin(a)} x2={cx + R * Math.cos(a)} y2={cy - R * Math.sin(a)}
            stroke={i < cheios ? 'var(--acento)' : 'var(--tile-2)'} strokeWidth="5" strokeLinecap="round" />
        );
      })}
    </svg>
  );
};
