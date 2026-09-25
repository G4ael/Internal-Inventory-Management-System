// ============================================================================
// ui.jsx — peças de interface usadas em todas as telas
// ============================================================================
import { useEffect, useRef } from 'react';
import { X, Search, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { iniciais } from '../lib/format';

// Chama da marca (o mesmo desenho do site da loja)
export const Chama = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5 3.4-8.4.2-.8 1.2-1 1.6-.3 1.8 2.6 1.4 4.2 1.4 4.2s1.2-.6 1.6-2.4c.2-.7 1.1-.8 1.4-.2C16.6 10.4 18 12.6 18 15.4 18 18.6 15.6 21 12 21z" />
  </svg>
);

export const Logo = ({ subtitulo = 'Gestão interna', compacto = false }) => (
  <div className="logo">
    <span className="logo-marca"><Chama /></span>
    {!compacto && <span className="some-recolhido"><b>Servigás</b><small>{subtitulo}</small></span>}
  </div>
);

// Fecha com Esc e leva o foco para a janela quando ela abre.
// onClose fica num ref: mudar a função a cada render não pode roubar o foco.
const useEsc = (aberto, onClose, ref) => {
  const fechar = useRef(onClose);
  useEffect(() => { fechar.current = onClose; });
  useEffect(() => {
    if (!aberto) return;
    const h = (e) => { if (e.key === 'Escape') fechar.current?.(); };
    window.addEventListener('keydown', h);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', h);
  }, [aberto, ref]);
};

export const Modal = ({ open, onClose, title, children, rodape, maxWidth = '560px' }) => {
  const ref = useRef(null);
  useEsc(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" style={{ maxWidth }} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-cab">
          <h2>{title}</h2>
          <button className="btn-icone" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  );
};

export const Gaveta = ({ open, onClose, titulo, children, rodape }) => {
  const ref = useRef(null);
  useEsc(open, onClose, ref);
  if (!open) return null;
  return (
    <>
      <div className="gaveta-fundo" onClick={onClose} />
      <aside className="gaveta" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref}>
        {children}
        {rodape && <div className="gaveta-rodape">{rodape}</div>}
      </aside>
    </>
  );
};

export const Field = ({ label, children, span = 12, dica }) => (
  <div style={{ gridColumn: `span ${span}` }}>
    {label && <label className="rotulo">{label}</label>}
    {children}
    {dica && <p className="t3" style={{ fontSize: 12.5, margin: '6px 0 0' }}>{dica}</p>}
  </div>
);

export const PageHeader = ({ titulo, sub, children }) => (
  <div className="pagina-cab">
    <div>
      <h1 className="titulo-pagina">{titulo}</h1>
      {sub && <p>{sub}</p>}
    </div>
    {children && <div className="acoes">{children}</div>}
  </div>
);

export const BuscaPagina = ({ value, onChange, placeholder }) => (
  <div className="busca-pagina">
    <Search />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    {value && <button onClick={() => onChange('')} aria-label="Limpar busca"><X size={15} /></button>}
  </div>
);

// Seletor segmentado: opcoes = [{ id, label, icone }]
export const Segmentado = ({ opcoes, valor, onChange, rotulo }) => (
  <div className="segmentado" role="group" aria-label={rotulo}>
    {opcoes.map(o => {
      const I = o.icone;
      return (
        <button key={o.id} aria-pressed={valor === o.id} onClick={() => onChange(o.id)}>
          {I && <I size={15} />}{o.label}
        </button>
      );
    })}
  </div>
);

// Chips de filtro com contagem: opcoes = [{ id, label, qtd }]
export const Chips = ({ opcoes, valor, onChange, rotulo }) => (
  <div className="chips" role="group" aria-label={rotulo}>
    {opcoes.map(o => (
      <button key={o.id} className="chip" aria-pressed={valor === o.id} onClick={() => onChange(o.id)}>
        {o.label}{o.qtd != null && <span className="qtd">{o.qtd}</span>}
      </button>
    ))}
  </div>
);

export const Selo = ({ tom = 'neutro', icone: I, children, title }) => (
  <span className={`selo selo-${tom}`} title={title}>{I && <I />}{children}</span>
);

// Variação percentual contra o período anterior
export const Delta = ({ atual, anterior }) => {
  if (!anterior) return null;
  const pct = ((atual - anterior) / anterior) * 100;
  const cls = pct > 0.05 ? 'sobe' : pct < -0.05 ? 'desce' : 'igual';
  const I = cls === 'sobe' ? ArrowUpRight : cls === 'desce' ? ArrowDownRight : Minus;
  return (
    <span className={`delta ${cls}`} title="Comparado ao período anterior">
      <I />{Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  );
};

export const Avatar = ({ nome, grande, neutro }) => (
  <span className={`avatar ${grande ? 'grande' : ''} ${neutro ? 'neutro' : ''}`} aria-hidden="true">{iniciais(nome)}</span>
);

export const Vazio = ({ icone: I, titulo, texto, children }) => (
  <div className="vazio">
    {I && <div className="vazio-icone"><I size={24} /></div>}
    {titulo && <b>{titulo}</b>}
    {texto && <p>{texto}</p>}
    {children && <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>{children}</div>}
  </div>
);

export const Esqueleto = ({ h = 16, w = '100%', r, style }) => (
  <div className="esqueleto" style={{ height: h, width: w, borderRadius: r, ...style }} />
);

// Ícone oficial do Google (SVG inline — evita dependência extra)
export const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);
