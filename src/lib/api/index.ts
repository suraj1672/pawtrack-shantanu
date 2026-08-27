import {
  DEFAULT_DOG_IMAGE,
  type CommunityPost,
  type Dog,
  type MedicalHistoryCategory,
  type MedicalHistoryEntry,
  type MedicalRecord,
  type MedicalRecordType,
  type NGO,
  type ReportPeriod,
  type User,
  type VitalHistory,
} from '@/types';
import { readStore, updateStore, updateUser, createNgoRecord } from '@/lib/localStore';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortNewestFirst<T>(items: T[], getTime: (item: T) => number) {
  return [...items].sort((a, b) => getTime(b) - getTime(a));
}

function assertFileReaderSupport() {
  if (typeof FileReader === 'undefined') {
    throw new Error('File uploads are only supported in the browser.');
  }
}

async function fileToDataUrl(file: File) {
  assertFileReaderSupport();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function fetchProfileWithNgo(userId: string): Promise<{ user: User; ngo: NGO | null }> {
  const state = readStore();
  const rawUser = (state.users as Array<User & { password?: string }>).find(user => user.id === userId);
  if (!rawUser) {
    throw new Error('User not found.');
  }

  const { password: _password, ...user } = rawUser;
  const ngo = state.ngos.find(item => item.id === user.ngoId) || null;
  return { user, ngo };
}

export async function createNgo(input: {
  name: string;
  description?: string;
  location?: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  ownerId: string;
}): Promise<NGO> {
  const ngo = createNgoRecord(input);
  updateUser(input.ownerId, { ngoId: ngo.id });
  return ngo;
}

export async function updateNgo(ngoId: string, updates: Partial<NGO>): Promise<NGO> {
  const ngo = updateStore(state => {
    const index = state.ngos.findIndex(item => item.id === ngoId);
    if (index === -1) {
      throw new Error('NGO not found.');
    }
    state.ngos[index] = { ...state.ngos[index], ...updates };
    return state.ngos[index];
  });
  return ngo;
}

export async function fetchDogsByNgo(ngoId: string): Promise<Dog[]> {
  const state = readStore();
  return sortNewestFirst(
    state.dogs.filter(dog => dog.ngoId === ngoId),
    dog => {
      const timestamp = dog.lastSeen instanceof Date ? dog.lastSeen.getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    }
  );
}

export async function fetchDogById(dogId: string): Promise<Dog | null> {
  return readStore().dogs.find(dog => dog.id === dogId) || null;
}

export async function createDog(input: {
  ngoId: string;
  name: string;
  species: string;
  breed?: string;
  deviceId: string;
  age?: string;
  weight?: string;
  imageUrl?: string;
  createdBy: string;
}): Promise<Dog> {
  return updateStore(state => {
    const duplicate = state.dogs.find(
      dog => dog.ngoId === input.ngoId && dog.deviceId.toLowerCase() === input.deviceId.toLowerCase()
    );
    if (duplicate) {
      throw new Error('This collar ID is already assigned to another dog.');
    }

    const dog: Dog = {
      id: createId('dog'),
      ngoId: input.ngoId,
      name: input.name,
      species: input.species,
      breed: input.breed || input.species,
      deviceId: input.deviceId.trim(),
      age: input.age || '',
      weight: input.weight || '',
      imageUrl: input.imageUrl || DEFAULT_DOG_IMAGE,
      status: 'offline',
      lastSeen: null,
      hasAlert: false,
      alertMessage: null,
    };
    state.dogs.unshift(dog);

    const ngoIndex = state.ngos.findIndex(ngo => ngo.id === input.ngoId);
    if (ngoIndex >= 0) {
      state.ngos[ngoIndex] = {
        ...state.ngos[ngoIndex],
        dogsCount: state.dogs.filter(item => item.ngoId === input.ngoId).length,
      };
    }

    return dog;
  });
}

export async function updateDog(
  dogId: string,
  updates: Partial<{
    name: string;
    species: string;
    breed: string;
    deviceId: string;
    age: string;
    weight: string;
    imageUrl: string;
    status: Dog['status'];
    hasAlert: boolean;
    alertMessage: string | null;
    lastSeen: string | null;
  }>
): Promise<Dog> {
  return updateStore(state => {
    const index = state.dogs.findIndex(dog => dog.id === dogId);
    if (index === -1) {
      throw new Error('Dog not found.');
    }
    const current = state.dogs[index];
    const next: Dog = {
      ...current,
      ...updates,
      lastSeen:
        updates.lastSeen === undefined
          ? current.lastSeen
          : updates.lastSeen
            ? new Date(updates.lastSeen)
            : null,
    };
    state.dogs[index] = next;
    return next;
  });
}

export async function deleteDog(dogId: string): Promise<void> {
  updateStore(state => {
    const dog = state.dogs.find(item => item.id === dogId);
    state.dogs = state.dogs.filter(item => item.id !== dogId);
    state.vitalHistory = state.vitalHistory.filter(item => item.id !== dogId && item.id?.split(':')[0] !== dogId);
    state.medicalRecords = state.medicalRecords.filter(item => item.dogId !== dogId);
    state.medicalHistory = state.medicalHistory.filter(item => item.dogId !== dogId);
    if (dog) {
      const ngoIndex = state.ngos.findIndex(ngo => ngo.id === dog.ngoId);
      if (ngoIndex >= 0) {
        state.ngos[ngoIndex] = {
          ...state.ngos[ngoIndex],
          dogsCount: state.dogs.filter(item => item.ngoId === dog.ngoId).length,
        };
      }
    }
  });
}

export async function createDogAlert(input: {
  dogId: string;
  ngoId: string;
  severity: 'warning' | 'critical';
  message: string;
  vitalType?: string;
  vitalValue?: number;
}): Promise<void> {
  await updateDog(input.dogId, {
    hasAlert: true,
    alertMessage: input.message,
    status: input.severity === 'critical' ? 'critical' : 'warning',
    lastSeen: new Date().toISOString(),
  });
}

export async function resolveDogAlerts(dogId: string): Promise<void> {
  await updateDog(dogId, {
    hasAlert: false,
    alertMessage: null,
    status: 'online',
    lastSeen: new Date().toISOString(),
  });
}

export async function insertVitalReading(input: {
  dogId: string;
  deviceId: string;
  temperature?: number;
  heartRate?: number;
  spo2?: number;
  activity?: string;
  speedKmph?: number;
  latitude?: number;
  longitude?: number;
  sats?: number;
  batteryLevel?: number | null;
  recordedAt?: Date;
}): Promise<void> {
  const recordedAt = input.recordedAt || new Date();
  updateStore(state => {
    state.vitalHistory.push({
      id: `${input.dogId}:${recordedAt.getTime()}`,
      timestamp: recordedAt,
      temperature: input.temperature ?? 0,
      heartRate: input.heartRate ?? 0,
      activity: input.activity || 'Resting',
      spo2: input.spo2 ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    });
  });
}

export async function fetchVitalHistory(
  dogId: string,
  days: number
): Promise<VitalHistory[]> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return readStore()
    .vitalHistory.filter(
      item => item.id?.startsWith(`${dogId}:`) && item.timestamp.getTime() >= since
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export async function fetchMedicalRecords(dogId: string): Promise<MedicalRecord[]> {
  return sortNewestFirst(
    readStore().medicalRecords.filter(record => record.dogId === dogId),
    record => record.date.getTime()
  );
}

export async function uploadMedicalRecord(input: {
  dogId: string;
  ngoId: string;
  type: MedicalRecordType;
  title: string;
  notes?: string;
  file: File;
  uploadedBy: string;
}): Promise<MedicalRecord> {
  const fileUrl = await fileToDataUrl(input.file);
  return updateStore(state => {
    const record: MedicalRecord = {
      id: createId('record'),
      dogId: input.dogId,
      ngoId: input.ngoId,
      type: input.type,
      title: input.title,
      notes: input.notes || '',
      fileUrl,
      fileName: input.file.name,
      date: new Date(),
    };
    state.medicalRecords.unshift(record);
    return record;
  });
}

export async function fetchMedicalHistory(dogId: string): Promise<MedicalHistoryEntry[]> {
  return readStore().medicalHistory.filter(entry => entry.dogId === dogId);
}

export async function createMedicalHistory(input: {
  dogId: string;
  ngoId: string;
  category: MedicalHistoryCategory;
  title: string;
  description: string;
  diagnosis?: string;
  treatment?: string;
  veterinarian?: string;
  occurredOn?: string;
  isChronic?: boolean;
  createdBy: string;
}): Promise<MedicalHistoryEntry> {
  return updateStore(state => {
    const entry: MedicalHistoryEntry = {
      id: createId('history'),
      dogId: input.dogId,
      ngoId: input.ngoId,
      category: input.category,
      title: input.title,
      description: input.description,
      diagnosis: input.diagnosis || null,
      treatment: input.treatment || null,
      veterinarian: input.veterinarian || null,
      occurredOn: input.occurredOn || new Date().toISOString().slice(0, 10),
      isChronic: input.isChronic ?? false,
    };
    state.medicalHistory.unshift(entry);
    return entry;
  });
}

export async function fetchCommunityPosts(): Promise<CommunityPost[]> {
  const state = readStore();
  const posts = state.communityPosts.map(post => {
    const user = state.users.find(item => item.id === post.userId);
    const ngo = post.ngoId ? state.ngos.find(item => item.id === post.ngoId) : null;
    return {
      ...post,
      userName: user?.name || post.userName || 'Member',
      userAvatar: user?.avatarUrl || post.userAvatar || '',
      ngoName: ngo?.name || post.ngoName || 'Independent',
      likes: state.communityLikes.filter(like => like.postId === post.id).length,
      likedByMe: post.likedByMe || false,
    };
  });
  return sortNewestFirst(posts, post => post.createdAt.getTime());
}

export async function createCommunityPost(input: {
  userId: string;
  ngoId?: string | null;
  title: string;
  content: string;
  tags?: string[];
}): Promise<void> {
  updateStore(state => {
    const user = state.users.find(item => item.id === input.userId);
    const ngo = input.ngoId ? state.ngos.find(item => item.id === input.ngoId) : null;
    state.communityPosts.unshift({
      id: createId('post'),
      userId: input.userId,
      userName: user?.name || 'Member',
      userAvatar: user?.avatarUrl || '',
      ngoName: ngo?.name || 'Independent',
      ngoId: input.ngoId || null,
      title: input.title,
      content: input.content,
      likes: 0,
      comments: 0,
      createdAt: new Date(),
      tags: input.tags || [],
      likedByMe: false,
    });
  });
}

export async function togglePostLike(postId: string, userId: string, liked: boolean): Promise<void> {
  updateStore(state => {
    if (liked) {
      state.communityLikes = state.communityLikes.filter(
        like => !(like.postId === postId && like.userId === userId)
      );
      return;
    }
    const exists = state.communityLikes.some(like => like.postId === postId && like.userId === userId);
    if (!exists) {
      state.communityLikes.push({ postId, userId });
    }
  });
}

export async function createChatConversation(userId: string, dogId?: string | null) {
  return updateStore(state => {
    const conversation = {
      id: createId('conversation'),
      userId,
      dogId: dogId || null,
      title: 'Dog Health Chat',
    };
    state.chatConversations.push(conversation);
    return conversation;
  });
}

export async function saveChatMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
  return updateStore(state => {
    const message = {
      id: createId('message'),
      conversationId,
      role,
      content,
    };
    state.chatMessages.push(message);
    return message;
  });
}

export async function fetchChatMessages(conversationId: string) {
  return readStore().chatMessages.filter(message => message.conversationId === conversationId);
}

export async function saveHealthReport(input: {
  dogId: string;
  ngoId: string;
  generatedBy: string;
  periodType: ReportPeriod;
  periodStart: string;
  periodEnd: string;
  summary: Record<string, unknown>;
}): Promise<void> {
  updateStore(state => {
    state.healthReports.push({
      id: createId('report'),
      ...input,
      createdAt: new Date().toISOString(),
    });
  });
}
