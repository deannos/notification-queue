import { createContext, useContext, useState, type ReactNode } from 'react';
import { setToken, clearToken } from '../api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState(() => {
    const t = localStorage.getItem('nq_token') ?? '';
    if (t) setToken(t); // restore immediately so API calls on first render are authenticated
    return t;
  });
  const [user, setUser] = useState<User | null>(() => {
    const s = localStorage.getItem('nq_user');
    return s ? (JSON.parse(s) as User) : null;
  });

  function login(t: string, u: User) {
    setTokenState(t);
    setUser(u);
    setToken(t);
    localStorage.setItem('nq_token', t);
    localStorage.setItem('nq_user', JSON.stringify(u));
  }

  function logout() {
    setTokenState('');
    setUser(null);
    clearToken();
    localStorage.removeItem('nq_token');
    localStorage.removeItem('nq_user');
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
