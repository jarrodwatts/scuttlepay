"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function useCopy(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), timeout);
      } catch {
        setCopied(false);
      }
    },
    [timeout],
  );

  return { copied, copy };
}
