import React from 'react';
import EHRConnectionPanel from '../components/EHRConnectionPanel';

export const EHRConfig = () => {
  return (
    <div className="flex-1 overflow-y-auto flex justify-center bg-[#F0F8FF]">
      <div className="w-full max-w-3xl px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0C1523] mb-2">
            Configuración de integración EHR
          </h1>
          <p className="text-[#3C4147]">
            Conecta Wellbyn con sistemas EHR para sincronizar transcripciones automáticamente
          </p>
        </div>
        
        <EHRConnectionPanel />
      </div>
    </div>
  );
};
