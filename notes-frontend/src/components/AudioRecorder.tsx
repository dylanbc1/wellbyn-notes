import { useState, useRef } from 'react';
import { FaMicrophone, FaStop, FaPause, FaPlay, FaTrash, FaPaperPlane, FaFileUpload } from 'react-icons/fa';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { transcribeAudio } from '../services/api';
import type { Transcription } from '../types';
import Button from './Button';

interface AudioRecorderProps {
  onTranscriptionComplete: (transcription: Transcription) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionComplete }) => {
  const {
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
    error: recorderError,
  } = useAudioRecorder();

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Validar tipo de archivo
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/flac', 'audio/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|flac|webm)$/i)) {
      setError('Tipo de archivo no válido. Usa MP3, WAV, M4A, OGG, FLAC o WEBM.');
      return;
    }

    // Validar tamaño (máximo 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`El archivo es muy grande (${formatFileSize(file.size)}). Máximo: 25MB`);
      return;
    }

    setError(null);
    setUploadedFile(file);
    
    // Limpiar grabación previa si existe
    if (audioUrl) {
      clearRecording();
    }
    
    // Crear URL para preview
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
      const transcription = await transcribeAudio(fileToTranscribe);
      onTranscriptionComplete(transcription);
      
      // Limpiar después de transcribir
      if (uploadedFile) {
        clearUploadedFile();
      } else {
        clearRecording();
      }
    } catch (err: any) {
      console.error('Error transcribing audio:', err);
      setError(err.response?.data?.detail || 'Error al transcribir el audio. Intenta de nuevo.');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="card max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-[#0C1523] mb-2">
          Audio Recording
        </h2>
        <p className="text-[#3C4147]">
          Record your audio or upload a file to get the transcription
        </p>
        <p className="text-sm text-[#6B7280] mt-1">
          Using Whisper Base (local model, fast)
        </p>
      </div>

      {/* Error Messages */}
      {(error || recorderError) && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || recorderError}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex flex-col items-center space-y-6">
        
        {/* Recording Timer */}
        {isRecording && (
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-4xl font-mono font-bold text-[#0C1523]">
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
        <p className="text-sm text-[#3C4147] font-medium">
          {!isRecording && !audioBlob && !uploadedFile && 'Press the microphone to record or upload an audio file'}
          {isRecording && !isPaused && 'Recording...'}
          {isRecording && isPaused && 'Paused'}
          {audioBlob && !isTranscribing && 'Audio ready to transcribe'}
          {uploadedFile && !isTranscribing && 'File ready to transcribe'}
          {isTranscribing && 'Transcribing audio...'}
        </p>

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
              <span>Upload audio file</span>
            </label>
            <p className="text-xs text-[#6B7280] text-center mt-2">
              MP3, WAV, M4A, OGG, FLAC or WEBM (max. 25MB)
            </p>
          </div>
        )}

        {/* Audio Player */}
        {((audioUrl && !isRecording) || uploadedFile) && (
          <div className="w-full space-y-4">
            <div className="bg-[#F0F8FF] rounded-xl p-4 border border-[#E0F2FF]">
              {uploadedFile && (
                <div className="mb-3 pb-3 border-b border-[#E0F2FF]">
                  <p className="text-sm text-[#3C4147] mb-1">File:</p>
                  <p className="text-sm font-medium text-[#0C1523]">{uploadedFile.name}</p>
                  <p className="text-xs text-[#6B7280]">
                    Size: {formatFileSize(uploadedFile.size)} 
                    {uploadedFile.type && ` - Type: ${uploadedFile.type.split('/')[1]?.toUpperCase()}`}
                  </p>
                </div>
              )}
              <p className="text-sm text-[#3C4147] mb-2">
                {uploadedFile ? 'Play:' : 'Audio preview:'}
              </p>
              <audio src={uploadedFile ? uploadedAudioUrl || '' : audioUrl || ''} controls className="w-full" />
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                variant="blue"
                fullWidth
                className="flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <FaPaperPlane />
                <span>{isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}</span>
              </Button>

              <Button
                onClick={uploadedFile ? clearUploadedFile : clearRecording}
                disabled={isTranscribing}
                variant="white"
                className="flex items-center justify-center space-x-2 disabled:opacity-50 disabled:hover:scale-100"
              >
                <FaTrash />
                <span>Discard</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!isRecording && !audioBlob && !uploadedFile && (
        <div className="mt-6 pt-6 border-t border-[#E0F2FF]">
          <h3 className="font-semibold text-[#0C1523] mb-2">Tips for better quality:</h3>
          <ul className="text-sm text-[#3C4147] space-y-1 list-disc list-inside">
            <li>Speak clearly and close to the microphone</li>
            <li>Avoid background noise for better results</li>
            <li>You can pause and resume recording at any time</li>
            <li>Supported formats: MP3, WAV, M4A, OGG, FLAC, WEBM</li>
          </ul>
        </div>
      )}
    </div>
  );
};

