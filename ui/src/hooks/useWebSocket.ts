import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/api';
import type { Notification } from '../types';

export type WSStatus = 'connected' | 'disconnected';

export function useWebSocket(token: string, onNotification: (n: Notification) => void) {
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cbRef = useRef(onNotification);
  cbRef.current = onNotification;

  const connect = useCallback(async () => {
    if (!token) return;
    try {
      // Exchange JWT for a short-lived ticket so the token never appears in the URL.
      const { ticket } = await api.get<{ ticket: string }>('/api/v1/ws/ticket');
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?ticket=${ticket}`);
      wsRef.current = ws;

      ws.onopen = () => setStatus('connected');
      ws.onclose = () => {
        setStatus('disconnected');
        if (token) retryRef.current = setTimeout(() => void connect(), 5000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { event: string; notification?: Notification };
          if (msg.event === 'notification' && msg.notification) {
            cbRef.current(msg.notification);
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(msg.notification.title, { body: msg.notification.message });
            }
          }
        } catch { /* ignore */ }
      };
    } catch {
      // Ticket fetch failed — retry after delay
      if (token) retryRef.current = setTimeout(() => void connect(), 5000);
    }
  }, [token]);

  useEffect(() => {
    void connect();
    return () => {
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return status;
}
