import { useCallback, useState } from 'react';
import { operatorFetch } from '../auth/operatorAuthApi';
interface OperatorListenerShareResponse {
  listener_url: string | null;
  session_id: string | null;
}

export function useListenQr() {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    setUrl(null);
    try {
      const shareResponse = await operatorFetch('/api/v1/operator/listener-share');
      if (shareResponse.ok) {
        const share = (await shareResponse.json()) as OperatorListenerShareResponse;
        if (share.listener_url) {
          setUrl(share.listener_url);
          return;
        }
      }
      throw new Error('No configured cloud Listener address is available');
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { url, isLoading, hasError, refresh };
}
