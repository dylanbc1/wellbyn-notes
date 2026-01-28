import { useState, useRef, useCallback } from 'react';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
  error: string | null;
  onChunkAvailable?: (chunk: Blob) => void;
}

export const useAudioRecorder = (
  onChunkAvailable?: (chunk: Blob) => void,
  options?: { streamingMode?: boolean }
): UseAudioRecorderReturn => {
  const streamingMode = options?.streamingMode ?? false;
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Configuración óptima para audio médico (voz humana)
      const constraints = {
        audio: {
          channelCount: 1, // Mono (suficiente para voz)
          sampleRate: 48000, // 48kHz - alta calidad
          echoCancellation: true, // Cancelación de eco
          noiseSuppression: true, // Supresión de ruido
          autoGainControl: true, // Control automático de ganancia
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Intentar diferentes formatos en orden de preferencia
      // Para voz médica, queremos la mejor calidad posible
      let mimeType = '';
      const types = [
        'audio/webm;codecs=opus', // Opus es excelente para voz
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      if (!mimeType) {
        throw new Error('No hay formatos de audio compatibles en este navegador');
      }
      
      // Configurar con bitrate alto para mejor calidad
      // Usar timeslice para obtener chunks cada 3 segundos para transcripción en tiempo real
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128kbps - alta calidad para voz
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          // Llamar callback para transcripción en tiempo real
          if (onChunkAvailable) {
            console.log('🎤 Chunk disponible:', event.data.size, 'bytes, llamando callback');
            try {
              onChunkAvailable(event.data);
            } catch (err) {
              console.error('❌ Error en callback onChunkAvailable:', err);
            }
          } else {
            console.warn('⚠️ onChunkAvailable callback no está definido');
          }
        } else {
          console.log('ℹ️ Chunk vacío recibido, omitiendo');
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Detener todas las pistas del stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      // Timeslice depende del modo:
      // - Streaming mode (real-time): 250ms para actualizaciones palabra por palabra
      // - Normal mode: 6000ms para chunks más válidos
      const timeslice = streamingMode ? 250 : 6000;
      console.log(`🎤 Starting recording with timeslice: ${timeslice}ms (streaming: ${streamingMode})`);
      mediaRecorder.start(timeslice);
      setIsRecording(true);
      
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000));
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('No se pudo acceder al micrófono. Por favor, verifica los permisos.');
    }
  }, [onChunkAvailable]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      pausedTimeRef.current += Date.now() - startTimeRef.current;
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now();
    }
  }, [isRecording, isPaused]);

  const clearRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    pausedTimeRef.current = 0;
    chunksRef.current = [];
  }, [audioUrl]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    error,
  };
};

