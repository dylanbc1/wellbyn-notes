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
      <div className="w-1/2 border-r border-[#E0F2FF] p-6 overflow-y-auto">
        <TranscriptionPanel
          onTranscriptionComplete={handleTranscriptionComplete}
          onWorkflowStart={handleWorkflowStart}
          onWorkflowComplete={handleWorkflowComplete}
        />
      </div>

      {/* Right Panel - Workflow Results */}
      <div className="w-1/2 p-6 overflow-y-auto bg-[#FAFBFC]">
        <WorkflowResultsPanel
          transcription={currentTranscription}
          isRunning={isWorkflowRunning}
        />
      </div>
    </div>
  );
};

