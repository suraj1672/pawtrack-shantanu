import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { createNgo, fetchProfileWithNgo, updateNgo as apiUpdateNgo } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { migrateUserIdentity, upsertUser } from '@/lib/localStore';
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadUserState(userId: string) {
  return fetchProfileWithNgo(userId);
}

async function syncFirebaseUser(firebaseUser: FirebaseUser) {
  const syncedUser = migrateUserIdentity({
    fromEmail: firebaseUser.email || '',
    toUserId: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    phone: firebaseUser.phoneNumber || null,
    avatarUrl: firebaseUser.photoURL || null,
  });

  if (!syncedUser) {
    return upsertUser({
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      phone: firebaseUser.phoneNumber || null,
      avatarUrl: firebaseUser.photoURL || null,
    });
  }

  return syncedUser;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userNGO, setUserNGO] = useState<NGO | null>(null);
  const [loading, setLoading] = useState(true);

  const session = useMemo(
    () => (user ? { user: { id: user.id, email: user.email } } : null),
    [user]
  );

  const applyFirebaseUser = async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      setUser(null);
      setUserNGO(null);
      return;
    }

    await syncFirebaseUser(firebaseUser);
    const { user: profile, ngo } = await loadUserState(firebaseUser.uid);
    setUser(profile);
    setUserNGO(ngo);
  };

  useEffect(() => {
    let active = true;

    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error('Failed to set Firebase auth persistence', err);
    });

    const unsubscribe = onAuthStateChanged(auth, firebaseUser => {
      applyFirebaseUser(firebaseUser)
        .catch(err => {
          console.error('Failed to sync Firebase auth state', err);
          if (!active) return;
          setUser(null);
          setUserNGO(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    await syncFirebaseUser(firebaseUser);
    const { user: profile, ngo } = await loadUserState(firebaseUser.uid);
    setUser(profile);
    setUserNGO(ngo);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return true;
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    phone?: string
  ): Promise<boolean> => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }

    upsertUser({
      id: cred.user.uid,
      email: cred.user.email || email.trim(),
      name: name.trim() || email.trim().split('@')[0],
      phone: phone || null,
      avatarUrl: cred.user.photoURL || null,
    });

    await applyFirebaseUser({
      ...cred.user,
      displayName: name.trim() || cred.user.displayName,
    } as FirebaseUser);
    return true;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserNGO(null);
  };

  const createNGO = async (
    ngoData: Omit<NGO, 'id' | 'ownerId' | 'dogsCount'>
  ): Promise<NGO | null> => {
    const ownerId = user?.id || auth.currentUser?.uid;
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
    setUser(prev => (prev && prev.id === ownerId ? { ...prev, ngoId: ngo.id } : prev));
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
