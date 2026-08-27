import { db } from '@/lib/supabase';
import { mapDog, mapMedicalHistory, mapMedicalRecord, mapNgo, mapProfile, mapVital } from '@/lib/mappers';
import type {
  CommunityPost,
  Dog,
  MedicalHistoryCategory,
  MedicalHistoryEntry,
  MedicalRecord,
  MedicalRecordType,
  NGO,
  ReportPeriod,
  User,
  VitalHistory,
} from '@/types';
import { DEFAULT_DOG_IMAGE } from '@/types';

export async function fetchProfileWithNgo(userId: string): Promise<{ user: User; ngo: NGO | null }> {
  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;

  const { data: membership } = await db
    .from('ngo_members')
    .select('ngo_id, role, ngos(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const ngoRow = membership?.ngos
    ? Array.isArray(membership.ngos)
      ? membership.ngos[0]
      : membership.ngos
    : null;

  const ngo = ngoRow ? mapNgo(ngoRow as Parameters<typeof mapNgo>[0]) : null;
  const user = mapProfile(profile, ngo?.id ?? null);
  if (membership?.role) {
    user.role = membership.role as User['role'];
  }

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
  const { data, error } = await db
    .from('ngos')
    .insert({
      name: input.name,
      description: input.description || '',
      location: input.location || '',
      email: input.email || '',
      phone: input.phone || '',
      logo_url: input.logoUrl || null,
      owner_id: input.ownerId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapNgo(data);
}

export async function updateNgo(ngoId: string, updates: Partial<NGO>): Promise<NGO> {
  const { data, error } = await db
    .from('ngos')
    .update({
      name: updates.name,
      description: updates.description,
      location: updates.location,
      email: updates.email,
      phone: updates.phone,
      logo_url: updates.logoUrl,
    })
    .eq('id', ngoId)
    .select('*')
    .single();

  if (error) throw error;
  return mapNgo(data);
}

export async function fetchDogsByNgo(ngoId: string): Promise<Dog[]> {
  const { data, error } = await db
    .from('dogs')
    .select('*')
    .eq('ngo_id', ngoId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDog);
}

export async function fetchDogById(dogId: string): Promise<Dog | null> {
  const { data, error } = await db.from('dogs').select('*').eq('id', dogId).maybeSingle();
  if (error) throw error;
  return data ? mapDog(data) : null;
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
  const { data, error } = await db
    .from('dogs')
    .insert({
      ngo_id: input.ngoId,
      name: input.name,
      species: input.species,
      breed: input.breed || input.species,
      device_id: input.deviceId,
      age: input.age || '',
      weight: input.weight || '',
      image_url: input.imageUrl || DEFAULT_DOG_IMAGE,
      status: 'offline',
      created_by: input.createdBy,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapDog(data);
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
  const { data, error } = await db
    .from('dogs')
    .update({
      name: updates.name,
      species: updates.species,
      breed: updates.breed,
      device_id: updates.deviceId,
      age: updates.age,
      weight: updates.weight,
      image_url: updates.imageUrl,
      status: updates.status,
      has_alert: updates.hasAlert,
      alert_message: updates.alertMessage,
      last_seen: updates.lastSeen,
    })
    .eq('id', dogId)
    .select('*')
    .single();

  if (error) throw error;
  return mapDog(data);
}

export async function deleteDog(dogId: string): Promise<void> {
  const { error } = await db.from('dogs').delete().eq('id', dogId);
  if (error) throw error;
}

export async function createDogAlert(input: {
  dogId: string;
  ngoId: string;
  severity: 'warning' | 'critical';
  message: string;
  vitalType?: string;
  vitalValue?: number;
}): Promise<void> {
  const { error } = await db.from('dog_alerts').insert({
    dog_id: input.dogId,
    ngo_id: input.ngoId,
    severity: input.severity,
    message: input.message,
    vital_type: input.vitalType,
    vital_value: input.vitalValue,
    is_active: true,
  });
  if (error) throw error;
}

export async function resolveDogAlerts(dogId: string): Promise<void> {
  const { error } = await db
    .from('dog_alerts')
    .update({ is_active: false, resolved_at: new Date().toISOString() })
    .eq('dog_id', dogId)
    .eq('is_active', true);
  if (error) throw error;
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
  const { error } = await db.from('vital_readings').insert({
    dog_id: input.dogId,
    device_id: input.deviceId,
    temperature: input.temperature,
    heart_rate: input.heartRate,
    spo2: input.spo2,
    activity: input.activity,
    speed_kmph: input.speedKmph,
    latitude: input.latitude,
    longitude: input.longitude,
    sats: input.sats,
    battery_level: input.batteryLevel,
    recorded_at: (input.recordedAt || new Date()).toISOString(),
  });
  if (error) throw error;
}

export async function fetchVitalHistory(
  dogId: string,
  days: number
): Promise<VitalHistory[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from('vital_readings')
    .select('*')
    .eq('dog_id', dogId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })
    .limit(5000);

  if (error) throw error;
  return (data || []).map(mapVital);
}

export async function fetchMedicalRecords(dogId: string): Promise<MedicalRecord[]> {
  const { data, error } = await db
    .from('medical_records')
    .select('*')
    .eq('dog_id', dogId)
    .order('record_date', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapMedicalRecord);
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
  const path = `${input.ngoId}/${input.dogId}/${Date.now()}-${input.file.name}`;
  const { error: uploadError } = await db.storage
    .from('medical-records')
    .upload(path, input.file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data: signed } = await db.storage
    .from('medical-records')
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  const { data, error } = await db
    .from('medical_records')
    .insert({
      dog_id: input.dogId,
      ngo_id: input.ngoId,
      type: input.type,
      title: input.title,
      notes: input.notes || '',
      file_path: path,
      file_url: signed?.signedUrl || null,
      file_name: input.file.name,
      file_size: input.file.size,
      mime_type: input.file.type,
      uploaded_by: input.uploadedBy,
      record_date: new Date().toISOString().slice(0, 10),
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapMedicalRecord(data);
}

export async function fetchMedicalHistory(dogId: string): Promise<MedicalHistoryEntry[]> {
  const { data, error } = await db
    .from('medical_history')
    .select('*')
    .eq('dog_id', dogId)
    .order('occurred_on', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapMedicalHistory);
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
  const { data, error } = await db
    .from('medical_history')
    .insert({
      dog_id: input.dogId,
      ngo_id: input.ngoId,
      category: input.category,
      title: input.title,
      description: input.description,
      diagnosis: input.diagnosis,
      treatment: input.treatment,
      veterinarian: input.veterinarian,
      occurred_on: input.occurredOn,
      is_chronic: input.isChronic ?? false,
      created_by: input.createdBy,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapMedicalHistory(data);
}

export async function fetchCommunityPosts(): Promise<CommunityPost[]> {
  const { data, error } = await db
    .from('community_posts')
    .select(
      `
      *,
      profiles:user_id ( name, avatar_url ),
      ngos:ngo_id ( name )
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw error;

  const {
    data: { user },
  } = await db.auth.getUser();

  let likedIds = new Set<string>();
  if (user) {
    const { data: likes } = await db
      .from('community_likes')
      .select('post_id')
      .eq('user_id', user.id);
    likedIds = new Set((likes || []).map(l => l.post_id));
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as { name?: string; avatar_url?: string } | null;
    const ngo = row.ngos as { name?: string } | null;
    return {
      id: row.id as string,
      userId: row.user_id as string,
      userName: profile?.name || 'Member',
      userAvatar: profile?.avatar_url || '',
      ngoName: ngo?.name || 'Independent',
      ngoId: row.ngo_id as string | null,
      title: row.title as string,
      content: row.content as string,
      likes: (row.likes_count as number) || 0,
      comments: (row.comments_count as number) || 0,
      createdAt: new Date(row.created_at as string),
      tags: (row.tags as string[]) || [],
      likedByMe: likedIds.has(row.id as string),
    };
  });
}

export async function createCommunityPost(input: {
  userId: string;
  ngoId?: string | null;
  title: string;
  content: string;
  tags?: string[];
}): Promise<void> {
  const { error } = await db.from('community_posts').insert({
    user_id: input.userId,
    ngo_id: input.ngoId || null,
    title: input.title,
    content: input.content,
    tags: input.tags || [],
  });
  if (error) throw error;
}

export async function togglePostLike(postId: string, userId: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await db
      .from('community_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await db.from('community_likes').insert({
      post_id: postId,
      user_id: userId,
    });
    if (error) throw error;
  }
}

export async function createChatConversation(userId: string, dogId?: string | null) {
  const { data, error } = await db
    .from('chat_conversations')
    .insert({
      user_id: userId,
      dog_id: dogId || null,
      title: 'Dog Health Chat',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function saveChatMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
  const { data, error } = await db
    .from('chat_messages')
    .insert({ conversation_id: conversationId, role, content })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchChatMessages(conversationId: string) {
  const { data, error } = await db
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
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
  const { error } = await db.from('health_reports').insert({
    dog_id: input.dogId,
    ngo_id: input.ngoId,
    generated_by: input.generatedBy,
    period_type: input.periodType,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    summary: input.summary,
  });
  if (error) throw error;
}
