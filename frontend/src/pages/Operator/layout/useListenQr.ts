import { useCallback, useState } from 'react';
import { operatorFetch } from '../auth/operatorAuthApi';
import { buildListenQrUrl } from './listenQrUrl';

interface OperatorNetworkResponse {
  lan_ip: string | null;
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
      const response = await operatorFetch('/api/v1/operator/network');
      if (!response.ok) {
        throw new Error('Could not load the operator network address');
      }
      const network = (await response.json()) as OperatorNetworkResponse;
      const nextUrl = buildListenQrUrl(window.location.origin, network.lan_ip);
      if (!nextUrl) {
        throw new Error('No LAN address is available');
      }
      setUrl(nextUrl);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { url, isLoading, hasError, refresh };
}
