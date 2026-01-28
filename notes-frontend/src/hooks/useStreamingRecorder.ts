import { useState, useRef, useCallback, useEffect } from 'react';

interface UseStreamingRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  // For final audio blob (optional, for fallback)
  audioBlob: Blob | null;
  audioUrl: string | null;
  clearRecording: () => void;
}

interface UseStreamingRecorderOptions {
  onAudioData: (data: ArrayBuffer) => void;
  sampleRate?: number;
}

/**
 * Hook for streaming audio recording using Web Audio API
 * Captures raw PCM audio and sends it via callback for real-time streaming
 */
export const useStreamingRecorder = (options: UseStreamingRecorderOptions): UseStreamingRecorderReturn => {
  const { onAudioData, sampleRate = 16000 } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  
  // Also keep MediaRecorder for final audio blob
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Create AudioWorklet processor inline as a Blob URL
  const createWorkletProcessor = useCallback(() => {
    const processorCode = `
      class StreamingProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 4096;
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
        }
        
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input[0]) {
            const inputData = input[0];
            
            for (let i = 0; i < inputData.length; i++) {
              this.buffer[this.bufferIndex++] = inputData[i];
              
              if (this.bufferIndex >= this.bufferSize) {
                // Convert float32 to int16
                const int16Buffer = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                  const s = Math.max(-1, Math.min(1, this.buffer[j]));
                  int16Buffer[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                this.port.postMessage(int16Buffer.buffer, [int16Buffer.buffer]);
                this.buffer = new Float32Array(this.bufferSize);
                this.bufferIndex = 0;
              }
            }
          }
          return true;
        }
      }
      
      registerProcessor('streaming-processor', StreamingProcessor);
    `;
    
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      isPausedRef.current = false;
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000, // Browser native, we'll downsample
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      mediaStreamRef.current = stream;
      
      // Create AudioContext with target sample rate
      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;
      
      // Create source from microphone
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      // Load and create AudioWorklet
      const workletUrl = createWorkletProcessor();
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);
      
      const workletNode = new AudioWorkletNode(audioContext, 'streaming-processor');
      workletNodeRef.current = workletNode;
      
      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        if (!isPausedRef.current && event.data) {
          onAudioData(event.data);
        }
      };
      
      // Connect: source -> worklet
      source.connect(workletNode);
      // Don't connect to destination (we don't want to hear ourselves)
      
      // Also set up MediaRecorder for final blob
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect chunks every second for final blob
      
      setIsRecording(true);
      setIsPaused(false);
      
      // Start timer
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      timerRef.current = window.setInterval(() => {
        if (!isPausedRef.current) {
          setRecordingTime(Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000));
        }
      }, 1000);
      
      console.log('🎤 Streaming recording started (PCM 16kHz)');
      
    } catch (err) {
      console.error('Error starting streaming recording:', err);
      setError('No se pudo acceder al micrófono. Por favor, verifica los permisos.');
    }
  }, [onAudioData, sampleRate, createWorkletProcessor]);

  const stopRecording = useCallback(() => {
    console.log('🛑 Stopping streaming recording');
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Disconnect and close worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const pauseRecording = useCallback(() => {
    if (isRecording && !isPaused) {
      isPausedRef.current = true;
      setIsPaused(true);
      pausedTimeRef.current = Date.now() - startTimeRef.current - pausedTimeRef.current;
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
      
      console.log('⏸️ Recording paused');
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (isRecording && isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      startTimeRef.current = Date.now();
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
      
      console.log('▶️ Recording resumed');
    }
  }, [isRecording, isPaused]);

  const clearRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    chunksRef.current = [];
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    audioBlob,
    audioUrl,
    clearRecording,
  };
};
