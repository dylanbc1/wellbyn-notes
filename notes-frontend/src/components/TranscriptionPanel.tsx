import { useState, useRef, useCallback, useEffect } from 'react';
import { FaMicrophone, FaStop, FaPause, FaPlay, FaTrash, FaFileUpload, FaSpinner, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { transcribeAudio, runFullWorkflow, transcribeAudioChunk } from '../services/api';
import type { Transcription } from '../types';
import Button from './Button';

interface TranscriptionPanelProps {
  onTranscriptionComplete: (transcription: Transcription) => void;
  onWorkflowStart: () => void;
  onWorkflowComplete: (transcription: Transcription) => void;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  onTranscriptionComplete,
  onWorkflowStart,
  onWorkflowComplete,
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState<Transcription | null>(null);
  const [isTranscriptionExpanded, setIsTranscriptionExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Transcripción en tiempo real
  const [realtimeText, setRealtimeText] = useState<string>('');
  const [isRealtimeTranscribing, setIsRealtimeTranscribing] = useState(false);
  const processingQueueRef = useRef<Set<string>>(new Set());
  const lastProcessedTextRef = useRef<string>('');
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef<boolean>(false);
  // Buffer para acumular chunks y crear archivos válidos
  const audioChunksBufferRef = useRef<Blob[]>([]);
  const bufferProcessingRef = useRef<boolean>(false);
  const bufferTimeoutRef = useRef<number | null>(null);
  const processedChunksCountRef = useRef<number>(0); // Contador de chunks ya procesados
  
  const TRANSCRIPTION_PREVIEW_LENGTH = 500;

  // Función auxiliar para deduplicar y combinar texto
  const mergeTranscriptionText = useCallback((existingText: string, newText: string): string => {
    if (!existingText) return newText.trim();
    if (!newText || !newText.trim()) return existingText;
    
    const existingWords = existingText.trim().split(/\s+/);
    const newWords = newText.trim().split(/\s+/);
    
    // Detectar solapamiento: buscar si las últimas palabras del texto existente
    // coinciden con las primeras palabras del nuevo texto
    let overlapStart = -1;
    const maxOverlap = Math.min(existingWords.length, newWords.length, 15); // Aumentado a 15 palabras
    
    // Buscar solapamiento desde el final del texto existente
    for (let overlapLen = maxOverlap; overlapLen > 0; overlapLen--) {
      const existingEnd = existingWords.slice(-overlapLen).join(' ').toLowerCase();
      const newStart = newWords.slice(0, overlapLen).join(' ').toLowerCase();
      
      // Ser más estricto con el matching para evitar falsos positivos
      if (existingEnd === newStart && existingEnd.length > 10) { // Aumentado a 10 caracteres
        overlapStart = overlapLen;
        console.log(`🔗 Solapamiento detectado: ${overlapLen} palabras`);
        break;
      }
    }
    
    if (overlapStart > 0) {
      // Hay solapamiento, solo agregar las palabras nuevas que no están solapadas
      const uniqueNewWords = newWords.slice(overlapStart);
      if (uniqueNewWords.length > 0) {
        return existingText + ' ' + uniqueNewWords.join(' ');
      } else {
        // No hay palabras nuevas, podría ser duplicado completo
        console.log('⏭️ Chunk completamente solapado, omitiendo');
        return existingText;
      }
    } else {
      // No hay solapamiento claro, agregar normalmente
      // Ser muy permisivo - solo rechazar duplicados exactos muy largos
      const existingLower = existingText.trim().toLowerCase();
      const newLower = newText.trim().toLowerCase();
      
      // Solo rechazar si el nuevo texto es muy largo (más de 50 caracteres) y está completamente contenido
      // Esto permite que texto similar pero no idéntico pase
      if (existingLower === newLower && newLower.length > 20) {
        // Duplicado exacto y largo, no agregar
        console.log('⏭️ Duplicado exacto largo, omitiendo');
        return existingText;
      }
      
      // Verificar si el nuevo texto está completamente contenido en el existente (más estricto)
      if (existingLower.includes(newLower) && newLower.length > 15) {
        // El nuevo texto ya está en el existente, no agregar
        console.log('⏭️ Texto ya contenido en el existente, omitiendo');
        return existingText;
      }
      
      // Verificar si el texto existente termina con el inicio del nuevo texto (solapamiento no detectado)
      const existingLastWords = existingWords.slice(-5).join(' ').toLowerCase(); // Últimas 5 palabras
      const newFirstWords = newWords.slice(0, 5).join(' ').toLowerCase(); // Primeras 5 palabras
      
      if (existingLastWords === newFirstWords && existingLastWords.length > 10) {
        // Hay solapamiento no detectado, solo agregar las palabras nuevas
        const uniqueNewWords = newWords.slice(5);
        if (uniqueNewWords.length > 0) {
          console.log('🔗 Solapamiento no detectado, agregando solo palabras nuevas');
          return existingText + ' ' + uniqueNewWords.join(' ');
        } else {
          console.log('⏭️ Todo el texto nuevo está solapado');
          return existingText;
        }
      }
      
      // Agregar el nuevo texto
      return existingText + ' ' + newText.trim();
    }
  }, []);

  // Función auxiliar para extraer solo el texto nuevo comparando dos transcripciones completas
  const extractNewText = useCallback((previousText: string, newFullText: string): string => {
    if (!previousText) return newFullText;
    
    const prevLower = previousText.toLowerCase().trim();
    const newLower = newFullText.toLowerCase().trim();
    
    // Si son iguales, no hay texto nuevo
    if (prevLower === newLower) {
      console.log('🔍 Textos idénticos, no hay texto nuevo');
      return '';
    }
    
    // CASO 1: El texto nuevo contiene completamente el anterior al inicio (caso más común)
    // Ejemplo: prev="hola buenas" new="hola buenas tardes" → extraer "tardes"
    if (newLower.startsWith(prevLower) && prevLower.length > 10) {
      const remaining = newFullText.substring(previousText.length).trim();
      if (remaining.length > 0) {
        console.log('🔍 Caso 1: Texto nuevo contiene anterior al inicio, extraído:', remaining.substring(0, 50));
        return remaining;
      }
    }
    
    // CASO 2: Buscar solapamiento al final del anterior con inicio del nuevo
    // Ejemplo: prev="...estamos aquí" new="estamos aquí diciendo" → extraer "diciendo"
    const prevWords = prevLower.split(/\s+/);
    const newWords = newLower.split(/\s+/);
    
    let bestMatchIndex = -1;
    const maxCheck = Math.min(prevWords.length, newWords.length, 15);
    
    for (let i = maxCheck; i >= 3; i--) {
      const prevEnd = prevWords.slice(-i).join(' ');
      const newStart = newWords.slice(0, i).join(' ');
      
      if (prevEnd === newStart && prevEnd.length > 10) {
        bestMatchIndex = i;
        console.log(`🔍 Caso 2: Solapamiento encontrado: ${i} palabras`);
        break;
      }
    }
    
    if (bestMatchIndex > 0) {
      const newWordsOnly = newWords.slice(bestMatchIndex);
      if (newWordsOnly.length > 0) {
        const originalNewWords = newFullText.trim().split(/\s+/);
        const extracted = originalNewWords.slice(bestMatchIndex).join(' ');
        console.log('🔍 Texto nuevo extraído por solapamiento:', extracted.substring(0, 50));
        return extracted;
      }
      return '';
    }
    
    // CASO 3: El texto anterior está contenido en el nuevo pero no al inicio
    // Buscar la posición donde comienza el texto anterior en el nuevo
    const index = newLower.indexOf(prevLower);
    if (index > 0 && prevLower.length > 20) {
      // El texto anterior está en el medio, extraer lo que viene después
      const afterIndex = index + prevLower.length;
      const remaining = newFullText.substring(afterIndex).trim();
      if (remaining.length > 0) {
        console.log('🔍 Caso 3: Texto anterior en posición intermedia, extraído:', remaining.substring(0, 50));
        return remaining;
      }
    }
    
    // CASO 4: Si no encontramos match claro, el texto nuevo es completamente diferente
    // En este caso, devolver vacío para evitar duplicación (mejor no agregar nada que duplicar)
    console.log('⚠️ No se encontró relación clara entre textos, omitiendo para evitar duplicación');
    return '';
  }, []);

  // Función para procesar chunks acumulados
  const processAccumulatedBuffer = useCallback(async () => {
    if (bufferProcessingRef.current || audioChunksBufferRef.current.length === 0 || isPausedRef.current) {
      return;
    }
    
    // Necesitamos al menos 2 chunks (el primero tiene headers, los demás son datos)
    if (audioChunksBufferRef.current.length < 2) {
      return;
    }
    
    // Solo procesar si hay chunks nuevos que no hemos procesado
    const totalChunks = audioChunksBufferRef.current.length;
    const processedChunks = processedChunksCountRef.current;
    
    if (totalChunks <= processedChunks) {
      console.log('⏭️ No hay chunks nuevos para procesar');
      return; // No hay chunks nuevos
    }
    
    // Marcar como procesando ANTES de empezar para evitar procesamiento paralelo
    bufferProcessingRef.current = true;
    setIsRealtimeTranscribing(true);
    
    try {
      // SIEMPRE procesar el buffer completo (necesario para WebM válido)
      // El primer chunk tiene los headers, necesitamos incluirlo siempre
      const combinedBlob = new Blob(audioChunksBufferRef.current, { type: 'audio/webm' });
      
      const isFirstTime = processedChunks === 0;
      console.log(`📦 Procesando buffer completo: ${totalChunks} chunks (${isFirstTime ? 'primera vez' : `desde chunk ${processedChunks + 1}`})`);
      
      const result = await transcribeAudioChunk(combinedBlob);
      console.log('✅ Resultado de transcripción:', result);
      
      if (result.status === 'success' && result.text && result.text.trim()) {
        const fullTranscribedText = result.text.trim();
        
        if (isFirstTime) {
          // Primera vez: usar todo el texto directamente
          setRealtimeText(fullTranscribedText);
          lastProcessedTextRef.current = fullTranscribedText;
          processedChunksCountRef.current = totalChunks;
          console.log('📄 Texto inicial establecido:', fullTranscribedText.substring(0, 50));
        } else {
          // Procesos siguientes: intentar extraer solo lo nuevo, pero si no se puede, reemplazar completamente
          setRealtimeText(prev => {
            if (!prev) {
              lastProcessedTextRef.current = fullTranscribedText;
              processedChunksCountRef.current = totalChunks;
              return fullTranscribedText;
            }
            
            // El texto transcrito es COMPLETO (todo el buffer), intentar extraer solo la parte nueva
            const newTextOnly = extractNewText(prev, fullTranscribedText);
            
            if (newTextOnly && newTextOnly.length > 0) {
              // Solo agregar la parte nueva al texto anterior
              const updated = prev.trim() + ' ' + newTextOnly.trim();
              lastProcessedTextRef.current = fullTranscribedText; // Guardar el texto completo para la próxima comparación
              processedChunksCountRef.current = totalChunks;
              console.log('📄 Texto nuevo extraído y agregado:', newTextOnly.substring(0, 80));
              
              setTimeout(() => {
                scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }, 100);
              
              return updated;
            } else {
              // No se pudo extraer solo lo nuevo, reemplazar completamente con el texto nuevo
              // Esto evita duplicaciones y asegura que siempre tengamos la transcripción más actualizada
              console.log('🔄 Reemplazando texto completo (no se pudo extraer solo lo nuevo)');
              console.log('📄 Texto anterior (últimos 80 chars):', prev.substring(Math.max(0, prev.length - 80)));
              console.log('📄 Texto nuevo completo (primeros 80 chars):', fullTranscribedText.substring(0, 80));
              
              lastProcessedTextRef.current = fullTranscribedText;
              processedChunksCountRef.current = totalChunks;
              
              setTimeout(() => {
                scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }, 100);
              
              return fullTranscribedText;
            }
          });
        }
      } else if (result.status === 'error') {
        console.warn('⚠️ Error en transcripción del buffer:', result.message || result);
        // No actualizar processedChunksCountRef si hay error, para reintentar
      }
      
    } catch (err: any) {
      console.error('❌ Error procesando buffer:', err);
      // No actualizar processedChunksCountRef si hay error
    } finally {
      bufferProcessingRef.current = false;
      setIsRealtimeTranscribing(false);
    }
  }, [extractNewText]);

  // Función para procesar chunks en tiempo real
  const handleChunkAvailable = useCallback(async (chunk: Blob) => {
    // Solo procesar si el chunk tiene datos y no está pausado
    if (chunk.size === 0 || isPausedRef.current) {
      return;
    }
    
    const currentBufferLength = audioChunksBufferRef.current.length;
    console.log('🎤 Chunk recibido:', chunk.size, 'bytes, total en buffer:', currentBufferLength + 1);
    
    // Agregar chunk al buffer (siempre mantener todos los chunks desde el inicio)
    audioChunksBufferRef.current.push(chunk);
    
    // Cancelar timeout anterior si existe para evitar procesamiento múltiple
    if (bufferTimeoutRef.current !== null) {
      clearTimeout(bufferTimeoutRef.current);
      bufferTimeoutRef.current = null;
    }
    
    // Solo procesar si hay chunks nuevos que no hemos procesado
    const hasNewChunks = (currentBufferLength + 1) > processedChunksCountRef.current;
    
    if (hasNewChunks) {
      // Procesar el buffer después de un pequeño delay para acumular más chunks
      bufferTimeoutRef.current = window.setTimeout(() => {
        // Verificar nuevamente antes de procesar (puede haber cambiado)
        if ((audioChunksBufferRef.current.length > processedChunksCountRef.current) && !bufferProcessingRef.current) {
          processAccumulatedBuffer();
        }
        bufferTimeoutRef.current = null;
      }, 2000); // Esperar 2 segundos para acumular más chunks y evitar procesamiento excesivo
    }
    
  }, [processAccumulatedBuffer]);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording: originalStartRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    error: recorderError,
  } = useAudioRecorder(handleChunkAvailable);

  // Sincronizar ref con el estado de pausa
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Wrapper para limpiar texto en tiempo real al iniciar nueva grabación
  const startRecording = useCallback(async () => {
    console.log('🎬 Iniciando nueva grabación, limpiando estado...');
    setRealtimeText(''); // Limpiar transcripción anterior
    lastProcessedTextRef.current = ''; // Limpiar referencia de último texto
    processingQueueRef.current.clear(); // Limpiar cola de procesamiento
    audioChunksBufferRef.current = []; // Limpiar buffer de chunks
    bufferProcessingRef.current = false; // Resetear flag de procesamiento
    processedChunksCountRef.current = 0; // Resetear contador de chunks procesados
    if (bufferTimeoutRef.current !== null) {
      clearTimeout(bufferTimeoutRef.current);
      bufferTimeoutRef.current = null;
    }
    setIsRealtimeTranscribing(false); // Resetear estado de transcripción
    await originalStartRecording();
    console.log('✅ Grabación iniciada');
  }, [originalStartRecording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/flac', 'audio/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|flac|webm)$/i)) {
      setError('Tipo de archivo no válido. Usa MP3, WAV, M4A, OGG, FLAC o WEBM.');
      return;
    }

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`El archivo es muy grande (${formatFileSize(file.size)}). Máximo: 25MB`);
      return;
    }

    setError(null);
    setUploadedFile(file);
    
    if (audioUrl) {
      clearRecording();
    }
    
    if (uploadedAudioUrl) {
      URL.revokeObjectURL(uploadedAudioUrl);
    }
    const url = URL.createObjectURL(file);
    setUploadedAudioUrl(url);
  };

  const clearUploadedFile = () => {
    if (uploadedAudioUrl) {
      URL.revokeObjectURL(uploadedAudioUrl);
    }
    setUploadedFile(null);
    setUploadedAudioUrl(null);
    setCurrentTranscription(null);
    setIsTranscriptionExpanded(false);
    setRealtimeText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTranscribe = async () => {
    const fileToTranscribe = uploadedFile || (audioBlob ? new File([audioBlob], 'recording.webm', { type: audioBlob.type }) : null);
    
    if (!fileToTranscribe) return;

    setIsTranscribing(true);
    setError(null);

    try {
      // Transcribir audio
      const transcription = await transcribeAudio(fileToTranscribe);
      setCurrentTranscription(transcription);
      onTranscriptionComplete(transcription);
      
      // Limpiar archivo/grabación después de transcribir (pero mantener la transcripción visible)
      if (uploadedFile) {
        // Limpiar el archivo pero mantener la transcripción
        if (uploadedAudioUrl) {
          URL.revokeObjectURL(uploadedAudioUrl);
        }
        setUploadedFile(null);
        setUploadedAudioUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        clearRecording();
      }
      
      // Limpiar transcripción en tiempo real cuando se completa la transcripción final
      setRealtimeText('');

      // Ejecutar workflow automáticamente
      setIsRunningWorkflow(true);
      onWorkflowStart();
      
      try {
        const workflowResult = await runFullWorkflow(transcription.id);
        if (workflowResult.transcription) {
          setCurrentTranscription(workflowResult.transcription);
          onWorkflowComplete(workflowResult.transcription);
        }
      } catch (workflowError: any) {
        console.error('Error running workflow:', workflowError);
        setError(`Transcripción completada, pero error en workflow: ${workflowError.response?.data?.detail || workflowError.message}`);
      } finally {
        setIsRunningWorkflow(false);
      }
    } catch (err: any) {
      console.error('Error transcribing audio:', err);
      setError(err.response?.data?.detail || 'Error al transcribir el audio. Intenta de nuevo.');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Grabación de Consulta
          </h2>
          <p className="text-gray-600 text-sm">
            Inicia una nueva consulta médica
          </p>
        </div>
      </div>

      {/* Error Messages */}
      {(error || recorderError) && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error || recorderError}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex flex-col items-center space-y-4 mb-6">
        {/* Recording Timer */}
        {isRecording && (
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-3xl font-mono font-bold text-[#0C1523]">
              {formatTime(recordingTime)}
            </span>
          </div>
        )}

        {/* Main Recording Button */}
        <div className="flex items-center space-x-4">
          {!isRecording && !audioBlob && !uploadedFile && (
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-pink-600 text-white flex items-center justify-center shadow-lg hover:shadow-2xl transform hover:scale-110 transition-all duration-200"
            >
              <FaMicrophone className="text-3xl" />
            </button>
          )}

          {isRecording && (
            <>
              <button
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="w-16 h-16 rounded-full bg-yellow-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                {isPaused ? <FaPlay className="text-2xl" /> : <FaPause className="text-2xl" />}
              </button>

              <button
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center shadow-lg hover:shadow-2xl transform hover:scale-110 transition-all duration-200"
              >
                <FaStop className="text-3xl" />
              </button>
            </>
          )}
        </div>

        {/* Status Text */}
        <div className="text-center">
          <p className="text-sm text-gray-700 font-medium">
            {!isRecording && !audioBlob && !uploadedFile && 'Presiona el micrófono para iniciar la consulta'}
            {isRecording && !isPaused && 'Grabando consulta...'}
            {isRecording && isPaused && 'Grabación pausada'}
            {audioBlob && !isTranscribing && 'Audio listo para procesar'}
            {uploadedFile && !isTranscribing && 'Archivo listo para procesar'}
            {isTranscribing && 'Transcribiendo consulta...'}
            {isRunningWorkflow && 'Generando nota médica y códigos...'}
          </p>
          {(isTranscribing || isRunningWorkflow) && (
            <p className="text-xs text-gray-500 mt-1">
              Por favor espera, esto puede tomar unos momentos
            </p>
          )}
        </div>

        {/* File Upload Button */}
        {!isRecording && !audioBlob && !uploadedFile && (
          <div className="w-full max-w-md">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
              onChange={handleFileUpload}
              className="hidden"
              id="audio-upload"
            />
            <label
              htmlFor="audio-upload"
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-[#5FA9DF] text-white rounded-full cursor-pointer hover:bg-[#4A9BCE] transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 font-medium"
            >
              <FaFileUpload className="text-xl" />
              <span>Subir archivo de audio</span>
            </label>
            <p className="text-xs text-[#6B7280] text-center mt-2">
              MP3, WAV, M4A, OGG, FLAC o WEBM (max. 25MB)
            </p>
          </div>
        )}

        {/* Audio Player */}
        {((audioUrl && !isRecording) || uploadedFile) && (
          <div className="w-full space-y-4">
            <div className="bg-[#F0F8FF] rounded-xl p-4 border border-[#E0F2FF]">
              {uploadedFile && (
                <div className="mb-3 pb-3 border-b border-[#E0F2FF]">
                  <p className="text-sm text-[#3C4147] mb-1">Archivo:</p>
                  <p className="text-sm font-medium text-[#0C1523]">{uploadedFile.name}</p>
                  <p className="text-xs text-[#6B7280]">
                    Tamaño: {formatFileSize(uploadedFile.size)}
                  </p>
                </div>
              )}
              <audio src={uploadedFile ? uploadedAudioUrl || '' : audioUrl || ''} controls className="w-full" />
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleTranscribe}
                disabled={isTranscribing || isRunningWorkflow}
                variant="blue"
                fullWidth
                className="flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTranscribing || isRunningWorkflow ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>{isTranscribing ? 'Transcribiendo...' : 'Ejecutando workflow...'}</span>
                  </>
                ) : (
                  <span>Transcribir y Ejecutar</span>
                )}
              </Button>

              <Button
                onClick={() => {
                  if (uploadedFile) {
                    clearUploadedFile();
                  } else {
                    clearRecording();
                    setCurrentTranscription(null);
                    setIsTranscriptionExpanded(false);
                  }
                  // No limpiar realtimeText aquí, solo cuando se inicia una nueva grabación
                }}
                disabled={isTranscribing || isRunningWorkflow}
                variant="white"
                className="flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <FaTrash />
                <span>Descartar</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Transcripción en Tiempo Real - Mostrar durante la grabación y después si hay texto */}
      {(isRecording || realtimeText) && (
        <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 shadow-md transition-all duration-300">
          <div className="flex items-center space-x-2 mb-3">
            <div className="relative">
              {isRecording && (
                <>
                  <FaSpinner className={`text-blue-600 text-lg ${isRealtimeTranscribing ? 'animate-spin' : ''}`} />
                  {isRealtimeTranscribing && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
                    </div>
                  )}
                </>
              )}
              {!isRecording && realtimeText && (
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              )}
            </div>
            <h3 className="text-base font-semibold text-blue-900">
              {isRecording ? 'Transcripción en Tiempo Real' : 'Transcripción de la Grabación'}
            </h3>
            {isRecording && isPaused && (
              <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">Pausado</span>
            )}
            {isRecording && !isPaused && !isRealtimeTranscribing && realtimeText && (
              <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-1 rounded animate-pulse">Escuchando</span>
            )}
            {!isRecording && realtimeText && (
              <span className="ml-2 text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">Grabación finalizada</span>
            )}
          </div>
          <div className="min-h-[150px] max-h-[300px] bg-white rounded-lg p-4 border border-blue-200 overflow-y-auto transition-all duration-200">
            {realtimeText ? (
              <div className="relative">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm transition-opacity duration-200">
                  {realtimeText}
                  {isRecording && isRealtimeTranscribing && (
                    <span className="inline-block ml-1 animate-pulse text-blue-600">▊</span>
                  )}
                </p>
                {/* Auto-scroll al final cuando hay nuevo texto */}
                <div ref={scrollEndRef} className="h-0" />
              </div>
            ) : (
              <p className="text-gray-400 italic text-sm text-center py-8">
                {isRealtimeTranscribing 
                  ? (
                    <span className="flex items-center justify-center space-x-2">
                      <FaSpinner className="animate-spin" />
                      <span>Procesando audio...</span>
                    </span>
                  )
                  : 'Habla para ver la transcripción en tiempo real'}
              </p>
            )}
          </div>
          {realtimeText && (
            <div className="mt-2 flex items-center justify-between text-xs">
              <p className="text-blue-700">
                {isRecording ? 'Actualización cada 6s' : 'Transcripción completada'}
              </p>
              <p className="text-blue-600 font-medium">
                {realtimeText.split(/\s+/).length} palabras
              </p>
            </div>
          )}
        </div>
      )}

      {/* Transcription Text */}
      {currentTranscription && (
        <div className="flex-1 flex flex-col border-t border-gray-200 pt-6 mt-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FaFileUpload className="text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Transcripción de la Consulta</h3>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl p-6 border border-gray-200 overflow-y-auto shadow-inner">
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base font-mono">
              {isTranscriptionExpanded || currentTranscription.text.length <= TRANSCRIPTION_PREVIEW_LENGTH
                ? currentTranscription.text
                : `${currentTranscription.text.slice(0, TRANSCRIPTION_PREVIEW_LENGTH)}...`}
            </p>
          </div>
          {currentTranscription.text.length > TRANSCRIPTION_PREVIEW_LENGTH && (
            <button
              onClick={() => setIsTranscriptionExpanded(!isTranscriptionExpanded)}
              className="mt-4 w-full flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-700 text-sm font-medium py-2 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-blue-200"
            >
              {isTranscriptionExpanded ? (
                <>
                  <span>Ver menos</span>
                  <FaChevronUp />
                </>
              ) : (
                <>
                  <span>Ver más</span>
                  <FaChevronDown />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

