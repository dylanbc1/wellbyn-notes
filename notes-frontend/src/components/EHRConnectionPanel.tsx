import React, { useState, useEffect } from 'react';
import { 
  getEHRConnections, 
  createEHRConnection, 
  deleteEHRConnection,
  getEHRAuthorizationUrl 
} from '../services/api';
import type { EHRConnection, EHRConnectionCreate } from '../types';
import Button from './Button';

interface EHRConnectionPanelProps {
  onConnectionSelect?: (connection: EHRConnection) => void;
}

const SUPPORTED_EHRS = [
  {
    provider: 'eclinicalworks',
    name: 'eClinicalWorks',
    baseUrl: 'https://fhir.eclinicalworks.com/fhir/r4',
    description: 'Popular EHR para clínicas ambulatorias',
    documentation: 'https://fhir.eclinicalworks.com'
  },
  {
    provider: 'practicefusion',
    name: 'Practice Fusion',
    baseUrl: 'Variable por práctica',
    description: 'EHR gratuito, muy usado en mercados pequeños',
    documentation: 'https://www.practicefusion.com/ehr-support/fhir-api-specifications',
    note: 'Base URL específica por práctica. Contactar: (415) 993-4977'
  },
  {
    provider: 'athenahealth',
    name: 'athenahealth',
    baseUrl: 'https://api.athenahealth.com/fhir/r4',
    description: 'Enfoque en flujo administrativo y revenue cycle',
    documentation: 'https://docs.athenahealth.com/api'
  },
  {
    provider: 'epic',
    name: 'Epic',
    baseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    description: 'Dominante en hospitales y grandes redes',
    documentation: 'https://fhir.epic.com'
  },
  {
    provider: 'drchrono',
    name: 'DrChrono',
    baseUrl: 'https://drchrono.com/fhir/r4',
    description: 'Mobile-first, intuitivo y flexible',
    documentation: 'https://drchrono.com/api-docs'
  }
];

export default function EHRConnectionPanel({ onConnectionSelect }: EHRConnectionPanelProps) {
  const [connections, setConnections] = useState<EHRConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEHR, setSelectedEHR] = useState<string>('');
  const [formData, setFormData] = useState<EHRConnectionCreate>({
    ehr_provider: '',
    ehr_name: '',
    base_url: '',
    client_id: '',
    client_secret: '',
    practice_name: '',
    fhir_version: 'R4'
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await getEHRConnections(0, 100);
      setConnections(response.items);
    } catch (error) {
      console.error('Error loading EHR connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEHRSelect = (provider: string) => {
    const ehr = SUPPORTED_EHRS.find(e => e.provider === provider);
    if (ehr) {
      setSelectedEHR(provider);
      setFormData({
        ...formData,
        ehr_provider: provider,
        ehr_name: ehr.name,
        base_url: ehr.baseUrl,
        fhir_version: 'R4'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEHRConnection(formData);
      setShowAddForm(false);
      setFormData({
        ehr_provider: '',
        ehr_name: '',
        base_url: '',
        client_id: '',
        client_secret: '',
        practice_name: '',
        fhir_version: 'R4'
      });
      setSelectedEHR('');
      loadConnections();
    } catch (error: any) {
      console.error('Error creating EHR connection:', error);
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleAuthorize = async (connection: EHRConnection) => {
    try {
      // En producción, esto debería ser una URL de tu aplicación
      const redirectUri = `${window.location.origin}/ehr/callback`;
      const response = await getEHRAuthorizationUrl(connection.id, redirectUri);
      
      // Guardar state en localStorage para validación después
      localStorage.setItem(`ehr_auth_state_${connection.id}`, response.state);
      
      // Redirigir a la URL de autorización
      window.location.href = response.authorization_url;
    } catch (error: any) {
      console.error('Error getting authorization URL:', error);
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDelete = async (connectionId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta conexión?')) {
      return;
    }
    
    try {
      await deleteEHRConnection(connectionId);
      loadConnections();
    } catch (error: any) {
      console.error('Error deleting EHR connection:', error);
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  if (loading) {
    return <div className="p-4">Cargando conexiones...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Conexiones EHR</h2>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancelar' : '+ Nueva Conexión'}
        </Button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Agregar Nueva Conexión EHR</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Seleccionar EHR</label>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_EHRS.map(ehr => (
                <button
                  key={ehr.provider}
                  type="button"
                  onClick={() => handleEHRSelect(ehr.provider)}
                  className={`p-3 border rounded-lg text-left transition ${
                    selectedEHR === ehr.provider
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold">{ehr.name}</div>
                  <div className="text-sm text-gray-600">{ehr.description}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedEHR && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre de la Conexión</label>
                <input
                  type="text"
                  value={formData.ehr_name}
                  onChange={(e) => setFormData({ ...formData, ehr_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">URL Base</label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Client ID (OAuth2)</label>
                <input
                  type="text"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Opcional - se puede agregar después"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Client Secret (OAuth2)</label>
                <input
                  type="password"
                  value={formData.client_secret}
                  onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Opcional - se puede agregar después"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nombre de la Práctica</label>
                <input
                  type="text"
                  value={formData.practice_name}
                  onChange={(e) => setFormData({ ...formData, practice_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Opcional"
                />
              </div>

              <Button type="submit">Crear Conexión</Button>
            </form>
          )}
        </div>
      )}

      <div className="space-y-3">
        {connections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay conexiones EHR configuradas. Crea una nueva conexión para comenzar.
          </div>
        ) : (
          connections.map(connection => (
            <div
              key={connection.id}
              className="bg-white rounded-lg shadow p-4 flex justify-between items-center"
            >
              <div>
                <div className="font-semibold text-lg">{connection.ehr_name}</div>
                <div className="text-sm text-gray-600">
                  {connection.ehr_provider} • {connection.practice_name || 'Sin práctica'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {connection.is_active ? (
                    <span className="text-green-600">● Activa</span>
                  ) : (
                    <span className="text-gray-400">● Inactiva</span>
                  )}
                  {connection.last_sync_at && (
                    <span className="ml-2">
                      Última sincronización: {new Date(connection.last_sync_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {connection.last_error && (
                  <div className="text-xs text-red-600 mt-1">
                    Error: {connection.last_error}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {!connection.access_token && connection.client_id && (
                  <Button
                    onClick={() => handleAuthorize(connection)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Autorizar
                  </Button>
                )}
                {connection.access_token && (
                  <span className="text-sm text-green-600 px-3 py-1 bg-green-50 rounded">
                    ✓ Autorizada
                  </span>
                )}
                <Button
                  onClick={() => handleDelete(connection.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
