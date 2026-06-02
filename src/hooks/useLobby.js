import { useEffect, useState } from 'react';
import { subscribeLobby } from '../services/lobby';

// Подписка на документ лобби в реальном времени.
export function useLobby(code) {
  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    const unsub = subscribeLobby(
      code,
      (data) => {
        setLobby(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [code]);

  return { lobby, loading, error };
}
