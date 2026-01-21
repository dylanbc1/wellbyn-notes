import React, { useState, useEffect } from 'react';
import { 
  getEHRConnections, 
  syncTranscriptionToEHR, 
  searchEHRPatients 
} from '../services/api';
import type { EHRConnection, EHRPatient, Transcription } from '../types';
import Button from './Button';

interface EHRSyncButtonProps {
  transcription: Transcription;
  onSyncComplete?: () => void;
}

export default function EHRSyncButton({ transcription, onSyncComplete }: EHRSyncButtonProps) {
  const [connections, setConnections] = useState<EHRConnection[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [patients, setPatients] = useState<EHRPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (showModal) {
      loadConnections();
    }
  }, [showModal]);

  const loadConnections = async () => {
    try {
      const response = await getEHRConnections(0, 100, true);
      setConnections(response.items.filter(c => c.is_active && c.access_token));
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const handleSearchPatients = async () => {
    if (!selectedConnection || !searchQuery.trim()) return;

    try {
      setLoading(true);
      const results = await searchEHRPatients(selectedConnection, searchQuery);
      setPatients(results);
    } catch (error: any) {
      console.error('Error searching patients:', error);
      alert(`Error buscando pacientes: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedConnection || !selectedPatientId) {
      alert('Por favor selecciona una conexión y un paciente');
      return;
    }

    if (!transcription.medical_note) {
      alert('La transcripción debe tener una nota médica generada antes de sincronizar');
      return;
    }

    try {
      setSyncing(true);
      await syncTranscriptionToEHR({
        connection_id: selectedConnection,
        transcription_id: transcription.id,
        patient_id: selectedPatientId,
        sync_types: ['document', 'diagnosis', 'procedure']
      });
      
      alert('Transcripción sincronizada exitosamente con el EHR');
      setShowModal(false);
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error: any) {
      console.error('Error syncing to EHR:', error);
      alert(`Error sincronizando: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (connections.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No hay conexiones EHR activas. Configura una conexión primero.
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setShowModal(true)}>
        Sincronizar con EHR
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Sincronizar con EHR</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Seleccionar Conexión EHR
                </label>
                <select
                  value={selectedConnection || ''}
                  onChange={(e) => {
                    setSelectedConnection(Number(e.target.value));
                    setPatients([]);
                    setSelectedPatientId('');
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Selecciona una conexión</option>
                  {connections.map(conn => (
                    <option key={conn.id} value={conn.id}>
                      {conn.ehr_name} ({conn.ehr_provider})
                    </option>
                  ))}
                </select>
              </div>

              {selectedConnection && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Buscar Paciente
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearchPatients()}
                        placeholder="Nombre del paciente..."
                        className="flex-1 px-3 py-2 border rounded-lg"
                      />
                      <Button
                        onClick={handleSearchPatients}
                        disabled={loading || !searchQuery.trim()}
                      >
                        {loading ? 'Buscando...' : 'Buscar'}
                      </Button>
                    </div>
                  </div>

                  {patients.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Seleccionar Paciente
                      </label>
                      <div className="border rounded-lg max-h-60 overflow-y-auto">
                        {patients.map(patient => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => setSelectedPatientId(patient.id)}
                            className={`w-full text-left p-3 border-b last:border-b-0 hover:bg-gray-50 ${
                              selectedPatientId === patient.id ? 'bg-blue-50 border-blue-200' : ''
                            }`}
                          >
                            <div className="font-semibold">{patient.name || 'Sin nombre'}</div>
                            <div className="text-sm text-gray-600">
                              {patient.birthdate && `Nacimiento: ${patient.birthdate}`}
                              {patient.gender && ` • ${patient.gender}`}
                            </div>
                            {patient.identifiers.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                IDs: {patient.identifiers.map(i => i.value).join(', ')}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPatientId && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-sm text-green-800">
                        ✓ Paciente seleccionado: {patients.find(p => p.id === selectedPatientId)?.name || selectedPatientId}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedConnection(null);
                    setPatients([]);
                    setSelectedPatientId('');
                    setSearchQuery('');
                  }}
                  className="bg-gray-500 hover:bg-gray-600"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSync}
                  disabled={!selectedConnection || !selectedPatientId || syncing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
