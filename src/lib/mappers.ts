import type { Dog, MedicalHistoryEntry, MedicalRecord, NGO, User, VitalHistory } from '@/types';
import { DEFAULT_DOG_IMAGE, DEFAULT_NGO_LOGO } from '@/types';

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: User['role'];
};

type NgoRow = {
  id: string;
  name: string;
  description?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  owner_id: string;
  dogs_count?: number | null;
};

type DogRow = {
  id: string;
  ngo_id: string;
  name: string;
  breed?: string | null;
  species?: string | null;
  age?: string | null;
  weight?: string | null;
  device_id: string;
  image_url?: string | null;
  status: Dog['status'];
  has_alert?: boolean | null;
  alert_message?: string | null;
  last_seen?: string | null;
  notes?: string | null;
};

type VitalRow = {
  id: string;
  temperature?: number | null;
  heart_rate?: number | null;
  activity?: string | null;
  spo2?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  recorded_at: string;
};

type MedicalRecordRow = {
  id: string;
  dog_id: string;
  ngo_id: string;
  type: MedicalRecord['type'];
  title: string;
  notes?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  record_date?: string | null;
  created_at?: string;
};

type MedicalHistoryRow = {
  id: string;
  dog_id: string;
  ngo_id: string;
  category: MedicalHistoryEntry['category'];
  title: string;
  description?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  veterinarian?: string | null;
  occurred_on?: string | null;
  is_chronic?: boolean | null;
};

export function mapProfile(row: ProfileRow, ngoId: string | null = null): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name || row.email.split('@')[0] || 'User',
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: row.role || 'owner',
    ngoId,
  };
}

export function mapNgo(row: NgoRow): NGO {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    location: row.location || '',
    email: row.email || '',
    phone: row.phone || '',
    logoUrl: row.logo_url || DEFAULT_NGO_LOGO,
    ownerId: row.owner_id,
    dogsCount: row.dogs_count ?? 0,
  };
}

export function mapDog(row: DogRow): Dog {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    name: row.name,
    breed: row.breed || row.species || '',
    species: row.species || row.breed || '',
    age: row.age || '',
    weight: row.weight || '',
    deviceId: row.device_id,
    imageUrl: row.image_url || DEFAULT_DOG_IMAGE,
    status: row.status || 'offline',
    hasAlert: Boolean(row.has_alert),
    alertMessage: row.alert_message,
    lastSeen: row.last_seen ? new Date(row.last_seen) : null,
    notes: row.notes || '',
  };
}

export function mapVital(row: VitalRow): VitalHistory {
  return {
    id: row.id,
    timestamp: new Date(row.recorded_at),
    temperature: Number(row.temperature ?? 0),
    heartRate: Number(row.heart_rate ?? 0),
    activity: row.activity || 'Unknown',
    spo2: row.spo2,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export function mapMedicalRecord(row: MedicalRecordRow): MedicalRecord {
  return {
    id: row.id,
    dogId: row.dog_id,
    ngoId: row.ngo_id,
    type: row.type,
    title: row.title,
    notes: row.notes || '',
    fileUrl: row.file_url || '',
    fileName: row.file_name,
    date: new Date(row.record_date || row.created_at || Date.now()),
  };
}

export function mapMedicalHistory(row: MedicalHistoryRow): MedicalHistoryEntry {
  return {
    id: row.id,
    dogId: row.dog_id,
    ngoId: row.ngo_id,
    category: row.category,
    title: row.title,
    description: row.description || '',
    diagnosis: row.diagnosis,
    treatment: row.treatment,
    veterinarian: row.veterinarian,
    occurredOn: row.occurred_on,
    isChronic: Boolean(row.is_chronic),
  };
}
