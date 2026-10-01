import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ScripturePassage } from '../useListenAudio';

export function useScripturePopup(
  scriptures: ScripturePassage[],
  onDismiss: () => void,
  onDismissAll: () => void,
) {
  const [scriptureDimmed, setScriptureDimmed] = useState(false);
  const [scriptureDragX, setScriptureDragX] = useState(0);
  const [scriptureDragging, setScriptureDragging] = useState(false);
  const [scriptureSwipingOut, setScriptureSwipingOut] = useState(false);
  const [showScriptureSwipeHint, setShowScriptureSwipeHint] = useState(false);
  const scripturePointerStart = useRef<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const scriptureSwipeHintShown = useRef(false);
  const scriptureDismissTimer = useRef<number | null>(null);
  const topScripture = scriptures[0];

  const dismissAllScriptures = () => {
    if (scriptureDismissTimer.current !== null) {
      window.clearTimeout(scriptureDismissTimer.current);
      scriptureDismissTimer.current = null;
    }
    onDismissAll();
    setShowScriptureSwipeHint(false);
    setScriptureDimmed(false);
  };

  const dismissTopScripture = () => {
    scriptureDismissTimer.current = null;
    onDismiss();
    setShowScriptureSwipeHint(false);
    setScriptureDimmed(false);
    setScriptureDragX(0);
    setScriptureDragging(false);
    setScriptureSwipingOut(false);
  };

  useEffect(() => {
    if (topScripture) {
      if (scriptureDismissTimer.current !== null) {
        window.clearTimeout(scriptureDismissTimer.current);
        scriptureDismissTimer.current = null;
      }
      setScriptureDimmed(false);
      setScriptureDragX(0);
      setScriptureDragging(false);
      setScriptureSwipingOut(false);
    }
  }, [topScripture]);

  useEffect(() => {
    if (scriptures.length === 0 || scriptureSwipeHintShown.current) return;
    scriptureSwipeHintShown.current = true;
    setShowScriptureSwipeHint(true);
  }, [scriptures.length > 0]);

  useEffect(() => {
    if (!showScriptureSwipeHint) return;
    const timer = window.setTimeout(
      () => setShowScriptureSwipeHint(false),
      4200,
    );
    return () => window.clearTimeout(timer);
  }, [showScriptureSwipeHint]);

  useEffect(() => {
    return () => {
      if (scriptureDismissTimer.current !== null) {
        window.clearTimeout(scriptureDismissTimer.current);
      }
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (scriptureDismissTimer.current !== null) {
      window.clearTimeout(scriptureDismissTimer.current);
      scriptureDismissTimer.current = null;
    }
    setShowScriptureSwipeHint(true);
    scripturePointerStart.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      scripturePointerStart.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    }
    setScriptureDimmed(true);
    setScriptureDragX(0);
    setScriptureDragging(false);
    setScriptureSwipingOut(false);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = scripturePointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX < -8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setScriptureDragging(true);
      setScriptureDragX(deltaX);
      setShowScriptureSwipeHint(false);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = scripturePointerStart.current;
    if (!start || start.id !== event.pointerId) {
      setScriptureDragging(false);
      setScriptureDragX(0);
      return;
    }
    scripturePointerStart.current = null;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    setScriptureDimmed(false);
    setScriptureDragging(false);
    if (deltaX < -8 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX <= -Math.max(72, window.innerWidth * 0.18)) {
        setScriptureSwipingOut(true);
        setScriptureDragX(-window.innerWidth);
        scriptureDismissTimer.current = window.setTimeout(
          dismissTopScripture,
          260,
        );
      } else {
        setScriptureDragX(0);
      }
    } else {
      setScriptureDragging(false);
      setScriptureDragX(0);
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    if (scripturePointerStart.current?.id !== event.pointerId) return;
    scripturePointerStart.current = null;
    setScriptureDimmed(false);
    setScriptureDragging(false);
    setScriptureDragX(0);
    setScriptureSwipingOut(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setShowScriptureSwipeHint(true);
      setScriptureDimmed(true);
    } else if (event.key === 'Escape') {
      dismissAllScriptures();
    }
  };

  return {
    handleKeyDown,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyUp: () => setScriptureDimmed(false),
    scriptureDimmed,
    scriptureDragX,
    scriptureDragging,
    scriptureSwipingOut,
    showScriptureSwipeHint,
  };
}
