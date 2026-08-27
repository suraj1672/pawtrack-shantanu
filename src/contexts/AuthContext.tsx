import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createNgo, fetchProfileWithNgo, updateNgo as apiUpdateNgo } from '@/lib/api';
import { createUser, findStoredUserWithPassword } from '@/lib/localStore';
import type { NGO, User } from '@/types';

interface AuthContextType {
  user: User | null;
  userNGO: NGO | null;
  session: { user: { id: string; email: string } } | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string, phone?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  createNGO: (ngo: Omit<NGO, 'id' | 'ownerId' | 'dogsCount'>) => Promise<NGO | null>;
  updateNGO: (ngo: Partial<NGO>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const SESSION_KEY = 'sentriq-auth-session';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readSessionUserId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SESSION_KEY);
}

function writeSessionUserId(userId: string | null) {
  if (typeof window === 'undefined') return;
  if (userId) {
    window.localStorage.setItem(SESSION_KEY, userId);
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

async function loadUserState(userId: string) {
  return fetchProfileWithNgo(userId);
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userNGO, setUserNGO] = useState<NGO | null>(null);
  const [loading, setLoading] = useState(true);

  const session = useMemo(
    () => (user ? { user: { id: user.id, email: user.email } } : null),
    [user]
  );

  const applyUser = async (userId: string | null) => {
    if (!userId) {
      setUser(null);
      setUserNGO(null);
      return;
    }

    const { user: profile, ngo } = await loadUserState(userId);
    setUser(profile);
    setUserNGO(ngo);
  };

  useEffect(() => {
    const userId = readSessionUserId();
    applyUser(userId)
      .catch(err => {
        console.error('Failed to restore session', err);
        writeSessionUserId(null);
        setUser(null);
        setUserNGO(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshProfile = async () => {
    const userId = readSessionUserId();
    if (!userId) return;
    const { user: profile, ngo } = await loadUserState(userId);
    setUser(profile);
    setUserNGO(ngo);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const storedUser = findStoredUserWithPassword(email);
    if (!storedUser || storedUser.password !== password) {
      throw new Error('Invalid email or password.');
    }

    writeSessionUserId(storedUser.id);
    await applyUser(storedUser.id);
    return true;
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    phone?: string
  ): Promise<boolean> => {
    const existing = findStoredUserWithPassword(email);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const created = createUser({ email, password, name, phone: phone || null });
    writeSessionUserId(created.id);
    await applyUser(created.id);
    return true;
  };

  const logout = async () => {
    writeSessionUserId(null);
    setUser(null);
    setUserNGO(null);
  };

  const createNGO = async (
    ngoData: Omit<NGO, 'id' | 'ownerId' | 'dogsCount'>
  ): Promise<NGO | null> => {
    if (!user?.id) return null;

    const ngo = await createNgo({
      name: ngoData.name,
      description: ngoData.description,
      location: ngoData.location,
      email: ngoData.email,
      phone: ngoData.phone,
      logoUrl: ngoData.logoUrl,
      ownerId: user.id,
    });

    setUserNGO(ngo);
    setUser(prev => (prev ? { ...prev, ngoId: ngo.id } : prev));
    return ngo;
  };

  const updateNGO = async (updates: Partial<NGO>) => {
    if (!userNGO) return;
    const ngo = await apiUpdateNgo(userNGO.id, updates);
    setUserNGO(ngo);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userNGO,
        session,
        loading,
        isAuthenticated: Boolean(user),
        login,
        signup,
        logout,
        createNGO,
        updateNGO,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
