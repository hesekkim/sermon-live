import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { ScripturePassage } from '../useListenAudio';

const SCRIPTURE_DISMISS_DELAY_MS = 460;

export function useScripturePopup(
  scriptures: ScripturePassage[],
  onDismiss: () => void,
  onDismissAll: () => void,
) {
  const [scriptureDismissing, setScriptureDismissing] = useState(false);
  const scriptureDismissTimer = useRef<number | null>(null);
  const topScripture = scriptures[0];

  const dismissAllScriptures = () => {
    if (scriptureDismissTimer.current !== null) {
      window.clearTimeout(scriptureDismissTimer.current);
      scriptureDismissTimer.current = null;
    }
    onDismissAll();
    setScriptureDismissing(false);
  };

  const dismissTopScripture = () => {
    scriptureDismissTimer.current = null;
    onDismiss();
    setScriptureDismissing(false);
  };

  const handleDismiss = () => {
    if (!topScripture || scriptureDismissTimer.current !== null) return;
    setScriptureDismissing(true);
    scriptureDismissTimer.current = window.setTimeout(
      dismissTopScripture,
      SCRIPTURE_DISMISS_DELAY_MS,
    );
  };

  useEffect(() => {
    if (topScripture) {
      if (scriptureDismissTimer.current !== null) {
        window.clearTimeout(scriptureDismissTimer.current);
        scriptureDismissTimer.current = null;
      }
      setScriptureDismissing(false);
    }
  }, [topScripture]);

  useEffect(() => {
    return () => {
      if (scriptureDismissTimer.current !== null) {
        window.clearTimeout(scriptureDismissTimer.current);
      }
    };
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDismiss();
    } else if (event.key === 'Escape') {
      dismissAllScriptures();
    }
  };

  return {
    handleDismiss,
    handleKeyDown,
    scriptureDismissing,
  };
}
