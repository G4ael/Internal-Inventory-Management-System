/* ────────────────────────────────────────────────────────────────────────────
   SERVIGÁS — GESTÃO INTERNA
   ─────────────────────────────────────────────────────────────────────────────
   - Dados no Supabase (src/lib/db.js traduz banco ↔ tela)
   - Estado global via contexto (src/providers.jsx)
   - Cada tela fica em src/pages; peças comuns em src/components
   - Visual: o mesmo sistema da loja (src/index.css)
   - Movimentação de estoque é feita pelos TRIGGERS do banco
   ──────────────────────────────────────────────────────────────────────────── */
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Wrench, Receipt, Users, Package, Store, ShoppingCart, FileText, Settings,
  Search, Sun, Moon, Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ChevronDown, Wallet,
  ExternalLink, CalendarClock, CheckCircle2
} from 'lucide-react';
import { supabase } from './lib/supabase';
import * as db from './lib/db';
import { uid, pref, hojeISO } from './lib/format';
import { statusOrc, URL_LOJA } from './lib/dominio';
import { NavCtx, useData } from './contexto';
import { ToastProvider, DataProvider } from './providers';
import { Logo, Avatar, Esqueleto } from './components/ui';
import BuscaGlobal from './components/BuscaGlobal';
import FichaCliente from './components/FichaCliente';
import Login from './pages/Login';
import Painel from './pages/Painel';
import Servicos from './pages/Servicos';
import Orcamentos from './pages/Orcamentos';
import Clientes from './pages/Clientes';
import Estoque from './pages/Estoque';
import Loja from './pages/Loja';
import Vendas from './pages/Vendas';
import Notas from './pages/Notas';
import Configuracoes from './pages/Configuracoes';

const TITULOS = {
  painel: 'Painel', servicos: 'Serviços', orcamentos: 'Orçamentos', clientes: 'Clientes', estoque: 'Estoque',
  loja: 'Loja virtual', vendas: 'Vendas', notas: 'Notas fiscais', config: 'Configurações'
};
const ehMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

const CarregandoPagina = () => (
  <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <Esqueleto h={20} w="30%" />
    {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Esqueleto h={40} w={40} r={999} /><Esqueleto h={14} w={`${60 - i * 6}%`} /></div>)}
  </div>
);

const Shell = ({ user, theme, setTheme, sair }) => {
  const { data, loaded } = useData();
  const [page, setPage] = useState('painel');
  const [search, setSearch] = useState('');
  const [intent, setIntent] = useState(null);
  const [fichaId, setFichaId] = useState(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [recolhido, setRecolhidoEstado] = useState(() => pref.ler('servigas-menu-recolhido', false));
  const [financeiroAberto, setFinanceiroAberto] = useState(true);
  const [suspenso, setSuspenso] = useState(null); // 'avisos' | 'conta'
  const [lojaAtivos, setLojaAtivos] = useState(null);

  const setRecolhido = (v) => { setRecolhidoEstado(v); pref.gravar('servigas-menu-recolhido', v); };

  // Navegação entre telas. opts: { acao, id, dados, filtro, busca, orcamentoId }
  const ir = useCallback((p, opts = {}) => {
    setPage(p);
    setSearch(opts.busca || '');
    setIntent(opts.acao || opts.filtro ? { page: p, ...opts, chave: uid() } : null);
    setFichaId(null);
    setMenuAberto(false);
    setSuspenso(null);
    window.scrollTo({ top: 0 });
  }, []);
  const abrirCliente = useCallback((id) => { setFichaId(id); setSuspenso(null); }, []);
  const abrirBusca = useCallback(() => setBuscaAberta(true), []);

  // Ctrl+K / ⌘K abre a busca global
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBuscaAberta(v => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { document.title = `${TITULOS[page]} · Servigás`; }, [page]);
  useEffect(() => { db.contarLojaAtivos().then(setLojaAtivos); }, [page]);

  // Contadores do menu e avisos do sino
  const hoje = hojeISO();
  const osAbertas = data.servicos.filter(s => s.status === 'pendente' || s.status === 'em_andamento').length;
  const osHoje = data.servicos.filter(s => s.data === hoje && (s.status === 'pendente' || s.status === 'em_andamento')).length;
  const orcStatus = data.orcamentos.map(o => statusOrc(o, hoje));
  const orcPendentes = orcStatus.filter(s => s === 'aberto' || s === 'vencido').length;
  const orcVencidos = orcStatus.filter(s => s === 'vencido').length;
  const estoqueAlerta = data.produtos.filter(p => p.qtd <= p.minimo).length;
  const avisos = [
    osHoje && { id: 'os', icone: CalendarClock, titulo: `${osHoje} ${osHoje === 1 ? 'serviço marcado' : 'serviços marcados'} para hoje`, sub: 'Veja a agenda e confirme o técnico', ir: () => ir('servicos') },
    orcVencidos && { id: 'orc', icone: Receipt, titulo: `${orcVencidos} ${orcVencidos === 1 ? 'orçamento vencido' : 'orçamentos vencidos'}`, sub: 'Cobre o cliente ou renove a validade', ir: () => ir('orcamentos', { filtro: 'vencido' }) },
    estoqueAlerta && { id: 'est', icone: Package, titulo: `${estoqueAlerta} ${estoqueAlerta === 1 ? 'produto' : 'produtos'} no estoque mínimo`, sub: 'Hora de repor', ir: () => ir('estoque', { filtro: 'alerta' }) }
  ].filter(Boolean);

  const NAV = [
    { id: 'painel', label: 'Painel', icone: LayoutDashboard },
    { id: 'servicos', label: 'Serviços', icone: Wrench, contador: osAbertas },
    { id: 'orcamentos', label: 'Orçamentos', icone: Receipt, contador: orcPendentes, alerta: orcVencidos > 0 },
    { id: 'clientes', label: 'Clientes', icone: Users },
    { id: 'estoque', label: 'Estoque', icone: Package, contador: estoqueAlerta, alerta: true },
    { id: 'loja', label: 'Loja virtual', icone: Store }
  ];
  const FINANCEIRO = [
    { id: 'vendas', label: 'Vendas', icone: ShoppingCart },
    { id: 'notas', label: 'Notas fiscais', icone: FileText }
  ];

  const itemNav = (n) => {
    const I = n.icone;
    return (
      <button key={n.id} className="nav-item" aria-current={page === n.id ? 'page' : undefined} onClick={() => ir(n.id)} title={recolhido ? n.label : undefined}>
        <I /><span className="rot some-recolhido">{n.label}</span>
        {n.contador > 0 && <span className={`nav-contador some-recolhido ${n.alerta ? 'alerta' : ''}`}>{n.contador}</span>}
      </button>
    );
  };

  const props = { search, setSearch, intent: intent?.page === page ? intent : null };
  const chave = intent?.page === page ? intent.chave : page;
  const precisaDados = !['painel', 'loja', 'config'].includes(page);
  const pagina = () => {
    if (!loaded && precisaDados) return <CarregandoPagina />;
    switch (page) {
      case 'painel': return <Painel key={chave} />;
      case 'servicos': return <Servicos key={chave} {...props} />;
      case 'orcamentos': return <Orcamentos key={chave} {...props} />;
      case 'clientes': return <Clientes key={chave} {...props} />;
      case 'estoque': return <Estoque key={chave} {...props} />;
      case 'loja': return <Loja key={chave} {...props} />;
      case 'vendas': return <Vendas key={chave} {...props} />;
      case 'notas': return <Notas key={chave} {...props} />;
      case 'config': return <Configuracoes key={chave} />;
      default: return null;
    }
  };

  const nomeUsuario = user.user_metadata?.full_name || user.email;

  return (
    <NavCtx.Provider value={{ ir, abrirCliente, abrirBusca, page }}>
      <div className={`app ${recolhido ? 'recolhido' : ''} ${menuAberto ? 'menu-aberto' : ''}`}>
        <div className="fundo-menu" onClick={() => setMenuAberto(false)} />
        <aside className="lateral" aria-label="Menu principal">
          <div className="lateral-topo">
            <Logo />
            <button className="btn-icone so-desktop" onClick={() => setRecolhido(!recolhido)} aria-label={recolhido ? 'Abrir menu' : 'Recolher menu'} title={recolhido ? 'Abrir menu' : 'Recolher menu'}>
              {recolhido ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
          </div>
          <nav className="lateral-nav">
            {NAV.map(itemNav)}
            <div className="nav-separador" />
            <button className="nav-item some-recolhido" onClick={() => setFinanceiroAberto(!financeiroAberto)} aria-expanded={financeiroAberto}>
              <Wallet /><span className="rot">Financeiro</span>
              <ChevronDown size={16} style={{ transform: financeiroAberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {(financeiroAberto || recolhido) && <div className="nav-sub">{FINANCEIRO.map(itemNav)}</div>}
          </nav>
          <div className="lateral-rodape">
            {itemNav({ id: 'config', label: 'Configurações', icone: Settings })}
            <div className="bloco-loja some-recolhido">
              <span className="bloco-loja-icone"><Store size={19} /></span>
              <b>Loja virtual</b>
              <p>{lojaAtivos == null ? 'O catálogo do site é editado aqui.' : `${lojaAtivos} ${lojaAtivos === 1 ? 'produto no ar' : 'produtos no ar'} no site agora.`}</p>
              <a className="btn" href={URL_LOJA} target="_blank" rel="noreferrer">Abrir a loja <ExternalLink /></a>
            </div>
          </div>
        </aside>

        <div className="principal">
          <header className="topo">
            <div className="topo-dentro">
              <button className="btn-icone so-mobile" style={{ background: 'var(--superficie)', width: 44, height: 44 }} onClick={() => setMenuAberto(true)} aria-label="Abrir menu"><Menu /></button>
              <button className="busca-global" onClick={abrirBusca} aria-label="Buscar em todo o sistema">
                <Search size={18} /><span className="busca-texto">Buscar cliente, orçamento, OS…</span><span className="kbd so-desktop">{ehMac ? '⌘ K' : 'Ctrl K'}</span>
              </button>
              <div className="pilula-acoes">
                <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'} title={theme === 'light' ? 'Tema escuro' : 'Tema claro'}>
                  {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
                </button>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setSuspenso(suspenso === 'avisos' ? null : 'avisos')} aria-label={`Avisos: ${avisos.length}`} aria-expanded={suspenso === 'avisos'}>
                    <Bell size={19} />{avisos.length > 0 && <span className="contador">{avisos.length}</span>}
                  </button>
                  {suspenso === 'avisos' && (
                    <>
                      <div className="fecha-fora" onClick={() => setSuspenso(null)} />
                      <div className="suspenso" role="menu">
                        <div className="suspenso-cab">Avisos</div>
                        {avisos.length === 0 ? (
                          <div className="suspenso-item" style={{ cursor: 'default' }}><CheckCircle2 size={18} style={{ color: 'var(--ok)' }} /><span>Nada pendente<small>Sem vencidos, estoque em dia e agenda de hoje livre.</small></span></div>
                        ) : avisos.map(a => { const I = a.icone; return (
                          <button key={a.id} className="suspenso-item" role="menuitem" onClick={a.ir}><I size={18} style={{ color: 'var(--acento)' }} /><span>{a.titulo}<small>{a.sub}</small></span></button>
                        ); })}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setSuspenso(suspenso === 'conta' ? null : 'conta')} aria-label="Conta" aria-expanded={suspenso === 'conta'} style={{ padding: 0 }}>
                    <Avatar nome={nomeUsuario} />
                  </button>
                  {suspenso === 'conta' && (
                    <>
                      <div className="fecha-fora" onClick={() => setSuspenso(null)} />
                      <div className="suspenso" role="menu" style={{ width: 280 }}>
                        <div className="suspenso-item" style={{ cursor: 'default' }}><Avatar nome={nomeUsuario} /><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.user_metadata?.full_name || 'Conectado'}<small style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</small></span></div>
                        <button className="suspenso-item" role="menuitem" onClick={() => ir('config')}><Settings size={18} /><span>Configurações</span></button>
                        <button className="suspenso-item" role="menuitem" onClick={sair}><LogOut size={18} /><span>Sair</span></button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>
          <main className="conteudo">
            {pagina()}
          </main>
        </div>

        {fichaId && <FichaCliente clienteId={fichaId} onClose={() => setFichaId(null)} />}
        {buscaAberta && <BuscaGlobal onClose={() => setBuscaAberta(false)} />}
      </div>
    </NavCtx.Provider>
  );
};

/* ════════════════════════════════════════════════════════════════
                  RAIZ: sessão do Supabase + tema
   ════════════════════════════════════════════════════════════════ */
const Raiz = () => {
  const [theme, setThemeEstado] = useState(() => pref.ler('servigas-theme', 'light'));
  const [user, setUser] = useState(null);
  const [bootChecked, setBootChecked] = useState(false);
  const setTheme = (t) => { setThemeEstado(t); pref.gravar('servigas-theme', t); };

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  useEffect(() => {
    // Verifica sessão ativa no Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setBootChecked(true);
    });
    // Reage a login/logout e renova o token automaticamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => subscription.unsubscribe();
  }, []);

  const sair = async () => { await supabase.auth.signOut(); setUser(null); };

  if (!bootChecked) return null;
  if (!user) return <Login onLogin={setUser} />;
  return (
    <DataProvider userId={user.id}>
      <Shell user={user} theme={theme} setTheme={setTheme} sair={sair} />
    </DataProvider>
  );
};

const App = () => <ToastProvider><Raiz /></ToastProvider>;

export default App;
