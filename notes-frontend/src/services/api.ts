import axios from 'axios';
import type { 
  Transcription, 
  TranscriptionListResponse, 
  HealthCheck,
  WorkflowStepResponse,
  PatientInfo,
  EHRConnection,
  EHRConnectionCreate,
  EHRListResponse,
  EHRAuthorizationResponse,
  EHRSyncRequest,
  EHRSyncResponse,
  EHRPatient,
  User,
  LoginRequest,
  LoginResponse
} from '../types';

// Configuración de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== Authentication Endpoints ====================

// Login
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/api/auth/login', credentials);
  // Guardar token y usuario
  localStorage.setItem('auth_token', response.data.access_token);
  localStorage.setItem('user', JSON.stringify(response.data.user));
  return response.data;
};

// Logout
export const logout = async (): Promise<void> => {
  await api.post('/api/auth/logout');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
};

// Get current user
export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<User>('/api/auth/me');
  return response.data;
};

// Register (solo para administradores en producción)
export const register = async (userData: {
  email: string;
  full_name: string;
  password: string;
  role: 'doctor' | 'administrator';
}): Promise<User> => {
  const response = await api.post<User>('/api/auth/register', userData);
  return response.data;
};

// Health Check
export const healthCheck = async (): Promise<HealthCheck> => {
  const response = await api.get<HealthCheck>('/api/health');
  return response.data;
};

// Transcribir audio (solo modelo básico, sin selección)
export const transcribeAudio = async (audioFile: File): Promise<Transcription> => {
  const formData = new FormData();
  formData.append('audio', audioFile);

  const response = await api.post<Transcription>('/api/transcriptions/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Transcribir chunk de audio para tiempo real
export const transcribeAudioChunk = async (audioChunk: Blob): Promise<{ text: string; status: string }> => {
  const formData = new FormData();
  formData.append('audio', audioChunk, 'chunk.webm');

  const response = await api.post<{ text: string; status: string }>('/api/transcriptions/transcribe-chunk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Obtener lista de transcripciones
export const getTranscriptions = async (
  skip: number = 0,
  limit: number = 10
): Promise<TranscriptionListResponse> => {
  const response = await api.get<TranscriptionListResponse>('/api/transcriptions/', {
    params: { skip, limit },
  });
  return response.data;
};

// Obtener una transcripción específica
export const getTranscription = async (id: number): Promise<Transcription> => {
  const response = await api.get<Transcription>(`/api/transcriptions/${id}`);
  return response.data;
};

// Eliminar una transcripción
export const deleteTranscription = async (id: number): Promise<void> => {
  await api.delete(`/api/transcriptions/${id}`);
};

// ==================== Medical Workflow Endpoints ====================

// Generate medical note from transcription
export const generateMedicalNote = async (transcriptionId: number): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/generate-note`
  );
  return response.data;
};

// Suggest ICD-10 codes
export const suggestICD10Codes = async (transcriptionId: number): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/suggest-icd10`
  );
  return response.data;
};

// Suggest CPT codes
export const suggestCPTCodes = async (transcriptionId: number): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/suggest-cpt`
  );
  return response.data;
};

// Generate CMS-1500 form
export const generateCMS1500Form = async (
  transcriptionId: number,
  patientInfo?: PatientInfo
): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/generate-cms1500`,
    patientInfo
  );
  return response.data;
};

// Run full workflow (all steps at once)
export const runFullWorkflow = async (
  transcriptionId: number,
  patientInfo?: PatientInfo
): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/run-full`,
    patientInfo
  );
  return response.data;
};

// ==================== EHR Integration Endpoints ====================

// Create EHR connection
export const createEHRConnection = async (connectionData: EHRConnectionCreate): Promise<EHRConnection> => {
  const response = await api.post<EHRConnection>('/api/ehr/connections', connectionData);
  return response.data;
};

// Get EHR connections list
export const getEHRConnections = async (
  skip: number = 0,
  limit: number = 10,
  activeOnly: boolean = false
): Promise<EHRListResponse> => {
  const response = await api.get<EHRListResponse>('/api/ehr/connections', {
    params: { skip, limit, active_only: activeOnly },
  });
  return response.data;
};

// Get specific EHR connection
export const getEHRConnection = async (connectionId: number): Promise<EHRConnection> => {
  const response = await api.get<EHRConnection>(`/api/ehr/connections/${connectionId}`);
  return response.data;
};

// Update EHR connection
export const updateEHRConnection = async (
  connectionId: number,
  updateData: Partial<EHRConnection>
): Promise<EHRConnection> => {
  const response = await api.put<EHRConnection>(`/api/ehr/connections/${connectionId}`, updateData);
  return response.data;
};

// Delete EHR connection
export const deleteEHRConnection = async (connectionId: number): Promise<void> => {
  await api.delete(`/api/ehr/connections/${connectionId}`);
};

// Get authorization URL for OAuth2
export const getEHRAuthorizationUrl = async (
  connectionId: number,
  redirectUri: string,
  scopes?: string[]
): Promise<EHRAuthorizationResponse> => {
  const response = await api.post<EHRAuthorizationResponse>(
    `/api/ehr/connections/${connectionId}/authorize`,
    null,
    {
      params: { redirect_uri: redirectUri, scopes },
    }
  );
  return response.data;
};

// Handle OAuth2 callback
export const handleEHRAuthorizationCallback = async (
  connectionId: number,
  code: string,
  redirectUri: string,
  state?: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(
    `/api/ehr/connections/${connectionId}/callback`,
    null,
    {
      params: { code, redirect_uri: redirectUri, state },
    }
  );
  return response.data;
};

// Sync transcription to EHR
export const syncTranscriptionToEHR = async (
  syncData: EHRSyncRequest
): Promise<EHRSyncResponse> => {
  const response = await api.post<EHRSyncResponse>(
    `/api/ehr/connections/${syncData.connection_id}/sync`,
    {
      transcription_id: syncData.transcription_id,
      patient_id: syncData.patient_id,
      sync_types: syncData.sync_types,
    }
  );
  return response.data;
};

// Search patients in EHR
export const searchEHRPatients = async (
  connectionId: number,
  name?: string,
  identifier?: string,
  birthdate?: string
): Promise<EHRPatient[]> => {
  const response = await api.post<EHRPatient[]>(
    `/api/ehr/connections/${connectionId}/patients/search`,
    null,
    {
      params: { name, identifier, birthdate },
    }
  );
  return response.data;
};

// Get EHR capabilities
export const getEHRCapabilities = async (connectionId: number): Promise<any> => {
  const response = await api.get(`/api/ehr/connections/${connectionId}/capabilities`);
  return response.data;
};

export default api;

