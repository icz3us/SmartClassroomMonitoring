"use client";
/* These effects initialize browser-only preferences and reset external Firebase
   subscriptions. One reset render prevents showing data from a previous query. */
/* eslint-disable react-hooks/set-state-in-effect */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
  startAt,
} from "firebase/database";
import { firebaseClient, firebaseConfigured } from "@/lib/firebase";
import { subscribeLastMotion } from "@/lib/motion.mts";
import {
  deviceId,
  deviceConnectionStatus,
  type Reading,
  type SensorEvent,
} from "@/lib/model";
export interface Preferences {
  name: string;
  theme: "light" | "dark";
  hour12: boolean;
  staleSeconds: number;
  clockSeconds: number;
}
const defaults: Preferences = {
  name: "Classroom 01",
  theme: "light",
  hour12: false,
  staleSeconds: Math.max(
    15,
    Number(process.env.NEXT_PUBLIC_STALE_TIMEOUT_SECONDS) || 30,
  ),
  clockSeconds: 5,
};
function useMonitorState() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(firebaseConfigured);
  const [preferences, setPreferences] = useState(defaults);
  const [latest, setLatest] = useState<Reading | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [events, setEvents] = useState<SensorEvent[]>([]);
  const [period, setPeriod] = useState(60);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [lastMotion, setLastMotion] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("classroom-preferences") || "null",
      );
      if (saved) setPreferences({ ...defaults, ...saved });
    } catch {
      /* Corrupt storage uses defaults. */
    }
    if (!firebaseConfigured) return;
    return onAuthStateChanged(firebaseClient().auth, (u) => {
      setLatest(null);
      setHistory([]);
      setEvents([]);
      setLastMotion(null);
      setConnected(false);
      setError("");
      setUser(u);
      setAuthLoading(false);
    });
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const timer = setInterval(tick, preferences.clockSeconds * 1000);
    return () => clearInterval(timer);
  }, [offset, preferences.clockSeconds]);
  useEffect(() => {
    if (!user) return;
    const { db } = firebaseClient();
    setLoading(true);
    setError("");
    setLatest(null);
    const fail = (e: Error) => {
      setLatest(null);
      setError(e.message);
      setLoading(false);
    };
    const stops = [
      onValue(ref(db, `.info/serverTimeOffset`), (s) =>
        setOffset(s.val() || 0),
      ),
      onValue(ref(db, `.info/connected`), (s) =>
        setConnected(s.val() === true),
      ),
      onValue(
        ref(db, `latestReadings/${deviceId}`),
        (s) => {
          setLatest(s.val());
          setLoading(false);
        },
        fail,
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const { db } = firebaseClient();
    setHistory([]);
    setEvents([]);
    const cutoff = Date.now() + offset - period * 60000;
    const stopHistory = onValue(
      query(
        ref(db, `readings/${deviceId}`),
        orderByChild("timestamp"),
        startAt(cutoff),
        limitToLast(1500),
      ),
      (s) => {
        const rows: Reading[] = [];
        s.forEach((child) => {
          rows.push(child.val());
        });
        setHistory(rows);
      },
      (e) => {
        setHistory([]);
        setError(e.message);
      },
    );
    const stopEvents = onValue(
      query(
        ref(db, `events/${deviceId}`),
        orderByChild("timestamp"),
        startAt(cutoff),
        limitToLast(1000),
      ),
      (s) => {
        const rows: SensorEvent[] = [];
        s.forEach((child) => {
          rows.push({ ...child.val(), id: child.key });
        });
        setEvents(rows);
      },
      (e) => {
        setEvents([]);
        setError(e.message);
      },
    );
    return () => {
      stopHistory();
      stopEvents();
    };
  }, [user, period, offset]);
  useEffect(() => {
    if (!user) return;
    return subscribeLastMotion(
      firebaseClient().db,
      deviceId,
      setLastMotion,
      (e) => {
        setLastMotion(null);
        setError(e.message);
      },
    );
  }, [user]);
  const savePreferences = (value: Preferences) => {
    setPreferences(value);
    localStorage.setItem("classroom-preferences", JSON.stringify(value));
  };
  const exit = async () => {
    setLatest(null);
    setHistory([]);
    setEvents([]);
    setLastMotion(null);
    if (user) await signOut(firebaseClient().auth);
  };
  const connectionStatus = deviceConnectionStatus(
    latest?.timestamp,
    now,
    preferences.staleSeconds,
    connected,
  );
  const fresh = connectionStatus === "online";
  const connectionLabel =
    connectionStatus === "unknown"
      ? "Status unavailable"
      : fresh
        ? "Online"
        : "Offline";
  const formatTime = (timestamp?: number | null) =>
    timestamp
      ? new Date(timestamp).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: preferences.hour12,
        })
      : "Not received yet";
  const cutoff = now - period * 60000;
  return {
    user,
    authLoading,
    preferences,
    savePreferences,
    latest,
    history: history.filter((r) => r.timestamp >= cutoff),
    events: events.filter((e) => e.timestamp >= cutoff),
    period,
    setPeriod,
    error,
    loading,
    connected,
    connectionLabel,
    now,
    fresh,
    lastMotion,
    exit,
    formatTime,
  };
}
const Context = createContext<ReturnType<typeof useMonitorState> | null>(null);
export function MonitorProvider({ children }: { children: ReactNode }) {
  return (
    <Context.Provider value={useMonitorState()}>{children}</Context.Provider>
  );
}
export function useMonitor() {
  const value = useContext(Context);
  if (!value) throw new Error("MonitorProvider is required");
  return value;
}
