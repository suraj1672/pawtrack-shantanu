import {
  DEFAULT_DOG_IMAGE,
  DEFAULT_NGO_LOGO,
  type CommunityPost,
  type Dog,
  type MedicalHistoryEntry,
  type MedicalRecord,
  type NGO,
  type User,
  type VitalHistory,
} from '@/types';

type StoredState = {
  users: User[];
  ngos: NGO[];
  dogs: Dog[];
  vitalHistory: VitalHistory[];
  medicalRecords: MedicalRecord[];
  medicalHistory: MedicalHistoryEntry[];
  communityPosts: CommunityPost[];
  communityLikes: Array<{ postId: string; userId: string }>;
  healthReports: Array<Record<string, unknown>>;
  chatConversations: Array<{ id: string; userId: string; dogId: string | null; title: string }>;
  chatMessages: Array<{ id: string; conversationId: string; role: 'user' | 'assistant'; content: string }>;
};

const STORAGE_KEY = 'sentriq-local-store-v1';

const seedState: StoredState = {
  users: [],
  ngos: [],
  dogs: [],
  vitalHistory: [],
  medicalRecords: [],
  medicalHistory: [],
  communityPosts: [],
  communityLikes: [],
  healthReports: [],
  chatConversations: [],
  chatMessages: [],
};

function cloneSeedState(): StoredState {
  return JSON.parse(JSON.stringify(seedState)) as StoredState;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeState(raw: Partial<StoredState> | null | undefined): StoredState {
  const state = raw || {};
  return {
    users: state.users || [],
    ngos: state.ngos || [],
    dogs: (state.dogs || []).map(dog => ({
      ...dog,
      imageUrl: dog.imageUrl || DEFAULT_DOG_IMAGE,
      lastSeen: dog.lastSeen ? new Date(dog.lastSeen) : null,
    })),
    vitalHistory: (state.vitalHistory || []).map(entry => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    })),
    medicalRecords: (state.medicalRecords || []).map(record => ({
      ...record,
      date: new Date(record.date),
    })),
    medicalHistory: state.medicalHistory || [],
    communityPosts: (state.communityPosts || []).map(post => ({
      ...post,
      createdAt: new Date(post.createdAt),
      tags: post.tags || [],
    })),
    communityLikes: state.communityLikes || [],
    healthReports: state.healthReports || [],
    chatConversations: state.chatConversations || [],
    chatMessages: state.chatMessages || [],
  };
}

export function readStore(): StoredState {
  if (!isBrowser()) return cloneSeedState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneSeedState();
  try {
    return normalizeState(JSON.parse(raw) as Partial<StoredState>);
  } catch {
    return cloneSeedState();
  }
}

export function writeStore(state: StoredState) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function updateStore<T>(updater: (state: StoredState) => T): T {
  const state = readStore();
  const result = updater(state);
  writeStore(state);
  return result;
}

export function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return readStore().users.find(user => user.email.trim().toLowerCase() === normalized) || null;
}

export function createUser(input: {
  id?: string;
  email: string;
  name: string;
  phone?: string | null;
}) {
  return updateStore(state => {
    const user: User = {
      id: input.id || createId('user'),
      email: input.email.trim().toLowerCase(),
      name: input.name,
      phone: input.phone || null,
      avatarUrl: null,
      role: 'owner',
      ngoId: null,
    };
    state.users.push(user);
    return user;
  });
}

export function upsertUser(input: {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
}) {
  return updateStore(state => {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingIndex = state.users.findIndex(user => user.id === input.id);

    if (existingIndex >= 0) {
      state.users[existingIndex] = {
        ...state.users[existingIndex],
        email: normalizedEmail,
        name: input.name || state.users[existingIndex].name,
        phone: input.phone ?? state.users[existingIndex].phone ?? null,
        avatarUrl: input.avatarUrl ?? state.users[existingIndex].avatarUrl ?? null,
      };
      return state.users[existingIndex];
    }

    const user: User = {
      id: input.id,
      email: normalizedEmail,
      name: input.name,
      phone: input.phone || null,
      avatarUrl: input.avatarUrl || null,
      role: 'owner',
      ngoId: null,
    };
    state.users.push(user);
    return user;
  });
}

export function updateUser(userId: string, updates: Partial<User>) {
  return updateStore(state => {
    const index = state.users.findIndex(user => user.id === userId);
    if (index === -1) return null;
    state.users[index] = { ...state.users[index], ...updates };
    return state.users[index];
  });
}

export function createNgoRecord(input: {
  name: string;
  description?: string;
  location?: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  ownerId: string;
}) {
  return updateStore(state => {
    const ngo: NGO = {
      id: createId('ngo'),
      name: input.name,
      description: input.description || '',
      location: input.location || '',
      email: input.email || '',
      phone: input.phone || '',
      logoUrl: input.logoUrl || DEFAULT_NGO_LOGO,
      ownerId: input.ownerId,
      dogsCount: 0,
    };
    state.ngos.push(ngo);
    return ngo;
  });
}

export function updateNgoRecord(ngoId: string, updates: Partial<NGO>) {
  return updateStore(state => {
    const index = state.ngos.findIndex(ngo => ngo.id === ngoId);
    if (index === -1) return null;
    state.ngos[index] = { ...state.ngos[index], ...updates };
    return state.ngos[index];
  });
}

export function migrateUserIdentity(input: {
  fromEmail: string;
  toUserId: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
}) {
  return updateStore(state => {
    const normalizedEmail = input.fromEmail.trim().toLowerCase();
    const existingIndex = state.users.findIndex(user => user.id === input.toUserId);
    const legacyIndex = state.users.findIndex(
      user => user.email.trim().toLowerCase() === normalizedEmail
    );

    if (existingIndex >= 0) {
      state.users[existingIndex] = {
        ...state.users[existingIndex],
        email: normalizedEmail,
        name: input.name || state.users[existingIndex].name,
        phone: input.phone ?? state.users[existingIndex].phone ?? null,
        avatarUrl: input.avatarUrl ?? state.users[existingIndex].avatarUrl ?? null,
      };
      return state.users[existingIndex];
    }

    if (legacyIndex === -1) {
      const user: User = {
        id: input.toUserId,
        email: normalizedEmail,
        name: input.name,
        phone: input.phone || null,
        avatarUrl: input.avatarUrl || null,
        role: 'owner',
        ngoId: null,
      };
      state.users.push(user);
      return user;
    }

    const legacyUser = state.users[legacyIndex];
    const oldUserId = legacyUser.id;
    const migratedUser: User = {
      ...legacyUser,
      id: input.toUserId,
      email: normalizedEmail,
      name: input.name || legacyUser.name,
      phone: input.phone ?? legacyUser.phone ?? null,
      avatarUrl: input.avatarUrl ?? legacyUser.avatarUrl ?? null,
    };
    state.users[legacyIndex] = migratedUser;

    state.ngos = state.ngos.map(ngo =>
      ngo.ownerId === oldUserId ? { ...ngo, ownerId: input.toUserId } : ngo
    );
    state.communityPosts = state.communityPosts.map(post =>
      post.userId === oldUserId ? { ...post, userId: input.toUserId } : post
    );
    state.communityLikes = state.communityLikes.map(like =>
      like.userId === oldUserId ? { ...like, userId: input.toUserId } : like
    );
    state.chatConversations = state.chatConversations.map(conversation =>
      conversation.userId === oldUserId
        ? { ...conversation, userId: input.toUserId }
        : conversation
    );
    state.healthReports = state.healthReports.map(report => {
      if (report.generatedBy === oldUserId) {
        return { ...report, generatedBy: input.toUserId };
      }
      if (report.userId === oldUserId) {
        return { ...report, userId: input.toUserId };
      }
      return report;
    });

    return migratedUser;
  });
}
