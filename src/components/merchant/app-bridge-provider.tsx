"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
    };
  }
}

interface AppBridgeContextValue {
  shop: string | null;
  sessionToken: string | null;
  ready: boolean;
}

const AppBridgeContext = createContext<AppBridgeContextValue>({
  shop: null,
  sessionToken: null,
  ready: false,
});

export function useAppBridge(): AppBridgeContextValue {
  return useContext(AppBridgeContext);
}

export function AppBridgeProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const shop = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("shop")
    : null;

  const fetchToken = useCallback(async () => {
    if (!window.shopify) return;
    try {
      const token = await window.shopify.idToken();
      setSessionToken(token);
      setReady(true);
    } catch (err) {
      console.error("[AppBridge] Failed to fetch session token", err);
    }
  }, []);

  useEffect(() => {
    void fetchToken();
  }, [fetchToken]);

  return (
    <AppBridgeContext.Provider value={{ shop, sessionToken, ready }}>
      {children}
    </AppBridgeContext.Provider>
  );
}

