import { useCallback, useEffect, useState } from 'react';
import {
  Search, Plus, Pencil, Trash2, School as SchoolIcon, Upload, FileSpreadsheet, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { TableSkeleton } from '../components/Loading';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const SITUACAO_OPTIONS = ['Ativa', 'Paralisada', 'Extinta'];
const DEPENDENCIA_OPTIONS = ['Federal', 'Estadual', 'Municipal', 'Privada'];

export default function Schools() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', situacao: '', page: 1, limit: 15 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const { data } = await api.get('/schools', { params });
      setItems(data.items); setPagination(data.pagination);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function remove(school) {
    if (!confirm(`Excluir a escola "${school.name}"?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/schools/${school._id}`);
      toast.success('Escola removida');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao remover');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Escolas</h1>
          <p className="text-sm text-slate-500">
            Importadas do Censo Escolar ou cadastradas manualmente.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setImportOpen(true)} className="btn-secondary">
              <Upload size={16}/> Importar Censo
            </button>
            <button onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary">
              <Plus size={16}/> Nova escola
            </button>
          </div>
        )}
      </div>

      <div className="card p-4 grid md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
          <input className="input pl-9" placeholder="Buscar por nome, INEP ou município..."
            value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value, page: 1 }))}/>
        </div>
        <select className="input" value={filters.situacao}
          onChange={e => setFilters(f => ({ ...f, situacao: e.target.value, page: 1 }))}>
          <option value="">Todas as situações</option>
          {SITUACAO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton cols={6}/> : items.length === 0 ? (
          <EmptyState
            title="Nenhuma escola encontrada"
            description={isAdmin
              ? 'Clique em "Importar Censo" para carregar todas, ou "Nova escola" para cadastrar manualmente.'
              : 'Solicite ao administrador para importar o Censo Escolar.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr>
                <th>INEP</th>
                <th>Nome</th>
                <th>Município</th>
                <th>Situação</th>
                <th>Dependência</th>
                {isAdmin && <th></th>}
              </tr></thead>
              <tbody>
                {items.map(s => (
                  <tr key={s._id}>
                    <td className="font-mono text-xs">{s.inep}</td>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <SchoolIcon size={14} className="text-brand-600 shrink-0"/>
                        {s.name}
                      </div>
                    </td>
                    <td>{s.municipio}</td>
                    <td>
                      <span className={`badge ${
                        s.situacao === 'Ativa' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : s.situacao === 'Paralisada' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}>{s.situacao}</span>
                    </td>
                    <td>{s.dependenciaAdm || '-'}</td>
                    {isAdmin && (
                      <td className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(s); setOpen(true); }}
                          className="btn-ghost p-1.5" title="Editar"><Pencil size={16}/></button>
                        <button onClick={() => remove(s)}
                          className="btn-ghost p-1.5 text-rose-500" title="Excluir"><Trash2 size={16}/></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pagination.page} totalPages={pagination.totalPages}
          onChange={p => setFilters(f => ({ ...f, page: p }))}/>
      </div>

      <SchoolForm
        open={open}
        onClose={() => setOpen(false)}
        school={editing}
        onSaved={() => { setOpen(false); load(); }}
      />

      <ImportCensoModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { setImportOpen(false); load(); }}
      />
    </div>
  );
}

// =============================================================
// Formulário de Cadastro / Edição
// =============================================================
function SchoolForm({ open, onClose, school, onSaved }) {
  const empty = {
    inep: '', name: '', municipio: 'Abaetetuba', uf: 'PA',
    situacao: 'Ativa', dependenciaAdm: 'Municipal', endereco: '',
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(school ? { ...empty, ...school } : empty);
    // eslint-disable-next-line
  }, [open, school]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e?.preventDefault();
    if (!form.inep.trim()) return toast.error('Informe o código INEP');
    if (!form.name.trim()) return toast.error('Informe o nome da escola');

    setSaving(true);
    try {
      const payload = { ...form };
      if (school) await api.put(`/schools/${school._id}`, payload);
      else        await api.post('/schools', payload);
      toast.success(school ? 'Escola atualizada' : 'Escola cadastrada com sucesso');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={school ? `Editar escola` : 'Cadastrar nova escola'}
      footer={<>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? 'Salvando...' : (school ? 'Salvar alterações' : 'Cadastrar')}
        </button>
      </>}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="label">Código INEP *</label>
            <input className="input font-mono" required placeholder="15064255"
              value={form.inep} onChange={e => set('inep', e.target.value.replace(/\D/g, ''))}/>
          </div>
          <div className="col-span-2">
            <label className="label">Nome da escola *</label>
            <input className="input" required placeholder="Ex.: E.M.E.I.F. José da Silva"
              value={form.name} onChange={e => set('name', e.target.value)}/>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="label">Município</label>
            <input className="input" value={form.municipio}
              onChange={e => set('municipio', e.target.value)}/>
          </div>
          <div>
            <label className="label">UF</label>
            <input className="input" maxLength={2} value={form.uf}
              onChange={e => set('uf', e.target.value.toUpperCase())}/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Situação</label>
            <select className="input" value={form.situacao}
              onChange={e => set('situacao', e.target.value)}>
              {SITUACAO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dependência administrativa</label>
            <select className="input" value={form.dependenciaAdm}
              onChange={e => set('dependenciaAdm', e.target.value)}>
              <option value="">—</option>
              {DEPENDENCIA_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Endereço</label>
          <input className="input" placeholder="Rua, número, bairro..."
            value={form.endereco} onChange={e => set('endereco', e.target.value)}/>
        </div>

        {!school && (
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            💡 <b>Dica:</b> escolas cadastradas manualmente ficam disponíveis na seleção de O.S. da mesma forma que as importadas do Censo.
          </p>
        )}
      </form>
    </Modal>
  );
}

// =============================================================
// Modal de Importação do Censo Escolar
// =============================================================
function ImportCensoModal({ open, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) { setFile(null); setResult(null); }
  }, [open]);

  async function send() {
    if (!file) return toast.error('Selecione um arquivo');
    setLoading(true); setResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await api.post('/schools/import/censo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data.result);
      toast.success(`Importação concluída: ${data.result.inserted} novas / ${data.result.updated} atualizadas`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro na importação');
    } finally { setLoading(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Importar Censo Escolar"
      footer={<>
        <button onClick={onClose} className="btn-secondary">Fechar</button>
        {result ? (
          <button onClick={onDone} className="btn-primary">Concluir</button>
        ) : (
          <button onClick={send} disabled={loading || !file} className="btn-primary">
            <Upload size={16}/> {loading ? 'Importando...' : 'Importar agora'}
          </button>
        )}
      </>}
    >
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-slate-700 dark:text-slate-200">
          <p className="font-semibold mb-1">📋 Como funciona</p>
          <ul className="list-disc ml-5 text-xs space-y-0.5">
            <li>Envie o arquivo do INEP (CSV ou XLSX)</li>
            <li>O sistema detecta automaticamente colunas <code>CO_ENTIDADE</code>, <code>NO_ENTIDADE</code> etc.</li>
            <li>Suporta arquivos com ou sem cabeçalho, e encoding Latin-1</li>
            <li>Escolas existentes (pelo INEP) são <b>atualizadas</b>, não duplicadas</li>
          </ul>
          <a
            href="https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar/resultados"
            target="_blank" rel="noreferrer"
            className="inline-block mt-2 text-xs text-brand-600 hover:underline"
          >
            ⬇ Onde baixar o arquivo do Censo
          </a>
        </div>

        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
          <FileSpreadsheet size={32} className="text-brand-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Selecione um arquivo .csv, .xlsx ou .xls
          </p>
          <input
            type="file" accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block mx-auto mt-3 text-sm"
          />
          {file && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              📎 <b>{file.name}</b> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {result && (
          <div className="card p-4 text-sm">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <CheckCircle2 size={16}/>
              <span className="font-semibold">Resultado da importação</span>
            </div>
            <ul className="space-y-1 text-slate-700 dark:text-slate-200">
              <li>Linhas no arquivo: <b>{result.totalRows}</b></li>
              <li>Novas escolas inseridas: <b className="text-emerald-600">{result.inserted}</b></li>
              <li>Escolas atualizadas: <b className="text-brand-600">{result.updated}</b></li>
              <li>Linhas ignoradas: <b>{result.skipped}</b></li>
            </ul>
            {result.errors?.length > 0 && (
              <pre className="mt-2 text-xs bg-rose-50 text-rose-700 p-2 rounded">{result.errors.join('\n')}</pre>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
