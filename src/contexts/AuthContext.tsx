import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db } from '@/lib/supabase';
import { createNgo, fetchProfileWithNgo, updateNgo as apiUpdateNgo } from '@/lib/api';
import type { NGO, User } from '@/types';

interface AuthContextType {
  user: User | null;
  userNGO: NGO | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string, phone?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  createNGO: (ngo: Omit<NGO, 'id' | 'ownerId' | 'dogsCount'>) => Promise<NGO | null>;
  updateNGO: (ngo: Partial<NGO>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadUserState(userId: string) {
  return fetchProfileWithNgo(userId);
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userNGO, setUserNGO] = useState<NGO | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setUser(null);
      setUserNGO(null);
      return;
    }
    try {
      const { user: profile, ngo } = await loadUserState(nextSession.user.id);
      setUser(profile);
      setUserNGO(ngo);
    } catch (err) {
      console.error('Failed to load profile', err);
      setUser({
        id: nextSession.user.id,
        email: nextSession.user.email || '',
        name: nextSession.user.user_metadata?.name || '',
        role: 'owner',
        ngoId: null,
      });
      setUserNGO(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    db.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      applySession(data.session).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    const { data: listener } = db.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!session?.user) return;
    const { user: profile, ngo } = await loadUserState(session.user.id);
    setUser(profile);
    setUserNGO(ngo);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await db.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    await applySession(data.session);
    return true;
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    phone?: string
  ): Promise<boolean> => {
    const { data, error } = await db.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name, phone: phone || null },
      },
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error(
        'Account created, but email confirmation is required. Confirm your email, then sign in. For local setup, disable email confirmation in Auth settings.'
      );
    }
    await applySession(data.session);
    return true;
  };

  const logout = async () => {
    await db.auth.signOut();
    setUser(null);
    setUserNGO(null);
    setSession(null);
  };

  const createNGO = async (
    ngoData: Omit<NGO, 'id' | 'ownerId' | 'dogsCount'>
  ): Promise<NGO | null> => {
    const ownerId = user?.id || session?.user?.id;
    if (!ownerId) return null;

    const ngo = await createNgo({
      name: ngoData.name,
      description: ngoData.description,
      location: ngoData.location,
      email: ngoData.email,
      phone: ngoData.phone,
      logoUrl: ngoData.logoUrl,
      ownerId,
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
        isAuthenticated: !!session || !!user,
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
