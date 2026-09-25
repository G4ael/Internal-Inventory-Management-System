import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import * as db from './lib/db';
import { uid } from './lib/format';
import { ToastCtx, DataCtx } from './contexto';

/* ────────────── Avisos (toasts) ────────────── */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, tipo = 'info') => {
    const id = uid();
    setToasts(t => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);
  const Icone = { success: CheckCircle2, error: AlertCircle, info: Info };
  const classe = { success: 'ok', error: 'erro', info: 'info' };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => {
          const I = Icone[t.tipo] || Info;
          return <div key={t.id} className={`toast ${classe[t.tipo] || 'info'}`}><I /> <span>{t.msg}</span></div>;
        })}
      </div>
    </ToastCtx.Provider>
  );
};

/* ────────────── Dados do banco ──────────────
   Centraliza a carga do Supabase e as ações que mexem no estoque.
   Só monta depois do login, então a primeira carga já vem autenticada. */
const CONFIG_PADRAO = {
  zapi_url: '', zapi_token: '', whatsapp_grupo_id: '', auto_enviar_whatsapp: false,
  plugnotas_url: 'https://api.plugnotas.com.br', plugnotas_token: '', auto_gerar_nf: false,
  emitente_razao: '', emitente_cnpj: '', emitente_inscricao: ''
};
const VAZIO = {
  produtos: [], clientes: [], tabelaPrecos: [], servicos: [], orcamentos: [], notas: [],
  movimentacoes: [], vendas: [], config: CONFIG_PADRAO, contadores: { venda: 1000 }
};
const completar = (d) => ({ ...d, config: { ...CONFIG_PADRAO, ...d.config } });

export const DataProvider = ({ userId, children }) => {
  const [data, setData] = useState(VAZIO);
  const [loaded, setLoaded] = useState(false);

  // Recarrega tudo do banco. Chamado após cada mutação.
  const recarregar = useCallback(async () => {
    const fresh = await db.carregarTudo();
    setData(completar(fresh));
    setLoaded(true);
  }, []);

  useEffect(() => {
    let vivo = true;
    db.carregarTudo().then(fresh => { if (vivo) { setData(completar(fresh)); setLoaded(true); } });
    return () => { vivo = false; };
  }, [userId]);

  /* O estoque é movimentado pelos TRIGGERS do banco, não aqui. */
  const registrarMovimentacao = useCallback(async (produtoId, tipo, qtd, motivo) => {
    await db.lancarMovimentacao(produtoId, tipo, qtd, motivo);
    await recarregar();
  }, [recarregar]);

  // Salva OS (insert ou update). Devolve { error } se o banco recusar.
  const salvarOS = useCallback(async (os, isEdit) => {
    const res = isEdit ? await db.atualizarOS(os) : await db.inserirOS(os);
    await recarregar();
    return res || {};
  }, [recarregar]);

  const removerOS = useCallback(async (id) => {
    await db.removerOS(id);
    await recarregar();
  }, [recarregar]);

  return (
    <DataCtx.Provider value={{ data, setData, loaded, recarregar, registrarMovimentacao, salvarOS, removerOS }}>
      {children}
    </DataCtx.Provider>
  );
};
