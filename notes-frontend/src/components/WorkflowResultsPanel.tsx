import { FaFileMedical, FaCode, FaFileInvoice, FaCheckCircle, FaSpinner, FaClock } from 'react-icons/fa';
import type { Transcription, ICD10Code, CPTCode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import EHRSyncButton from './EHRSyncButton';

interface WorkflowResultsPanelProps {
  transcription: Transcription | null;
  isRunning: boolean;
}

export const WorkflowResultsPanel: React.FC<WorkflowResultsPanelProps> = ({
  transcription,
  isRunning,
}) => {
  const { isAdministrator } = useAuth();
  if (!transcription && !isRunning) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FaFileMedical className="text-6xl text-[#C7E7FF] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[#3C4147] mb-2">
            Esperando transcripción
          </h3>
          <p className="text-[#6B7280]">
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
        label: 'Nota Médica', 
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
          Resultados del Workflow Médico
        </h2>
        <p className="text-[#3C4147] text-sm">
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
              <p className="text-sm text-[#3C4147]">Por favor espera, esto puede tomar unos momentos</p>
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
                <FaSpinner className="animate-spin text-[#6B7280] text-xl flex-shrink-0" />
              ) : (
                <Icon className="text-[#6B7280] text-xl flex-shrink-0" />
              )}
              <span className={`font-medium ${step.completed ? 'text-[#0C1523]' : 'text-[#3C4147]'}`}>
                {step.label}
              </span>
              {step.completed && (
                <FaCheckCircle className="text-green-500 text-sm ml-auto" />
              )}
            </div>
          );
        })}
      </div>

      {/* Medical Note */}
      {transcription?.medical_note && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaFileMedical className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Nota Médica</h3>
          </div>
          <div className="bg-[#F0F8FF] rounded-xl p-4 border border-[#E0F2FF] max-h-64 overflow-y-auto">
            <p className="text-[#0C1523] leading-relaxed whitespace-pre-wrap">
              {transcription.medical_note}
            </p>
          </div>
        </div>
      )}

      {/* ICD-10 Codes - Solo para administradores */}
      {isAdministrator && transcription?.icd10_codes && transcription.icd10_codes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaCode className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Códigos ICD-10</h3>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {transcription.icd10_codes.map((code: ICD10Code, idx: number) => (
              <div key={idx} className="bg-[#F0F8FF] rounded-lg p-3 border border-[#E0F2FF]">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="font-mono font-semibold text-[#5FA9DF] text-lg">{code.code}</span>
                    <p className="text-[#3C4147] mt-1">{code.description}</p>
                  </div>
                  <span className="text-xs text-[#6B7280] bg-white px-2 py-1 rounded">
                    {(code.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CPT Codes - Solo para administradores */}
      {isAdministrator && transcription?.cpt_codes && transcription.cpt_codes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaCode className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Códigos CPT + Modificadores</h3>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {transcription.cpt_codes.map((code: CPTCode, idx: number) => (
              <div key={idx} className="bg-[#F0F8FF] rounded-lg p-3 border border-[#E0F2FF]">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-semibold text-[#5FA9DF] text-lg">{code.code}</span>
                      {code.modifier && (
                        <span className="font-mono text-[#4A9BCE] text-sm">-{code.modifier}</span>
                      )}
                    </div>
                    <p className="text-[#3C4147] mt-1">{code.description}</p>
                  </div>
                  <span className="text-xs text-[#6B7280] bg-white px-2 py-1 rounded">
                    {(code.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CMS-1500 Form - Solo para administradores */}
      {isAdministrator && transcription?.cms1500_form_data && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <FaFileInvoice className="text-[#5FA9DF]" />
            <h3 className="text-lg font-semibold text-[#0C1523]">Formulario CMS-1500</h3>
          </div>
          <div className="bg-[#F0F8FF] rounded-xl p-4 border border-[#E0F2FF] max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {transcription.cms1500_form_data.patient_name && (
                <div>
                  <span className="font-semibold text-[#0C1523]">Paciente:</span>
                  <span className="ml-2 text-[#3C4147]">{transcription.cms1500_form_data.patient_name}</span>
                </div>
              )}
              {transcription.cms1500_form_data.primary_diagnosis && (
                <div>
                  <span className="font-semibold text-[#0C1523]">Diagnóstico Principal:</span>
                  <span className="ml-2 font-mono text-[#5FA9DF]">{transcription.cms1500_form_data.primary_diagnosis}</span>
                </div>
              )}
              {transcription.cms1500_form_data.diagnosis_codes && transcription.cms1500_form_data.diagnosis_codes.length > 0 && (
                <div>
                  <span className="font-semibold text-[#0C1523]">Códigos de Diagnóstico:</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {transcription.cms1500_form_data.diagnosis_codes.map((code, idx) => (
                      <span key={idx} className="font-mono bg-white px-2 py-1 rounded text-sm">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {transcription.cms1500_form_data.procedures && transcription.cms1500_form_data.procedures.length > 0 && (
                <div>
                  <span className="font-semibold text-[#0C1523]">Procedimientos:</span>
                  <div className="mt-2 space-y-2">
                    {transcription.cms1500_form_data.procedures.map((proc, idx) => (
                      <div key={idx} className="bg-white rounded p-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-semibold text-[#5FA9DF]">{proc.cpt_code}</span>
                          {proc.modifier && (
                            <span className="font-mono text-[#4A9BCE]">-{proc.modifier}</span>
                          )}
                          <span className="text-[#3C4147]">{proc.description}</span>
                        </div>
                        {proc.charges && (
                          <div className="text-xs text-[#6B7280] mt-1">
                            Cargos: ${proc.charges}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {transcription.cms1500_form_data.service_date && (
                <div>
                  <span className="font-semibold text-[#0C1523]">Fecha de Servicio:</span>
                  <span className="ml-2 text-[#3C4147]">{transcription.cms1500_form_data.service_date}</span>
                </div>
              )}
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
          <div className="flex items-center justify-between text-xs text-[#6B7280]">
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

