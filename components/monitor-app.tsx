"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cpu,
  Droplets,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Settings,
  ShieldCheck,
  Thermometer,
  Waves,
  Wifi,
  ChartNoAxesCombined,
  Circle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useMonitor } from "@/components/monitor-provider";
import { firebaseClient, firebaseConfigured } from "@/lib/firebase";
import {
  deviceId,
  eventLabels,
  summarize,
  type SensorEvent,
} from "@/lib/model";

const navigation = [
  ["overview", "Overview", LayoutDashboard],
  ["analytics", "Sensor analytics", ChartNoAxesCombined],
  ["motion", "Motion activity", Activity],
  ["alerts", "Alert history", Bell],
  ["device", "Device information", Cpu],
  ["settings", "Settings", Settings],
] as const;
function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
function Panel({
  title,
  detail,
  action,
  children,
  className = "",
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {detail && <p>{detail}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({
  text = "Readings will appear when your ESP32 sends data.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Radio size={26} strokeWidth={1.4} />
      <strong>No data yet</strong>
      <p>{text}</p>
    </div>
  );
}
function PeriodFilter() {
  const m = useMonitor();
  return (
    <select
      aria-label="Time period"
      value={m.period}
      onChange={(e) => m.setPeriod(Number(e.target.value))}
    >
      {[
        [15, "Last 15 minutes"],
        [60, "Last hour"],
        [1440, "Last 24 hours"],
        [10080, "Last 7 days"],
      ].map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <div className="login-story">
        <div className="brand">
          <span className="brand-symbol">
            <Waves />
          </span>
          Classroom Monitor
        </div>
        <div>
          <h1>A clearer view of your classroom.</h1>
          <p>
            Temperature, humidity, and movement. Connected to your classroom,
            wherever you are.
          </p>
          <div className="login-flow">
            <Cpu /> ESP32 <ArrowRight /> Firebase <ArrowRight /> Your dashboard
          </div>
        </div>
        <span>Smart Classroom Environment Monitoring System</span>
      </div>
      <div className="login-form">
        <div className="login-inner">
          <ShieldCheck className="login-icon" size={32} />
          <h2>Welcome back</h2>
          <p>Sign in to view your classroom environment.</p>
          {!firebaseConfigured && (
            <div className="notice">
              Connect your Firebase project first. Add the web app values to{" "}
              <code>.env.local</code>, then restart the app.
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const data = new FormData(e.currentTarget);
              try {
                await signInWithEmailAndPassword(
                  firebaseClient().auth,
                  String(data.get("email")),
                  String(data.get("password")),
                );
                router.replace("/");
              } catch {
                setError(
                  "Unable to sign in. Check your email, password, Firebase setup, and internet connection.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@school.edu"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button disabled={busy || !firebaseConfigured} type="submit">
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="fine-print">
            Ask your project administrator for an account.
          </p>
        </div>
      </div>
    </main>
  );
}
function SensorChart({
  metric = "temperature",
}: {
  metric?: "temperature" | "humidity";
}) {
  const m = useMonitor();
  if (!m.history.length) return <Empty />;
  const color = metric === "temperature" ? "#278461" : "#5089a5";
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${metric} history chart; readings also available in the history table`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={m.history.map((r) => ({
            ...r,
            [metric]: r.sensorError ? null : r[metric],
          }))}
          margin={{ top: 14, right: 18, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(t) =>
              new Date(t).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: m.preferences.hour12,
              })
            }
            minTickGap={65}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
          />
          <YAxis
            domain={metric === "temperature" ? ["auto", "auto"] : [0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(v) => m.formatTime(Number(v))}
            contentStyle={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
            formatter={(v) => [
              `${v}${metric === "temperature" ? "°C" : "%"}`,
              metric === "temperature" ? "Temperature" : "Humidity",
            ]}
          />
          {metric === "temperature" && (
            <ReferenceLine
              y={32}
              stroke="#bd8a32"
              strokeDasharray="4 4"
              label={{
                value: "Warning 32°",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#986c24",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey={metric}
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.07}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function EventList({ events }: { events: SensorEvent[] }) {
  const m = useMonitor();
  return events.length ? (
    <div className="event-list">
      {events
        .slice()
        .reverse()
        .map((e) => (
          <div className="event" key={e.id}>
            <span
              className={`event-symbol ${e.type === "danger" ? "danger" : e.type === "warning" ? "warning" : "normal"}`}
            >
              {e.type.startsWith("motion") ? (
                <Activity size={16} />
              ) : e.type === "normal" ? (
                <Check size={16} />
              ) : (
                <Bell size={16} />
              )}
            </span>
            <div>
              <strong>{eventLabels[e.type]}</strong>
              <p>
                {e.temperature !== undefined
                  ? `${e.temperature.toFixed(1)}°C · `
                  : ""}
                {m.formatTime(e.timestamp)}
              </p>
            </div>
            <span className="event-source">ESP32</span>
          </div>
        ))}
    </div>
  ) : (
    <Empty text="No recorded transitions in this period." />
  );
}
function Overview() {
  const m = useMonitor();
  const r = m.latest;
  const available = m.fresh && !r?.sensorError;
  const status = !m.fresh
    ? "Device offline"
    : r?.sensorError
      ? "Sensor error"
      : r?.temperatureStatus || "Unavailable";
  return (
    <>
      <div
        className={`environment-strip ${available ? r?.temperatureStatus : "muted"}`}
      >
        <span className="environment-icon">
          <ShieldCheck size={21} />
        </span>
        <div>
          <strong>
            {status === "normal"
              ? "Your classroom is within the normal temperature range"
              : status === "warning"
                ? "Classroom temperature is elevated"
                : status === "danger"
                  ? "Classroom temperature exceeds 35°C"
                  : status === "Sensor error"
                    ? "The DHT11 could not provide a valid reading"
                    : "Waiting for a fresh device reading"}
          </strong>
          <p>
            {available
              ? "Temperature thresholds follow your ESP32 firmware."
              : "Check device power, Wi-Fi, and Firebase connectivity."}
          </p>
        </div>
        <Badge tone={available ? r?.temperatureStatus : "muted"}>
          {status}
        </Badge>
      </div>
      <div className="metric-grid">
        <section className="metric">
          <div className="metric-label">
            Temperature
            <Thermometer size={19} />
          </div>
          <div className="metric-value">
            {available ? (r?.temperature?.toFixed(1) ?? "—") : "—"}
            <span>°C</span>
          </div>
          <Badge tone={available ? r?.temperatureStatus : "muted"}>
            {status}
          </Badge>
          <p className="reading-updated">
            Updated {m.formatTime(r?.timestamp)}
          </p>
          <div className="threshold-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="threshold-labels">
            <span>Normal ≤32°</span>
            <span>Warning ≤35°</span>
            <span>Danger &gt;35°</span>
          </div>
        </section>
        <section className="metric">
          <div className="metric-label">
            Humidity
            <Droplets size={19} />
          </div>
          <div className="metric-value">
            {available ? (r?.humidity?.toFixed(0) ?? "—") : "—"}
            <span>% RH</span>
          </div>
          <span className="metric-note">Relative humidity</span>
          <p className="reading-updated">
            Updated {m.formatTime(r?.timestamp)}
          </p>
          <div className="metric-bottom">
            <Waves size={16} />
            {m.history.length > 1
              ? `Recent average ${summarize(m.history, "humidity")?.avg.toFixed(1) ?? "—"}%`
              : "Awaiting humidity trend"}
          </div>
        </section>
        <section className="metric">
          <div className="metric-label">
            Motion detection
            <Activity size={19} />
          </div>
          <div className="motion-value">
            {m.fresh
              ? r?.motion
                ? "Motion detected"
                : "No motion"
              : "Unavailable"}
          </div>
          <Badge tone={m.fresh && r?.motion ? "normal" : "muted"}>
            {m.fresh ? "PIR sensor active" : "No fresh signal"}
          </Badge>
          <div className="metric-bottom">
            Last detected <span>{m.formatTime(m.lastMotion)}</span>
          </div>
        </section>
      </div>
      <div className="overview-grid">
        <Panel
          title="Temperature overview"
          detail="A closer look at your classroom environment"
          action={<PeriodFilter />}
        >
          <SensorChart />
          <div className="chart-footer">
            <span>
              <i className="legend-dot" /> Temperature (°C)
            </span>
            <Link href="/analytics">
              View analytics <ArrowRight size={14} />
            </Link>
          </div>
        </Panel>
        <Panel
          title="Device connection"
          action={<Wifi size={18} className="subtle" />}
        >
          <div className="connection-state">
            <span
              className={`connection-symbol ${m.fresh ? "normal" : "muted"}`}
            >
              <Cpu size={25} />
            </span>
            <div>
              <strong>ESP32 DevKit V1</strong>
              <Badge tone={m.fresh ? "normal" : "muted"}>
                {m.fresh ? "Online" : "Offline"}
              </Badge>
            </div>
          </div>
          <dl className="details">
            <div>
              <dt>Device ID</dt>
              <dd className="mono">{deviceId}</dd>
            </div>
            <div>
              <dt>Last received</dt>
              <dd>{m.formatTime(r?.timestamp)}</dd>
            </div>
            <div>
              <dt>Data freshness</dt>
              <dd>
                {r
                  ? `${Math.max(0, Math.floor((m.now - r.timestamp) / 1000))} seconds ago`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{m.connected ? "Connected" : "Disconnected"}</dd>
            </div>
          </dl>
          <Link className="panel-link" href="/device">
            View device information <ArrowRight size={15} />
          </Link>
        </Panel>
        <Panel
          title="Recent activity"
          detail="Sensor and temperature state changes"
          action={
            <Link className="text-link" href="/alerts">
              View history <ArrowRight size={14} />
            </Link>
          }
        >
          <EventList events={m.events.slice(-5)} />
        </Panel>
        <Panel
          title="Hardware indicators"
          detail="Reported by your ESP32 firmware"
        >
          <div className="led-list">
            {[
              [
                "Green LED",
                m.fresh ? (r?.greenLED ? "On" : "Off") : "Unavailable",
                "green",
              ],
              [
                "Red LED",
                m.fresh
                  ? r?.redLEDBlinking
                    ? "Blinking"
                    : r?.redLED
                      ? "On"
                      : "Off"
                  : "Unavailable",
                "red",
              ],
              [
                "Motion LED",
                m.fresh ? (r?.motionLED ? "On" : "Off") : "Unavailable",
                "blue",
              ],
            ].map(([label, state, color]) => (
              <div key={label}>
                <span
                  className={`led ${state === "On" || state === "Blinking" ? color : ""}`}
                />
                <strong>{label}</strong>
                <span>{state}</span>
              </div>
            ))}
          </div>
          <div className="hardware-note">
            <CircleHelp size={16} />
            <p>
              Indicators mirror the device. Warning mode is shown as “Blinking.”
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
function Analytics() {
  const m = useMonitor();
  const [page, setPage] = useState(0);
  const rows = m.history.slice().reverse();
  return (
    <>
      <div className="section-toolbar">
        <p>Statistics from recorded samples in the selected period.</p>
        <PeriodFilter />
      </div>
      <div className="stats-grid">
        {(["temperature", "humidity"] as const).map((key) => {
          const stats = summarize(m.history, key);
          return (
            <section className="panel compact" key={key}>
              <h2>{key === "temperature" ? "Temperature" : "Humidity"}</h2>
              <div className="stat-values">
                {(["avg", "min", "max"] as const).map((k) => (
                  <div key={k}>
                    <span>
                      {k === "avg"
                        ? "Average"
                        : k === "min"
                          ? "Minimum"
                          : "Maximum"}
                    </span>
                    <strong>
                      {stats?.[k].toFixed(1) ?? "—"}
                      <small>{key === "temperature" ? "°C" : "%"}</small>
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <div className="stats-grid">
        <Panel
          title="Temperature"
          detail={`Current: ${m.fresh && !m.latest?.sensorError ? (m.latest?.temperature?.toFixed(1) ?? "—") : "—"}°C`}
        >
          <SensorChart />
        </Panel>
        <Panel
          title="Relative humidity"
          detail="No humidity alert thresholds are configured"
        >
          <SensorChart metric="humidity" />
        </Panel>
      </div>
      <Panel
        title="Reading history"
        detail={`${rows.length} samples loaded · limited to the latest 1,500 per query`}
        action={
          <Button
            variant="outline"
            disabled={!rows.length}
            onClick={() => {
              const csv = [
                "timestamp,temperature,humidity,motion,status",
                ...rows.map(
                  (r) =>
                    `${new Date(r.timestamp).toISOString()},${r.temperature ?? ""},${r.humidity ?? ""},${r.motion},${r.sensorError ? "sensor_error" : r.temperatureStatus}`,
                ),
              ].join("\n");
              const url = URL.createObjectURL(
                new Blob([csv], { type: "text/csv" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "classroom-readings.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <ArrowDownToLine size={15} />
            Export CSV
          </Button>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Motion</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(page * 20, page * 20 + 20).map((r) => (
                <tr key={r.timestamp}>
                  <td>{m.formatTime(r.timestamp)}</td>
                  <td>{r.temperature ?? "—"}°C</td>
                  <td>{r.humidity ?? "—"}%</td>
                  <td>{r.motion ? "Detected" : "No motion"}</td>
                  <td>
                    <Badge tone={r.sensorError ? "muted" : r.temperatureStatus}>
                      {r.sensorError ? "Sensor error" : r.temperatureStatus}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty />}
        <div className="pagination">
          <span>
            Page {page + 1} · bounded samples, not a complete period if the
            limit is reached
          </span>
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={(page + 1) * 20 >= rows.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </Panel>
    </>
  );
}
function Motion() {
  const m = useMonitor();
  const events = m.events.filter((e) => e.type.startsWith("motion"));
  return (
    <>
      <div className="section-toolbar">
        <p>PIR movement events, not attendance or people counts.</p>
        <PeriodFilter />
      </div>
      <div className="stats-grid">
        <Panel title="Current motion state">
          <div className="feature-value">
            <Activity />
            {m.fresh
              ? m.latest?.motion
                ? "Motion detected"
                : "No motion detected"
              : "Unavailable"}
          </div>
          <p className="padded-note">
            Last detected: {m.formatTime(m.lastMotion)}
          </p>
        </Panel>
        <Panel title="Recorded detections">
          <div className="feature-value">
            {events.filter((e) => e.type === "motion_started").length}
            <span>rising-edge events</span>
          </div>
          <p className="padded-note">
            Within loaded events; query limited to 1,000 total events.
          </p>
        </Panel>
      </div>
      <Panel
        title="Motion activity timeline"
        detail="Each entry represents a change in the PIR signal"
      >
        <EventList events={events} />
      </Panel>
    </>
  );
}
function Alerts() {
  const m = useMonitor();
  const [filter, setFilter] = useState("all");
  const events = m.events
    .filter((e) =>
      [
        "normal",
        "warning",
        "danger",
        "sensor_error",
        "sensor_recovered",
      ].includes(e.type),
    )
    .filter(
      (e) =>
        filter === "all" ||
        e.type === (filter === "resolved" ? "normal" : filter),
    );
  return (
    <>
      <div className="section-toolbar">
        <div className="tabs">
          {["all", "warning", "danger", "resolved"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All events" : f}
            </button>
          ))}
        </div>
        <PeriodFilter />
      </div>
      <Panel
        title="Temperature & sensor alerts"
        detail="Only state transitions are recorded. Resolved means temperature returned to normal."
      >
        <EventList events={events} />
      </Panel>
    </>
  );
}
function Device() {
  const m = useMonitor();
  return (
    <>
      <Panel
        title="Smart Classroom Monitor"
        detail={deviceId}
        action={
          <Badge tone={m.fresh ? "normal" : "muted"}>
            {m.fresh ? "Online" : "Offline"}
          </Badge>
        }
      >
        <dl className="device-details">
          {[
            ["Microcontroller", "ESP32 DevKit V1"],
            ["Temperature / humidity", "DHT11 · GPIO 4"],
            ["Motion sensor", "HC-SR501 PIR · GPIO 34"],
            ["Green LED", "GPIO 21"],
            ["Red LED", "GPIO 18"],
            ["Motion LED", "GPIO 2"],
            ["Connectivity", "Wi-Fi / secure HTTPS"],
            ["Database", "Firebase Realtime Database"],
            ["Last received", m.formatTime(m.latest?.timestamp)],
            ["Sampling / upload", "2 seconds / 5 seconds"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel
        title="From your classroom to your screen"
        detail="The device and dashboard can use different internet networks."
      >
        <div className="data-flow">
          {[
            [Cpu, "ESP32"],
            [Wifi, "Wi-Fi"],
            [Radio, "Firebase"],
            [LayoutDashboard, "Website"],
          ].map(([Icon, label], i) => {
            const I = Icon as typeof Cpu;
            return (
              <div key={String(label)}>
                <span>
                  <I size={28} />
                  <strong>{String(label)}</strong>
                </span>
                {i < 3 && <ArrowRight className="flow-arrow" />}
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
function SettingsPage() {
  const m = useMonitor();
  const [saved, setSaved] = useState(false);
  return (
    <Panel
      title="Application preferences"
      detail="Saved in this browser. Sensor thresholds are fixed in the firmware."
    >
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          m.savePreferences({
            name: String(f.get("name")).trim() || "Classroom 01",
            theme: f.get("theme") as "light" | "dark",
            hour12: f.get("time") === "12",
            staleSeconds: Number(f.get("stale")),
            clockSeconds: Number(f.get("clock")),
          });
          setSaved(true);
        }}
      >
        <label>
          Classroom display name
          <input
            name="name"
            defaultValue={m.preferences.name}
            maxLength={50}
            required
          />
        </label>
        <label>
          Appearance
          <select name="theme" defaultValue={m.preferences.theme}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Time format
          <select name="time" defaultValue={m.preferences.hour12 ? "12" : "24"}>
            <option value="24">24-hour · local date and timezone</option>
            <option value="12">12-hour · local date and timezone</option>
          </select>
        </label>
        <label>
          Stale-data timeout (seconds)
          <input
            name="stale"
            type="number"
            min="15"
            max="600"
            defaultValue={m.preferences.staleSeconds}
            required
          />
        </label>
        <label>
          Freshness display refresh
          <select name="clock" defaultValue={m.preferences.clockSeconds}>
            <option value="1">Every second</option>
            <option value="5">Every 5 seconds</option>
            <option value="10">Every 10 seconds</option>
          </select>
          <small>
            Readings always update immediately through Firebase listeners.
          </small>
        </label>
        <div className="readonly-settings">
          <h3>Temperature thresholds</h3>
          <p>Normal ≤32°C · Warning &gt;32°C to 35°C · Danger &gt;35°C</p>
          <small>
            Read-only. Remote hardware configuration is not enabled.
          </small>
        </div>
        <div>
          <Button type="submit">Save preferences</Button>
          {saved && (
            <span className="saved" role="status">
              <Check size={15} />
              Saved to this browser
            </span>
          )}
        </div>
        <div className="readonly-settings">
          <h3>User account</h3>
          <p>{m.user?.email}</p>
          <Button variant="outline" type="button" onClick={() => m.exit()}>
            Sign out
          </Button>
        </div>
      </form>
    </Panel>
  );
}
export function MonitorApp({ page }: { page: string }) {
  const m = useMonitor();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  if (m.authLoading)
    return (
      <div className="loading-screen">
        <Waves />
        <p>Connecting to your classroom…</p>
      </div>
    );
  if (!m.user) return <Login />;
  const active = page === "login" ? "overview" : page;
  const title = navigation.find((n) => n[0] === active)?.[1] || "Overview";
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Waves size={23} />
          </span>
          <span className="brand-text">
            Classroom<span>Environment monitoring</span>
          </span>
        </Link>
        <div className="classroom-switch">
          <span className="classroom-avatar">C1</span>
          <span className="nav-label">
            <strong>{m.preferences.name}</strong>
            <small>Smart Classroom Monitor</small>
          </span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(([id, label, Icon]) => (
            <Link
              title={label}
              aria-current={active === id ? "page" : undefined}
              className={active === id ? "active" : ""}
              href={id === "overview" ? "/" : `/${id}`}
              key={id}
              onClick={() => setMobile(false)}
            >
              <Icon size={18} />
              <span className="nav-label">{label}</span>
              {id === "overview" && <span className="nav-live" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-device">
            <span className={`status-dot ${m.fresh ? "online-dot" : ""}`} />
            <span className="nav-label">
              {m.fresh ? "Device connected" : "Device offline"}
              <small>{deviceId}</small>
            </span>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            <span className="nav-label">Collapse sidebar</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="app-header">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Workspace
            <ChevronRight size={13} />
            <strong>{m.preferences.name}</strong>
          </div>
          <div className="header-right">
            <Badge tone={m.fresh ? "normal" : "muted"}>
              {m.fresh ? "Device online" : "Device offline"}
            </Badge>
            <span className="header-divider" />
            <details className="account-menu">
              <summary aria-label="User account">
                {m.user?.email?.slice(0, 2).toUpperCase()}
              </summary>
              <div>
                <strong>{m.user?.email}</strong>
                <Link href="/settings">Account settings</Link>
                <button onClick={() => m.exit()}>
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <h1>{title === "Overview" ? "Classroom overview" : title}</h1>
              <p>
                {active === "overview"
                  ? "A live view of your classroom’s environment."
                  : active === "analytics"
                    ? "Understand environmental changes over time."
                    : active === "motion"
                      ? "Follow movement signals from your PIR sensor."
                      : active === "alerts"
                        ? "Review changes that need your attention."
                        : active === "device"
                          ? "Your hardware, connection, and data pipeline."
                          : "Make this workspace yours."}
              </p>
            </div>
            <span className="live-label">
              <span className={`status-dot ${m.fresh ? "online-dot" : ""}`} />
              {m.connected ? "Live updates" : "Connection unavailable"}
            </span>
          </div>
          {m.error && (
            <div className="error-message" role="alert">
              Firebase: {m.error}. Check your connection and database
              permissions.
            </div>
          )}
          {!m.connected && (
            <div className="notice">
              Database connection unavailable. Any displayed readings are
              last-known values; device freshness may expire.
            </div>
          )}
          {m.loading ? (
            <div className="loading-screen">Loading sensor readings…</div>
          ) : active === "overview" ? (
            <Overview />
          ) : active === "analytics" ? (
            <Analytics key={m.period} />
          ) : active === "motion" ? (
            <Motion />
          ) : active === "alerts" ? (
            <Alerts />
          ) : active === "device" ? (
            <Device />
          ) : (
            <SettingsPage />
          )}
          <footer className="app-footer">
            <span>
              <Circle size={10} />
              Smart Classroom Environment Monitoring System
            </span>
            <span>ESP32 → Firebase → Your classroom dashboard</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
