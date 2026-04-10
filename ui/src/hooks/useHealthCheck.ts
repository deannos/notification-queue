import { useEffect, useState } from 'react';

export type HealthStatus = 'ok' | 'degraded' | 'unknown';

export function useHealthCheck(intervalMs = 30_000) {
  const [status, setStatus] = useState<HealthStatus>('unknown');

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/health');
        const data = await res.json() as { status: string };
        setStatus(data.status === 'ok' ? 'ok' : 'degraded');
      } catch {
        setStatus('degraded');
      }
    }

    void check();
    const id = setInterval(() => void check(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return status;
}
