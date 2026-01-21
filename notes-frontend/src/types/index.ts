// Types para la versión demo simplificada

export interface ICD10Code {
  code: string;
  description: string;
  confidence: number;
}

export interface CPTCode {
  code: string;
  description: string;
  modifier?: string | null;
  confidence: number;
}

export interface CMS1500FormData {
  patient_name?: string;
  patient_dob?: string;
  patient_sex?: string;
  patient_address?: string;
  patient_city_state_zip?: string;
  patient_phone?: string;
  patient_id?: string;
  insured_name?: string;
  insured_id?: string;
  insurance_group?: string;
  diagnosis_codes?: string[];
  primary_diagnosis?: string;
  procedures?: Array<{
    cpt_code: string;
    modifier?: string;
    diagnosis_pointer: string;
    charges?: string;
    days: string;
    description: string;
  }>;
  service_date?: string;
  provider_npi?: string;
  provider_name?: string;
  provider_address?: string;
  provider_tax_id?: string;
  rendering_provider?: string;
  billing_provider?: string;
  facility_name?: string;
  notes?: string;
  form_version?: string;
  generated_at?: string;
}

export interface Transcription {
  id: number;
  filename: string;
  file_size_mb: number;
  content_type: string;
  text: string;
  processing_time_seconds: number;
  model: string;
  provider: string;
  medical_note?: string | null;
  icd10_codes?: ICD10Code[] | null;
  cpt_codes?: CPTCode[] | null;
  cms1500_form_data?: CMS1500FormData | null;
  workflow_status: string;
  created_at: string;
  updated_at?: string;
}

export interface TranscriptionListResponse {
  total: number;
  items: Transcription[];
  page: number;
  page_size: number;
}

export interface HealthCheck {
  status: string;
  timestamp: number;
  huggingface_configured: boolean;
  database: string;
  mode?: string;
}

export interface ApiError {
  detail: string;
}

export interface WorkflowStepResponse {
  success: boolean;
  message: string;
  transcription: Transcription;
}

export interface PatientInfo {
  name?: string;
  dob?: string;
  sex?: string;
  address?: string;
  city_state_zip?: string;
  phone?: string;
  id?: string;
  insured_name?: string;
  insured_id?: string;
  insurance_group?: string;
}

// EHR Integration Types
export interface EHRConnection {
  id: number;
  ehr_provider: string;
  ehr_name: string;
  practice_id?: string | null;
  practice_name?: string | null;
  base_url: string;
  fhir_version: string;
  scopes?: string[] | null;
  is_active: boolean;
  last_sync_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface EHRConnectionCreate {
  ehr_provider: string;
  ehr_name: string;
  base_url: string;
  client_id?: string;
  client_secret?: string;
  practice_id?: string;
  practice_name?: string;
  fhir_version?: string;
  scopes?: string[];
  metadata?: Record<string, any>;
}

export interface EHRListResponse {
  total: number;
  items: EHRConnection[];
  page: number;
  page_size: number;
}

export interface EHRAuthorizationResponse {
  authorization_url: string;
  state: string;
  connection_id: number;
}

export interface EHRSyncRequest {
  connection_id: number;
  transcription_id: number;
  patient_id: string;
  sync_types?: string[];
}

export interface EHRSyncResponse {
  success: boolean;
  message: string;
  sync_id: number;
  resources_created: Record<string, any>;
}

export interface EHRPatient {
  id: string;
  name?: string | null;
  birthdate?: string | null;
  gender?: string | null;
  identifiers: Array<{
    system: string;
    value: string;
  }>;
  fhir_resource?: Record<string, any>;
}

export interface SupportedEHR {
  name: string;
  base_url: string;
  fhir_version: string;
  auth_url: string;
  token_url: string;
  scopes: string[];
  documentation: string;
  connect_url?: string;
}

// Authentication Types
export enum UserRole {
  DOCTOR = 'doctor',
  ADMINISTRATOR = 'administrator'
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  expires_in: number;
}

