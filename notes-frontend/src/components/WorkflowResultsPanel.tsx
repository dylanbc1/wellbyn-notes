import { useState, useEffect } from 'react';
import { FaFileMedical, FaCode, FaFileInvoice, FaCheckCircle, FaSpinner, FaClock, FaMicrophone } from 'react-icons/fa';
import type { Transcription, ICD10Code, CPTCode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import EHRSyncButton from './EHRSyncButton';

interface WorkflowResultsPanelProps {
  transcription: Transcription | null;
  isRunning: boolean;
  onTranscriptionUpdate?: (transcription: Transcription) => void;
}

export const WorkflowResultsPanel: React.FC<WorkflowResultsPanelProps> = ({
  transcription,
  isRunning,
  onTranscriptionUpdate,
}) => {
  const [editableMedicalNote, setEditableMedicalNote] = useState<string>('');
  const [editableIcd10Codes, setEditableIcd10Codes] = useState<ICD10Code[]>([]);
  const [editableCptCodes, setEditableCptCodes] = useState<CPTCode[]>([]);
  const [editableCms1500, setEditableCms1500] = useState<any>(null);
  
  // Sincronizar los estados editables con la transcripción
  useEffect(() => {
    if (transcription) {
      if (transcription.medical_note) {
        setEditableMedicalNote(transcription.medical_note);
      }
      if (transcription.icd10_codes) {
        setEditableIcd10Codes([...transcription.icd10_codes]);
      }
      if (transcription.cpt_codes) {
        setEditableCptCodes([...transcription.cpt_codes]);
      }
      if (transcription.cms1500_form_data) {
        setEditableCms1500({ ...transcription.cms1500_form_data });
      }
    }
  }, [transcription]);
  
  const handleMedicalNoteChange = (newNote: string) => {
    setEditableMedicalNote(newNote);
    if (transcription && onTranscriptionUpdate) {
      onTranscriptionUpdate({ ...transcription, medical_note: newNote });
    }
  };
  
  const handleIcd10CodeChange = (index: number, field: 'code' | 'description', value: string) => {
    const updated = [...editableIcd10Codes];
    updated[index] = { ...updated[index], [field]: value };
    setEditableIcd10Codes(updated);
    if (transcription && onTranscriptionUpdate) {
      onTranscriptionUpdate({ ...transcription, icd10_codes: updated });
    }
  };
  
  const handleCptCodeChange = (index: number, field: 'code' | 'modifier' | 'description', value: string) => {
    const updated = [...editableCptCodes];
    updated[index] = { ...updated[index], [field]: value };
    setEditableCptCodes(updated);
    if (transcription && onTranscriptionUpdate) {
      onTranscriptionUpdate({ ...transcription, cpt_codes: updated });
    }
  };
  
  const handleCms1500Change = (field: string, value: any) => {
    const updated = { ...editableCms1500, [field]: value };
    setEditableCms1500(updated);
    if (transcription && onTranscriptionUpdate) {
      onTranscriptionUpdate({ ...transcription, cms1500_form_data: updated });
    }
  };
  const { isAdministrator } = useAuth();
  if (!transcription && !isRunning) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FaFileMedical className="text-6xl text-[#C7E7FF] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#0C1523] mb-2">
            Esperando transcripción
          </h3>
          <p className="text-[#0C1523] font-medium">
            Los resultados del workflow médico aparecerán aquí automáticamente
          </p>
        </div>
      </div>
    );
  }

  const getWorkflowStatus = () => {
    if (!transcription) return [];
    
    const status = transcription.workflow_status || 'transcribed';
    const steps = [
      { key: 'transcribed', label: 'Transcripción', completed: true, icon: FaCheckCircle },
      { 
        key: 'note_generated', 
        label: 'Nota médica', 
        completed: !!transcription.medical_note,
        icon: FaFileMedical 
      },
    ];
    
    // Solo mostrar códigos y formularios para administradores
    if (isAdministrator) {
      steps.push(
        { 
          key: 'codes_suggested', 
          label: 'Códigos ICD-10', 
          completed: !!(transcription.icd10_codes && transcription.icd10_codes.length > 0),
          icon: FaCode 
        },
        { 
          key: 'cpt_codes', 
          label: 'Códigos CPT', 
          completed: !!(transcription.cpt_codes && transcription.cpt_codes.length > 0),
          icon: FaCode 
        },
        { 
          key: 'form_created', 
          label: 'Formulario CMS-1500', 
          completed: !!transcription.cms1500_form_data,
          icon: FaFileInvoice 
        }
      );
    }
    
    return steps;
  };

  const workflowSteps = getWorkflowStatus();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#0C1523] mb-2">
          Resultados del workflow médico
        </h2>
        <p className="text-[#0C1523] text-sm font-medium">
          Análisis automático de la transcripción
        </p>
      </div>

      {/* Loading State */}
      {isRunning && (
        <div className="mb-6 p-4 bg-[#F0F8FF] rounded-xl border border-[#E0F2FF]">
          <div className="flex items-center space-x-3">
            <FaSpinner className="animate-spin text-[#5FA9DF] text-2xl" />
            <div>
              <p className="font-semibold text-[#0C1523]">Ejecutando workflow...</p>
              <p className="text-sm text-[#0C1523] font-medium">Por favor espera, esto puede tomar unos momentos</p>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Steps Status */}
      <div className="mb-6 space-y-3">
        {workflowSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className={`flex items-center space-x-3 p-3 rounded-lg ${
                step.completed ? 'bg-[#E0F2FF]' : isRunning ? 'bg-[#F0F8FF]' : 'bg-gray-50'
              }`}
            >
              {step.completed ? (
                <FaCheckCircle className="text-[#246B8E] text-xl flex-shrink-0" />
              ) : isRunning ? (
                <FaSpinner className="animate-spin text-[#0C1523] text-xl flex-shrink-0" />
              ) : (
                <Icon className="text-[#0C1523] text-xl flex-shrink-0" />
              )}
              <span className="font-medium text-[#0C1523]">
                {step.label}
              </span>
              {step.completed && (
                <FaCheckCircle className="text-green-500 text-sm ml-auto" />
              )}
            </div>
          );
        })}
      </div>

      {/* Transcription Text - Read Only */}
      {transcription?.text && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaMicrophone className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Transcripción</h3>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[#E0F2FF] max-h-[200px] overflow-y-auto">
            <p className="text-[#0C1523] leading-relaxed whitespace-pre-wrap text-sm">
              {transcription.text}
            </p>
          </div>
        </div>
      )}

      {/* Medical Note - Editable */}
      {transcription?.medical_note && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaFileMedical className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Nota médica</h3>
          </div>
          <p className="text-xs text-[#6B7280] mb-2">
            Puedes editar la nota médica generada
          </p>
          <textarea
            value={editableMedicalNote}
            onChange={(e) => handleMedicalNoteChange(e.target.value)}
            className="w-full min-h-[150px] max-h-64 bg-white rounded-xl p-4 border border-[#E0F2FF] text-[#0C1523] leading-relaxed text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF]"
            placeholder="Nota médica..."
            spellCheck={true}
          />
        </div>
      )}

      {/* ICD-10 Codes - Editable - Solo para administradores */}
      {isAdministrator && transcription?.icd10_codes && transcription.icd10_codes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaCode className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Códigos ICD-10</h3>
          </div>
          <p className="text-xs text-[#6B7280] mb-2">
            Puedes editar los códigos y descripciones
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {editableIcd10Codes.map((code: ICD10Code, idx: number) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-[#E0F2FF]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={code.code}
                      onChange={(e) => handleIcd10CodeChange(idx, 'code', e.target.value)}
                      className="w-full font-mono font-semibold text-[#5FA9DF] text-lg bg-transparent border-b border-[#E0F2FF] focus:outline-none focus:border-[#5FA9DF] pb-1"
                      placeholder="Código ICD-10"
                    />
                    <textarea
                      value={code.description}
                      onChange={(e) => handleIcd10CodeChange(idx, 'description', e.target.value)}
                      className="w-full text-[#0C1523] font-medium text-sm bg-transparent border border-[#E0F2FF] rounded p-2 focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF] resize-none"
                      placeholder="Descripción"
                      rows={2}
                    />
                  </div>
                  <span className="text-xs text-[#0C1523] font-medium bg-[#F0F8FF] px-2 py-1 rounded flex-shrink-0">
                    {(code.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CPT Codes - Editable - Solo para administradores */}
      {isAdministrator && transcription?.cpt_codes && transcription.cpt_codes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaCode className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Códigos CPT + modificadores</h3>
          </div>
          <p className="text-xs text-[#6B7280] mb-2">
            Puedes editar los códigos, modificadores y descripciones
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {editableCptCodes.map((code: CPTCode, idx: number) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-[#E0F2FF]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={code.code}
                        onChange={(e) => handleCptCodeChange(idx, 'code', e.target.value)}
                        className="font-mono font-semibold text-[#5FA9DF] text-lg bg-transparent border-b border-[#E0F2FF] focus:outline-none focus:border-[#5FA9DF] pb-1 w-24"
                        placeholder="CPT"
                      />
                      <span className="text-[#4A9BCE]">-</span>
                      <input
                        type="text"
                        value={code.modifier || ''}
                        onChange={(e) => handleCptCodeChange(idx, 'modifier', e.target.value)}
                        className="font-mono text-[#4A9BCE] text-sm bg-transparent border-b border-[#E0F2FF] focus:outline-none focus:border-[#5FA9DF] pb-1 w-16"
                        placeholder="Mod"
                      />
                    </div>
                    <textarea
                      value={code.description}
                      onChange={(e) => handleCptCodeChange(idx, 'description', e.target.value)}
                      className="w-full text-[#0C1523] font-medium text-sm bg-transparent border border-[#E0F2FF] rounded p-2 focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF] resize-none"
                      placeholder="Descripción"
                      rows={2}
                    />
                  </div>
                  <span className="text-xs text-[#0C1523] font-medium bg-[#F0F8FF] px-2 py-1 rounded flex-shrink-0">
                    {(code.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CMS-1500 Form - Editable - Solo para administradores */}
      {isAdministrator && transcription?.cms1500_form_data && editableCms1500 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaFileInvoice className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Formulario CMS-1500</h3>
          </div>
          <p className="text-xs text-[#6B7280] mb-2">
            Puedes editar los campos del formulario
          </p>
          <div className="bg-white rounded-xl p-4 border border-[#E0F2FF] max-h-96 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-[#0C1523] mb-1 text-sm">Paciente:</label>
                <input
                  type="text"
                  value={editableCms1500.patient_name || ''}
                  onChange={(e) => handleCms1500Change('patient_name', e.target.value)}
                  className="w-full px-3 py-2 border border-[#E0F2FF] rounded-lg text-[#0C1523] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF]"
                  placeholder="Nombre del paciente"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0C1523] mb-1 text-sm">Diagnóstico principal:</label>
                <input
                  type="text"
                  value={editableCms1500.primary_diagnosis || ''}
                  onChange={(e) => handleCms1500Change('primary_diagnosis', e.target.value)}
                  className="w-full px-3 py-2 border border-[#E0F2FF] rounded-lg font-mono text-[#5FA9DF] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF]"
                  placeholder="Código de diagnóstico"
                />
              </div>
              {editableCms1500.diagnosis_codes && editableCms1500.diagnosis_codes.length > 0 && (
                <div>
                  <label className="block font-semibold text-[#0C1523] mb-1 text-sm">Códigos de diagnóstico:</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {editableCms1500.diagnosis_codes.map((code: string, idx: number) => (
                      <input
                        key={idx}
                        type="text"
                        value={code}
                        onChange={(e) => {
                          const updated = [...editableCms1500.diagnosis_codes];
                          updated[idx] = e.target.value;
                          handleCms1500Change('diagnosis_codes', updated);
                        }}
                        className="font-mono bg-white px-2 py-1 rounded text-sm border border-[#E0F2FF] focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF]"
                      />
                    ))}
                  </div>
                </div>
              )}
              {editableCms1500.procedures && editableCms1500.procedures.length > 0 && (
                <div>
                  <label className="block font-semibold text-[#0C1523] mb-2 text-sm">Procedimientos:</label>
                  <div className="mt-2 space-y-2">
                    {editableCms1500.procedures.map((proc: any, idx: number) => (
                      <div key={idx} className="bg-[#F0F8FF] rounded-lg p-3 border border-[#E0F2FF] space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={proc.cpt_code || ''}
                            onChange={(e) => {
                              const updated = [...editableCms1500.procedures];
                              updated[idx] = { ...updated[idx], cpt_code: e.target.value };
                              handleCms1500Change('procedures', updated);
                            }}
                            className="font-mono font-semibold text-[#5FA9DF] text-sm border border-[#E0F2FF] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF] w-20"
                            placeholder="CPT"
                          />
                          <span className="text-[#4A9BCE]">-</span>
                          <input
                            type="text"
                            value={proc.modifier || ''}
                            onChange={(e) => {
                              const updated = [...editableCms1500.procedures];
                              updated[idx] = { ...updated[idx], modifier: e.target.value };
                              handleCms1500Change('procedures', updated);
                            }}
                            className="font-mono text-[#4A9BCE] text-sm border border-[#E0F2FF] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF] w-16"
                            placeholder="Mod"
                          />
                          <input
                            type="text"
                            value={proc.description || ''}
                            onChange={(e) => {
                              const updated = [...editableCms1500.procedures];
                              updated[idx] = { ...updated[idx], description: e.target.value };
                              handleCms1500Change('procedures', updated);
                            }}
                            className="flex-1 text-[#0C1523] font-medium text-sm border border-[#E0F2FF] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF]"
                            placeholder="Descripción"
                          />
                        </div>
                        <input
                          type="text"
                          value={proc.charges || ''}
                          onChange={(e) => {
                            const updated = [...editableCms1500.procedures];
                            updated[idx] = { ...updated[idx], charges: e.target.value };
                            handleCms1500Change('procedures', updated);
                          }}
                          className="text-xs text-[#0C1523] font-medium border border-[#E0F2FF] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF] w-32"
                          placeholder="Cargos ($)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block font-semibold text-[#0C1523] mb-1 text-sm">Fecha de servicio:</label>
                <input
                  type="text"
                  value={editableCms1500.service_date || ''}
                  onChange={(e) => handleCms1500Change('service_date', e.target.value)}
                  className="w-full px-3 py-2 border border-[#E0F2FF] rounded-lg text-[#0C1523] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF]"
                  placeholder="Fecha de servicio"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EHR Sync Button */}
      {transcription && transcription.medical_note && (
        <div className="mt-4 pt-4 border-t border-[#E0F2FF]">
          <EHRSyncButton 
            transcription={transcription}
            onSyncComplete={() => {
              console.log('Transcripción sincronizada con EHR');
              // Opcional: refrescar datos o mostrar notificación
            }}
          />
        </div>
      )}

      {/* Metadata */}
      {transcription && (
        <div className="mt-auto pt-4 border-t border-[#E0F2FF]">
          <div className="flex items-center justify-between text-xs text-[#0C1523] font-medium">
            <div className="flex items-center space-x-1">
              <FaClock />
              <span>ID: {transcription.id}</span>
            </div>
            <span>{transcription.processing_time_seconds}s</span>
          </div>
        </div>
      )}
    </div>
  );
};

