import { useState } from 'react';
import { TranscriptionPanel } from '../components/TranscriptionPanel';
import { WorkflowResultsPanel } from '../components/WorkflowResultsPanel';
import type { Transcription } from '../types';

export const Dashboard = () => {
  const [currentTranscription, setCurrentTranscription] = useState<Transcription | null>(null);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);

  const handleTranscriptionComplete = (transcription: Transcription) => {
    setCurrentTranscription(transcription);
  };

  const handleTranscriptionUpdate = (transcription: Transcription) => {
    setCurrentTranscription(transcription);
  };

  const handleWorkflowStart = () => {
    setIsWorkflowRunning(true);
  };

  const handleWorkflowComplete = (transcription: Transcription) => {
    setCurrentTranscription(transcription);
    setIsWorkflowRunning(false);
  };

  return (
    <div className="flex-1 flex h-screen overflow-hidden">
      {/* Left Panel - Audio & Transcription */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 border-r border-[#E0F2FF] bg-white">
        <div className="flex-1 min-h-0 overflow-y-auto flex justify-center">
          <div className="w-full max-w-2xl min-h-full px-8 py-8 flex flex-col">
            <TranscriptionPanel
              onTranscriptionComplete={handleTranscriptionComplete}
              onWorkflowStart={handleWorkflowStart}
              onWorkflowComplete={handleWorkflowComplete}
              onTranscriptionUpdate={handleTranscriptionUpdate}
            />
          </div>
        </div>
      </div>

      {/* Right Panel - Workflow Results */}
      <div className="flex-1 min-w-0 flex justify-center overflow-y-auto bg-[#F0F8FF]">
        <div className="w-full max-w-2xl px-8 py-8">
          <WorkflowResultsPanel
            transcription={currentTranscription}
            isRunning={isWorkflowRunning}
            onTranscriptionUpdate={handleTranscriptionUpdate}
          />
        </div>
      </div>
    </div>
  );
};

