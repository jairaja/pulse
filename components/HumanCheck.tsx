import { useRef, useState, useEffect, useCallback } from 'react';
import { TurnstileChallenge } from './TurnstileChallenge';

export function useHumanCheck() {
  const [binding, setBinding] = useState<string | null>(null);
  const pending = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);
  const finish = useCallback((token?: string) => {
    const current = pending.current; pending.current = null; setBinding(null);
    if (token) current?.resolve(token); else current?.reject(new Error('Verification cancelled.'));
  }, []);
  useEffect(() => () => { pending.current?.reject(new Error('Verification cancelled.')); pending.current = null; }, []);
  const verify = (value: string) => {
    pending.current?.reject(new Error('Verification replaced.'));
    setBinding(value);
    return new Promise<string>((resolve, reject) => { pending.current = { resolve, reject }; });
  };
  return { verify, element: binding ? <TurnstileChallenge key={binding} binding={binding} onCancel={() => finish()} onToken={finish} /> : null };
}
