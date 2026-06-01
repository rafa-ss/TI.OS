import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('os_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      // Cache-buster: força o navegador a buscar do servidor sempre
      const { data } = await api.get('/auth/me', {
        params: { _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache' },
      });
      setUser(data.user);
    } catch {
      localStorage.removeItem('os_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('os_token', data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('os_token');
    setUser(null);
    window.location.href = '/login';
  }

  const hasRole = (...roles) => user && roles.includes(user.role);

  /**
   * Atualiza o usuário em memória imediatamente (sem ir ao backend).
   * Usado quando já temos a resposta nova vinda de uma ação (ex.: upload de avatar).
   */
  function updateUser(partial) {
    setUser((u) => (u ? { ...u, ...partial } : u));
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, hasRole,
      reload: loadMe,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
