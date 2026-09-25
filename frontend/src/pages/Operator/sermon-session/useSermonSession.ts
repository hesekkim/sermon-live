import { useEffect, useState } from 'react';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import type { OperatorCopy } from '../translations';

type SermonStatus = 'prepare' | 'ready' | 'ended';
type LifecycleStatus = SermonStatus | 'live';

interface SermonSessionResponse {
  title?: string | null;
  speaker?: string | null;
  bible_reference?: string | null;
  bible_text?: string | null;
  notes?: string | null;
  status?: string | null;
}

interface SessionStatusResponse {
  running?: boolean;
}

interface SermonDetails {
  title: string;
  speaker: string;
  bible_reference: string;
  bible_text: string;
  notes: string;
}

const EMPTY_DETAILS: SermonDetails = {
  title: '',
  speaker: '',
  bible_reference: '',
  bible_text: '',
  notes: '',
};

function normalizeStatus(status: string | null | undefined): SermonStatus {
  return status === 'ready' || status === 'ended' ? status : 'prepare';
}

export function useSermonSession(labels: OperatorCopy) {
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [sermonStatus, setSermonStatus] = useState<SermonStatus>('prepare');
  const [isBroadcastRunning, setIsBroadcastRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { info, error } = useToast();

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response = await fetch('/api/v1/sermon-session');
        if (!response.ok) throw new Error('load failed');
        const data = (await response.json()) as SermonSessionResponse;
        if (!isMounted) return;
        setDetails({
          title: data.title ?? '',
          speaker: data.speaker ?? '',
          bible_reference: data.bible_reference ?? '',
          bible_text: data.bible_text ?? '',
          notes: data.notes ?? '',
        });
        setSermonStatus(normalizeStatus(data.status));
      } catch {
        if (isMounted) error(labels.sermonLoadFailed);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    void fetch('/api/v1/session')
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as SessionStatusResponse;
        if (isMounted) setIsBroadcastRunning(data.running === true);
      })
      .catch(() => undefined);

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws/operator`);
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          running?: boolean;
        };
        if (payload.type === 'status' && typeof payload.running === 'boolean') {
          setIsBroadcastRunning(payload.running);
        }
      } catch {
        return;
      }
    });
    let socketFailureHandled = false;
    const handleSocketFailure = () => {
      if (!isMounted || socketFailureHandled) return;
      socketFailureHandled = true;
      setIsBroadcastRunning(false);
      void fetch('/api/v1/session')
        .then(async (response) => {
          if (!response.ok) return;
          const data = (await response.json()) as SessionStatusResponse;
          if (isMounted) setIsBroadcastRunning(data.running === true);
        })
        .catch(() => undefined);
    };
    socket.addEventListener('error', handleSocketFailure);
    socket.addEventListener('close', handleSocketFailure);

    return () => {
      isMounted = false;
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Page closed');
      }
    };
  }, [error, labels.sermonLoadFailed]);

  const updateDetails = (field: keyof SermonDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/sermon-session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      if (!response.ok) throw new Error('save failed');
      const data = (await response.json()) as SermonSessionResponse;
      setDetails({
        title: data.title ?? '',
        speaker: data.speaker ?? '',
        bible_reference: data.bible_reference ?? '',
        bible_text: data.bible_text ?? '',
        notes: data.notes ?? '',
      });
      setSermonStatus(normalizeStatus(data.status));
      info(labels.sermonSaved);
    } catch {
      error(labels.sermonSaveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    details,
    updateDetails,
    lifecycle: isBroadcastRunning ? 'live' as LifecycleStatus : sermonStatus,
    isLoading,
    isSaving,
    save,
  };
}