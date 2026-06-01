import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, Lock, User as UserIcon, Phone, Mail, Save, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import AvatarCropper from '../components/AvatarCropper';
import { ROLE_LABEL } from '../utils/format';

export default function Profile() {
  const { user, reload, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null); // arquivo aguardando recorte

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('O nome é obrigatório');
    setSavingProfile(true);
    try {
      await api.put('/users/me/profile', { name: name.trim(), phone: phone.trim() });
      toast.success('Perfil atualizado');
      reload?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally { setSavingProfile(false); }
  }

  function pickFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Selecione uma imagem');
    if (file.size > 10 * 1024 * 1024) return toast.error('Imagem muito grande (máx 10MB)');
    setCropFile(file); // abre o cropper
  }

  async function uploadCropped(croppedFile) {
    setUploading(true);
    setCropFile(null);
    try {
      const fd = new FormData();
      fd.append('file', croppedFile);
      const { data } = await api.post('/users/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Cache-buster na URL — força o navegador a baixar a imagem nova
      const freshUrl = data.user.avatarUrl
        ? `${data.user.avatarUrl}${data.user.avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
        : '';
      // Atualiza o user em memória IMEDIATAMENTE
      updateUser({ ...data.user, avatarUrl: freshUrl });
      toast.success('Foto atualizada!');
      // E também busca do backend pra garantir consistência
      reload?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao enviar foto');
    } finally { setUploading(false); }
  }

  async function removeAvatar() {
    if (!confirm('Remover sua foto de perfil?')) return;
    try {
      const { data } = await api.delete('/users/me/avatar');
      updateUser(data.user);
      toast.success('Foto removida');
      reload?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro');
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return toast.error('Preencha todos os campos');
    if (newPassword !== confirmPassword) return toast.error('A confirmação não confere');
    if (newPassword.length < 6) return toast.error('Mínimo 6 caracteres');

    setSavingPassword(true);
    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      toast.success('Senha alterada com sucesso');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao alterar senha');
    } finally { setSavingPassword(false); }
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meu Perfil</h1>
        <p className="text-sm text-slate-500">Atualize sua foto, dados de contato e senha.</p>
      </div>

      {/* === Foto de perfil === */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Camera size={18} className="text-pref-azul-600"/> Foto de perfil
        </h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar
              src={user.avatarUrl}
              name={user.name}
              role={user.role}
              size={112}
              ring
              className="shadow-soft"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-pref-azul-600 hover:bg-pref-azul-700 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-slate-900 transition"
              title="Trocar foto"
            >
              <Camera size={16}/>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>

          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-white text-lg">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
            <p className="text-xs text-slate-400 mt-1">{ROLE_LABEL[user.role]}</p>

            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary text-sm"
              >
                <Camera size={14}/> {uploading ? 'Enviando...' : (user.avatarUrl ? 'Trocar foto' : 'Adicionar foto')}
              </button>
              {user.avatarUrl && (
                <button onClick={removeAvatar} className="btn-ghost text-sm text-rose-600">
                  <Trash2 size={14}/> Remover
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Aceita JPG, PNG, WebP. Tamanho máximo: 5 MB.
            </p>
          </div>
        </div>
      </div>

      {/* === Dados pessoais === */}
      <form onSubmit={saveProfile} className="card p-6">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <UserIcon size={18} className="text-pref-azul-600"/> Dados pessoais
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome completo *</label>
            <input className="input" required value={name} onChange={e => setName(e.target.value)}/>
          </div>
          <div>
            <label className="label">E-mail (não editável)</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-2.5 text-slate-400"/>
              <input className="input pl-9 opacity-60 cursor-not-allowed" disabled value={user.email}/>
            </div>
          </div>
          <div>
            <label className="label">Telefone</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-2.5 text-slate-400"/>
              <input className="input pl-9" placeholder="(91) 9 0000-0000"
                value={phone} onChange={e => setPhone(e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="label">Perfil</label>
            <input className="input opacity-60 cursor-not-allowed" disabled value={ROLE_LABEL[user.role] || user.role}/>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={savingProfile} className="btn-primary">
            <Save size={16}/> {savingProfile ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>

      {/* === Trocar senha === */}
      <form onSubmit={savePassword} className="card p-6">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <KeyRound size={18} className="text-pref-azul-600"/> Alterar senha
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Senha atual</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-2.5 text-slate-400"/>
              <input type="password" className="input pl-9"
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="label">Nova senha (mín. 6 caracteres)</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-2.5 text-slate-400"/>
              <input type="password" className="input pl-9"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="label">Confirmar nova senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-2.5 text-slate-400"/>
              <input type="password" className="input pl-9"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={savingPassword} className="btn-primary">
            <KeyRound size={16}/> {savingPassword ? 'Alterando...' : 'Alterar senha'}
          </button>
        </div>
      </form>

      <AvatarCropper
        open={!!cropFile}
        file={cropFile}
        onClose={() => setCropFile(null)}
        onConfirm={uploadCropped}
      />
    </div>
  );
}