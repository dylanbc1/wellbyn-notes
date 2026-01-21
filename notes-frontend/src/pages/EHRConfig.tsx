import React from 'react';
import EHRConnectionPanel from '../components/EHRConnectionPanel';

export const EHRConfig = () => {
  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#0C1523] mb-2">
            Configuración de Integración EHR
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
