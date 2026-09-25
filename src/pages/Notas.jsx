// ============================================================================
// NOTAS FISCAIS (com PDF anexado)
// ============================================================================
import { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Eye, Paperclip, FileText } from 'lucide-react';
import * as db from '../lib/db';
import { useData, useToast } from '../contexto';
import { fmtBRL, fmtDate, hojeISO, contem } from '../lib/format';
import { PageHeader, BuscaPagina, Modal, Field, Vazio, Selo } from '../components/ui';

const Notas = ({ search, setSearch }) => {
  const { data, recarregar } = useData();
  const toast = useToast();
  const vazio = () => ({ numero: '', fornecedor: '', valor: 0, data: hojeISO(), obs: '', pdfRef: null });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(vazio);
  const [pdfFile, setPdfFile] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef(null);

  const abrir = (n) => { setForm(n || vazio()); setPdfFile(null); setModal(n ? 'edit' : 'new'); };

  const salvar = async () => {
    if (!String(form.numero).trim()) { toast('Informe o número da nota', 'error'); return; }
    setSalvando(true);
    let nota;
    if (modal === 'edit') { await db.atualizarNota(form.id, form); nota = form; }
    else { const { data: nova, error } = await db.inserirNota(form); if (error) { setSalvando(false); toast('Não foi possível salvar: ' + error.message, 'error'); return; } nota = nova; }
    // Upload do PDF para o Storage, se houver
    if (pdfFile && nota?.id) {
      const { path, error } = await db.uploadPdfNota(pdfFile, nota.id);
      if (path) await db.atualizarNota(nota.id, { ...form, pdfRef: path });
      if (error) toast('O PDF não subiu: ' + error.message, 'error');
    }
    await recarregar();
    setSalvando(false);
    setModal(null);
  };

  const remover = async (n) => {
    if (!confirm(`Remover a nota nº ${n.numero}?`)) return;
    await db.removerNota(n.id);
    await recarregar();
  };

  const verPdf = async (pdfRef) => {
    const url = await db.urlAssinada('notas-pdf', pdfRef);
    if (url) window.open(url, '_blank');
    else toast('Não consegui abrir o PDF', 'error');
  };

  const onPdfChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast('O PDF deve ter no máximo 4 MB', 'error'); return; }
    setPdfFile(f);
  };

  const filtrados = data.notas.filter(n => contem(`${n.numero} ${n.fornecedor} ${n.obs}`, search));
  const total = filtrados.reduce((s, n) => s + n.valor, 0);

  return (
    <>
      <PageHeader titulo="Notas fiscais" sub={`${data.notas.length} notas · ${fmtBRL(total)}${search ? ' na busca' : ' no total'}`}>
        <button className="btn btn-preto" onClick={() => abrir(null)}><Plus /> Nova nota</button>
      </PageHeader>

      <div className="barra">
        <BuscaPagina value={search} onChange={setSearch} placeholder="Buscar número ou fornecedor" />
      </div>

      {filtrados.length === 0 ? (
        <div className="cartao">
          <Vazio icone={FileText} titulo={data.notas.length ? 'Nenhuma nota encontrada' : 'Nenhuma nota ainda'}
            texto={data.notas.length ? 'Tente outro número ou fornecedor.' : 'Guarde aqui as notas de compra com o PDF anexado. As notas emitidas em vendas e orçamentos também aparecem nesta lista.'} />
        </div>
      ) : (
        <div className="tabela-caixa">
          <table className="tabela">
            <thead><tr><th>Nº</th><th>Fornecedor / cliente</th><th>Data</th><th className="dir">Valor</th><th className="centro">PDF</th><th><span className="oculto-visual">Ações</span></th></tr></thead>
            <tbody>
              {filtrados.map(n => (
                <tr key={n.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{n.numero}</td>
                  <td><div style={{ fontWeight: 500 }}>{n.fornecedor}</div>{n.obs && <div className="t3 limite-2" style={{ fontSize: 12.5, maxWidth: 420 }}>{n.obs}</div>}</td>
                  <td className="t2 num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(n.data)}</td>
                  <td className="dir num" style={{ fontWeight: 600 }}>{fmtBRL(n.valor)}</td>
                  <td className="centro">
                    {n.pdfRef
                      ? <button className="btn-icone" onClick={() => verPdf(n.pdfRef)} title="Abrir PDF" aria-label={`Abrir PDF da nota ${n.numero}`}><Eye /></button>
                      : <Selo tom="neutro">sem PDF</Selo>}
                  </td>
                  <td className="acoes-linha">
                    <button className="btn-icone" onClick={() => abrir(n)} title="Editar" aria-label={`Editar nota ${n.numero}`}><Edit2 /></button>
                    <button className="btn-icone perigo" onClick={() => remover(n)} title="Remover" aria-label={`Remover nota ${n.numero}`}><Trash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar nota' : 'Nova nota'}
        rodape={<><button className="btn btn-contorno" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-preto" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button></>}>
        <div className="grade-form">
          <Field label="Número" span={6}><input className="campo mono" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} /></Field>
          <Field label="Data" span={6}><input type="date" className="campo" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></Field>
          <Field label="Fornecedor" span={12}><input className="campo" value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} /></Field>
          <Field label="Valor (R$)" span={12}><input type="number" step="0.01" className="campo num" value={form.valor} onChange={e => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Observações" span={12}><textarea className="campo" rows="2" value={form.obs || ''} onChange={e => setForm({ ...form, obs: e.target.value })} /></Field>
          <Field label="PDF da nota (máx. 4 MB)" span={12}>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onPdfChange} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-suave btn-sm" onClick={() => fileRef.current?.click()}><Paperclip /> {form.pdfRef || pdfFile ? 'Trocar PDF' : 'Escolher PDF'}</button>
              {pdfFile && <span className="t2" style={{ fontSize: 13 }}>{pdfFile.name}</span>}
              {form.pdfRef && !pdfFile && <button type="button" className="btn btn-contorno btn-sm" onClick={() => verPdf(form.pdfRef)}><Eye /> Ver o atual</button>}
            </div>
          </Field>
        </div>
      </Modal>
    </>
  );
};

export default Notas;
