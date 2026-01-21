import { useState } from 'react';
import { 
  FaTrash, FaClock, FaFileAudio, FaMicrochip, FaChevronDown, FaChevronUp,
  FaFileMedical, FaCode, FaFileInvoice, FaCheckCircle, FaSpinner, FaPlay
} from 'react-icons/fa';
import type { Transcription, ICD10Code, CPTCode } from '../types';
import {
  generateMedicalNote,
  suggestICD10Codes,
  suggestCPTCodes,
  generateCMS1500Form,
  runFullWorkflow,
  getTranscription
} from '../services/api';
import Button from './Button';

interface TranscriptionCardProps {
  transcription: Transcription;
  onDelete: (id: number) => void;
  onUpdate?: (transcription: Transcription) => void;
}

export const TranscriptionCard: React.FC<TranscriptionCardProps> = ({ transcription, onDelete, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de eliminar esta transcripción?')) {
      onDelete(transcription.id);
    }
  };

  const handleWorkflowStep = async (step: string) => {
    setLoadingStep(step);
    try {
      let result;
      switch (step) {
        case 'note':
          result = await generateMedicalNote(transcription.id);
          break;
        case 'icd10':
          result = await suggestICD10Codes(transcription.id);
          break;
        case 'cpt':
          result = await suggestCPTCodes(transcription.id);
          break;
        case 'cms1500':
          result = await generateCMS1500Form(transcription.id);
          break;
        case 'full':
          result = await runFullWorkflow(transcription.id);
          break;
        default:
          return;
      }
      
      if (onUpdate && result.transcription) {
        onUpdate(result.transcription);
      } else {
        // Refresh transcription
        const updated = await getTranscription(transcription.id);
        if (onUpdate) {
          onUpdate(updated);
        }
      }
    } catch (error: any) {
      console.error(`Error in workflow step ${step}:`, error);
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingStep(null);
    }
  };

  const getWorkflowStatus = () => {
    const status = transcription.workflow_status || 'transcribed';
    const steps = [
      { key: 'transcribed', label: 'Transcripción', completed: true },
      { key: 'note_generated', label: 'Nota Médica', completed: status !== 'transcribed' },
      { key: 'codes_suggested', label: 'Códigos', completed: ['codes_suggested', 'form_created'].includes(status) },
      { key: 'form_created', label: 'CMS-1500', completed: status === 'form_created' },
    ];
    return steps;
  };

  return (
    <div className="card hover:shadow-xl transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <FaFileAudio className="text-[#5FA9DF]" />
            <h3 className="font-semibold text-[#0C1523]">{transcription.filename}</h3>
            <span className="text-xs bg-[#E0F2FF] text-[#246B8E] px-2 py-1 rounded-full">
              ID: {transcription.id}
            </span>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-[#3C4147]">
            <div className="flex items-center space-x-1">
              <FaClock className="text-[#6B7280]" />
              <span>{formatDate(transcription.created_at)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <FaMicrochip className="text-[#6B7280]" />
              <span>{transcription.processing_time_seconds}s</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
          title="Eliminar transcripción"
        >
          <FaTrash />
        </button>
      </div>

      {/* Transcription Text Preview */}
      <div className="bg-gradient-to-br from-[#F0F8FF] to-[#E0F2FF] rounded-xl p-4 mb-3">
        <p className="text-[#0C1523] leading-relaxed">
          {isExpanded ? transcription.text : transcription.text.slice(0, 150)}
          {transcription.text.length > 150 && !isExpanded && '...'}
        </p>
      </div>

      {/* Expand Button */}
      {transcription.text.length > 150 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center space-x-2 text-[#5FA9DF] hover:text-[#4A9BCE] text-sm font-medium py-2 hover:bg-[#F0F8FF] rounded-lg transition-all duration-200"
        >
          {isExpanded ? (
            <>
              <span>Mostrar menos</span>
              <FaChevronUp />
            </>
          ) : (
            <>
              <span>Mostrar más</span>
              <FaChevronDown />
            </>
          )}
        </button>
      )}

      {/* Metadata */}
      <div className="mt-3 pt-3 border-t border-[#E0F2FF] flex items-center justify-between text-xs text-[#6B7280]">
        <div className="flex items-center space-x-3">
          <span className="bg-[#F0F8FF] px-2 py-1 rounded">
            {transcription.file_size_mb} MB
          </span>
          <span className="bg-[#E0F2FF] text-[#246B8E] px-2 py-1 rounded">
            {transcription.model}
          </span>
        </div>
        <span className="text-[#6B7280]">{transcription.provider}</span>
      </div>

      {/* Medical Workflow Section */}
      <div className="mt-4 pt-4 border-t-2 border-[#C7E7FF]">
        <button
          onClick={() => setIsWorkflowExpanded(!isWorkflowExpanded)}
          className="w-full flex items-center justify-between text-left mb-3"
        >
          <h4 className="font-semibold text-[#0C1523] flex items-center space-x-2">
            <FaFileMedical className="text-[#5FA9DF]" />
            <span>Flujo Médico</span>
          </h4>
          {isWorkflowExpanded ? <FaChevronUp className="text-[#6B7280]" /> : <FaChevronDown className="text-[#6B7280]" />}
        </button>

        {isWorkflowExpanded && (
          <div className="space-y-4">
            {/* Workflow Steps */}
            <div className="space-y-3">
              {/* Step 1: Transcription (always complete) */}
              <div className="flex items-center space-x-3 p-3 bg-[#E0F2FF] rounded-lg">
                <FaCheckCircle className="text-[#246B8E]" />
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">1. Transcripción</p>
                  <p className="text-sm text-[#3C4147]">Completada</p>
                </div>
              </div>

              {/* Step 2: Medical Note */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                transcription.medical_note ? 'bg-[#E0F2FF]' : 'bg-[#F0F8FF]'
              }`}>
                {transcription.medical_note ? (
                  <FaCheckCircle className="text-[#246B8E]" />
                ) : (
                  <FaFileMedical className="text-[#6B7280]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">2. Nota Médica Generada</p>
                  {transcription.medical_note ? (
                    <div className="mt-2 p-2 bg-white rounded text-sm text-[#3C4147] max-h-32 overflow-y-auto">
                      {transcription.medical_note.substring(0, 200)}...
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleWorkflowStep('note')}
                      disabled={loadingStep === 'note'}
                      variant="white"
                      className="mt-2 text-sm"
                    >
                      {loadingStep === 'note' ? (
                        <><FaSpinner className="animate-spin mr-2" /> Generando...</>
                      ) : (
                        <><FaPlay className="mr-2" /> Generar Nota</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 3: ICD-10 Codes */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                transcription.icd10_codes && transcription.icd10_codes.length > 0 ? 'bg-[#E0F2FF]' : 'bg-[#F0F8FF]'
              }`}>
                {transcription.icd10_codes && transcription.icd10_codes.length > 0 ? (
                  <FaCheckCircle className="text-[#246B8E]" />
                ) : (
                  <FaCode className="text-[#6B7280]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">3. Códigos ICD-10 Sugeridos</p>
                  {transcription.icd10_codes && transcription.icd10_codes.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {transcription.icd10_codes.map((code: ICD10Code, idx: number) => (
                        <div key={idx} className="p-2 bg-white rounded text-sm">
                          <span className="font-mono font-semibold text-[#5FA9DF]">{code.code}</span>
                          <span className="text-[#3C4147] ml-2">{code.description}</span>
                          <span className="text-xs text-[#6B7280] ml-2">({(code.confidence * 100).toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleWorkflowStep('icd10')}
                      disabled={loadingStep === 'icd10' || !transcription.medical_note}
                      variant="white"
                      className="mt-2 text-sm"
                    >
                      {loadingStep === 'icd10' ? (
                        <><FaSpinner className="animate-spin mr-2" /> Sugiriendo...</>
                      ) : (
                        <><FaPlay className="mr-2" /> Sugerir Códigos ICD-10</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 4: CPT Codes */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                transcription.cpt_codes && transcription.cpt_codes.length > 0 ? 'bg-[#E0F2FF]' : 'bg-[#F0F8FF]'
              }`}>
                {transcription.cpt_codes && transcription.cpt_codes.length > 0 ? (
                  <FaCheckCircle className="text-[#246B8E]" />
                ) : (
                  <FaCode className="text-[#6B7280]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">4. Códigos CPT + Modificadores</p>
                  {transcription.cpt_codes && transcription.cpt_codes.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {transcription.cpt_codes.map((code: CPTCode, idx: number) => (
                        <div key={idx} className="p-2 bg-white rounded text-sm">
                          <span className="font-mono font-semibold text-[#5FA9DF]">{code.code}</span>
                          {code.modifier && (
                            <span className="font-mono text-[#4A9BCE] ml-1">-{code.modifier}</span>
                          )}
                          <span className="text-[#3C4147] ml-2">{code.description}</span>
                          <span className="text-xs text-[#6B7280] ml-2">({(code.confidence * 100).toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleWorkflowStep('cpt')}
                      disabled={loadingStep === 'cpt' || !transcription.medical_note}
                      variant="white"
                      className="mt-2 text-sm"
                    >
                      {loadingStep === 'cpt' ? (
                        <><FaSpinner className="animate-spin mr-2" /> Sugiriendo...</>
                      ) : (
                        <><FaPlay className="mr-2" /> Sugerir Códigos CPT</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 5: CMS-1500 Form */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                transcription.cms1500_form_data ? 'bg-[#E0F2FF]' : 'bg-[#F0F8FF]'
              }`}>
                {transcription.cms1500_form_data ? (
                  <FaCheckCircle className="text-[#246B8E]" />
                ) : (
                  <FaFileInvoice className="text-[#6B7280]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">5. Formulario CMS-1500 Generado</p>
                  {transcription.cms1500_form_data ? (
                    <div className="mt-2 p-3 bg-white rounded text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-semibold">Diagnóstico Principal:</span>
                          <span className="ml-2 font-mono">{transcription.cms1500_form_data.primary_diagnosis}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Procedimientos:</span>
                          <span className="ml-2">{transcription.cms1500_form_data.procedures?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleWorkflowStep('cms1500')}
                      disabled={loadingStep === 'cms1500' || !transcription.icd10_codes || !transcription.cpt_codes}
                      variant="white"
                      className="mt-2 text-sm"
                    >
                      {loadingStep === 'cms1500' ? (
                        <><FaSpinner className="animate-spin mr-2" /> Generando...</>
                      ) : (
                        <><FaPlay className="mr-2" /> Generar CMS-1500</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Run Full Workflow Button */}
            {transcription.workflow_status !== 'form_created' && (
              <Button
                onClick={() => handleWorkflowStep('full')}
                disabled={loadingStep === 'full'}
                variant="blue"
                fullWidth
                className="flex items-center justify-center space-x-2 disabled:hover:scale-100"
              >
                {loadingStep === 'full' ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Ejecutando flujo completo...</span>
                  </>
                ) : (
                  <>
                    <FaPlay />
                    <span>Ejecutar Flujo Completo</span>
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

