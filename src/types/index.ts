export type UserRole = 'owner' | 'admin' | 'staff' | 'volunteer';
export type DogStatus = 'online' | 'offline' | 'warning' | 'critical';
export type AlertSeverity = 'warning' | 'critical';
export type MedicalRecordType = 'vaccination' | 'prescription' | 'report' | 'other';
export type MedicalHistoryCategory =
  | 'diagnosis'
  | 'treatment'
  | 'surgery'
  | 'allergy'
  | 'chronic'
  | 'general';
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type ChatRole = 'user' | 'assistant';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  ngoId: string | null;
}

export interface NGO {
  id: string;
  name: string;
  logoUrl: string;
  dogsCount: number;
  location: string;
  email: string;
  phone: string;
  description: string;
  ownerId: string;
}

export interface Dog {
  id: string;
  name: string;
  ngoId: string;
  deviceId: string;
  breed: string;
  species: string;
  age: string;
  weight: string;
  status: DogStatus;
  lastSeen: Date | null;
  imageUrl: string;
  hasAlert: boolean;
  alertMessage?: string | null;
  notes?: string;
}

export interface DeviceData {
  temperature: number;
  heartRate: number;
  location: { lat: number; lng: number };
  activity: string;
  batteryLevel: number | null;
  speedKmph?: number;
  spo2?: number;
  sats?: number;
  timestamp: Date;
}

export interface VitalHistory {
  id?: string;
  timestamp: Date;
  temperature: number;
  heartRate: number;
  activity: string;
  spo2?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface MedicalRecord {
  id: string;
  dogId: string;
  ngoId?: string;
  type: MedicalRecordType;
  title: string;
  date: Date;
  fileUrl: string;
  notes: string;
  fileName?: string | null;
}

export interface MedicalHistoryEntry {
  id: string;
  dogId: string;
  ngoId: string;
  category: MedicalHistoryCategory;
  title: string;
  description: string;
  diagnosis?: string | null;
  treatment?: string | null;
  veterinarian?: string | null;
  occurredOn?: string | null;
  isChronic: boolean;
}

export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  ngoName: string;
  ngoId?: string | null;
  title: string;
  content: string;
  likes: number;
  comments: number;
  createdAt: Date;
  tags: string[];
  likedByMe?: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
}

export interface DogAlert {
  id: string;
  dogId: string;
  ngoId: string;
  severity: AlertSeverity;
  message: string;
  vitalType?: string | null;
  vitalValue?: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface SensorReading {
  bodyTempC?: number;
  bpm?: number;
  lat?: number;
  lon?: number;
  sats?: number;
  speedKmph?: number;
  spo2?: number;
  deviceId?: string;
  dogKey?: string;
  dogName?: string;
  activity?: string;
  timestamp?: number | string;
  alertActive?: boolean;
  alertMessage?: string;
  status?: string;
  gpsValid?: boolean;
  heartContact?: boolean;
  wifiConnected?: boolean;
  sourcePath?: string;
}

export const dogSpecies = [
  'German Shepherd',
  'Golden Retriever',
  'Labrador Retriever',
  'Bulldog',
  'Beagle',
  'Poodle',
  'Rottweiler',
  'Siberian Husky',
  'Dachshund',
  'Great Dane',
  'Boxer',
  'Doberman',
  'Shih Tzu',
  'Indian Pariah',
  'Pomeranian',
  'Other',
];

export const DEFAULT_DOG_IMAGE =
  'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=640&h=480&fit=crop';

export const DEFAULT_NGO_LOGO =
  'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=200&h=200&fit=crop';
