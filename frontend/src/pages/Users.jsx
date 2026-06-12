import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { TableSkeleton } from '../components/Loading';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import { ROLE_LABEL } from '../utils/format';

const ROLES = ['admin','tecnico','atendente'];

export default function Users() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', role: '', page: 1, limit: 10 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const { data } = await api.get('/users', { params });
      setItems(data.items); setPagination(data.pagination);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    if (!confirm('Remover usuário?')) return;
    await api.delete(`/users/${id}`); toast.success('Removido'); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usuários</h1>
          <p className="text-sm text-slate-500">Administre técnicos, atendentes e administradores.</p>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary"><Plus size={16}/> Novo usuário</button>
      </div>

      <div className="card p-4 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
          <input className="input pl-9" placeholder="Nome ou e-mail" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value, page: 1 }))}/>
        </div>
        <select className="input" value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value, page: 1 }))}>
          <option value="">Todos perfis</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton/> : (
          <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map(u => (
                <tr key={u._id}>
                  <td className="font-medium">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{u.active ? <span className="badge bg-emerald-100 text-emerald-700">Ativo</span> : <span className="badge bg-slate-200 text-slate-600">Inativo</span>}</td>
                  <td className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(u); setOpen(true); }} className="btn-ghost p-1.5"><Pencil size={16}/></button>
                    <button onClick={() => remove(u._id)} className="btn-ghost p-1.5 text-rose-500"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={p => setFilters(f => ({ ...f, page: p }))}/>
      </div>

      <UserForm open={open} onClose={() => setOpen(false)} user={editing} onSaved={() => { setOpen(false); load(); }}/>
    </div>
  );
}

function UserForm({ open, onClose, user, onSaved }) {
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'atendente', active:true, phone:'' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(user
      ? { name: user.name, email: user.email, role: user.role, active: user.active, phone: user.phone || '', password: '' }
      : { name:'', email:'', password:'', role:'atendente', active:true, phone:'' });
  }, [open, user]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (user && !payload.password) delete payload.password;
      if (user) await api.put(`/users/${user._id}`, payload);
      else await api.post('/users', payload);
      toast.success('Salvo'); onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={user ? 'Editar usuário' : 'Novo usuário'}
      footer={<><button onClick={onClose} className="btn-secondary">Cancelar</button><button onClick={submit} disabled={saving} className="btn-primary">Salvar</button></>}>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <div><label className="label">Nome *</label><input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></div>
        <div><label className="label">E-mail *</label><input type="email" required className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></div>
        <div>
          <label className="label">{user ? 'Nova senha (opcional)' : 'Senha *'}</label>
          <input type="password" required={!user} className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/>
        </div>
        <div>
          <label className="label">Perfil *</label>
          <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <div><label className="label">Telefone</label><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></div>
        <div className="flex items-center gap-2 mt-7">
          <input id="active" type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}/>
          <label htmlFor="active" className="text-sm">Ativo</label>
        </div>
      </form>
    </Modal>
  );
}
