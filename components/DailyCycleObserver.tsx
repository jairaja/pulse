import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../lib/i18n';
import { pulseKeys, useTodayQuestion } from '../lib/pulseQueries';

/** Keep midnight refresh active even when Today has never been opened this session. */
export function DailyCycleObserver() {
  const { language } = useI18n();
  const today = useTodayQuestion(language);
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!today.data) return;
    const elapsed = Math.max(0, Date.now() - today.dataUpdatedAt);
    const serverNow = Date.parse(today.data.serverTime) + elapsed;
    const remaining = Date.parse(today.data.votingClosesAt) - serverNow;
    const timer = setTimeout(() => {
      void client.invalidateQueries({ queryKey: pulseKeys.all });
    }, Math.max(1000, remaining));
    return () => clearTimeout(timer);
  }, [client, today.data, today.dataUpdatedAt]);
  useEffect(() => {
    if (today.data === undefined) return;
    const current = today.data?.id ?? null;
    if (previous.current !== undefined && current !== previous.current) {
      // Also covers delayed rollover after an outage or foreground/reconnect.
      void client.invalidateQueries({ queryKey: pulseKeys.all });
    }
    previous.current = current;
  }, [client, today.data]);
  return null;
}
