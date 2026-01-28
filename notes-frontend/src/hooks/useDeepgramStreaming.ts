import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDeepgramStreamingReturn {
  isConnected: boolean;
  isConnecting: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  sendAudio: (data: ArrayBuffer | Blob) => void;
  clearTranscript: () => void;
}

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000/api/transcriptions/stream`;

export const useDeepgramStreaming = (): UseDeepgramStreamingReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  
  const connect = useCallback(async (): Promise<boolean> => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return true;
    }
    
    setIsConnecting(true);
    setError(null);
    
    return new Promise((resolve) => {
      try {
        console.log('🔌 Connecting to WebSocket:', WS_URL);
        const ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
          console.log('✅ WebSocket connection opened');
          // Wait for "connected" message from server
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📩 WebSocket message:', data.type, data.text?.substring(0, 50) || '');
            
            switch (data.type) {
              case 'connected':
                console.log('✅ Deepgram connected');
                setIsConnected(true);
                setIsConnecting(false);
                reconnectAttemptsRef.current = 0;
                resolve(true);
                break;
                
              case 'transcript':
                if (data.is_final) {
                  // Final transcript - append to main transcript
                  setTranscript(prev => {
                    const newText = data.text.trim();
                    if (!newText) return prev;
                    // Add space if there's existing text
                    return prev ? `${prev} ${newText}` : newText;
                  });
                  setInterimTranscript('');
                } else {
                  // Interim transcript - show as preview
                  setInterimTranscript(data.text || '');
                }
                break;
                
              case 'error':
                console.error('❌ Deepgram error:', data.message);
                setError(data.message);
                break;
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };
        
        ws.onerror = (event) => {
          console.error('❌ WebSocket error:', event);
          setError('WebSocket connection error');
          setIsConnecting(false);
          resolve(false);
        };
        
        ws.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason);
          setIsConnected(false);
          setIsConnecting(false);
          wsRef.current = null;
          
          // If not a clean close and we haven't exceeded attempts, could reconnect
          if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
            console.log('Connection closed unexpectedly');
          }
        };
        
        wsRef.current = ws;
        
        // Timeout for connection
        setTimeout(() => {
          if (!isConnected && isConnecting) {
            console.error('WebSocket connection timeout');
            setError('Connection timeout');
            setIsConnecting(false);
            ws.close();
            resolve(false);
          }
        }, 10000);
        
      } catch (e) {
        console.error('Error creating WebSocket:', e);
        setError('Failed to create WebSocket connection');
        setIsConnecting(false);
        resolve(false);
      }
    });
  }, [isConnected, isConnecting]);
  
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log('🔌 Disconnecting WebSocket');
      
      // Send stop message
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      }
      
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
    setInterimTranscript('');
  }, []);
  
  const sendAudio = useCallback((data: ArrayBuffer | Blob) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send audio: WebSocket not connected');
      return;
    }
    
    if (data instanceof Blob) {
      // Convert Blob to ArrayBuffer
      data.arrayBuffer().then(buffer => {
        wsRef.current?.send(buffer);
      });
    } else {
      wsRef.current.send(data);
    }
  }, []);
  
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, []);
  
  return {
    isConnected,
    isConnecting,
    transcript,
    interimTranscript,
    error,
    connect,
    disconnect,
    sendAudio,
    clearTranscript,
  };
};
