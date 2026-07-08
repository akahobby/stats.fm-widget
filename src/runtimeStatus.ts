export type RuntimeStatus = {
  botOnline: boolean;
  widgetActive: boolean;
  statsfmConnected: boolean;
  lastWidgetUpdateAt: Date | null;
  lastWidgetUpdateOk: boolean;
  lastStatsfmFetchAt: Date | null;
  lastStatsfmFetchOk: boolean;
};

const status: RuntimeStatus = {
  botOnline: false,
  widgetActive: false,
  statsfmConnected: false,
  lastWidgetUpdateAt: null,
  lastWidgetUpdateOk: false,
  lastStatsfmFetchAt: null,
  lastStatsfmFetchOk: false,
};

export function getRuntimeStatus(): Readonly<RuntimeStatus> {
  return status;
}

export function setBotOnline(online: boolean): void {
  status.botOnline = online;
}

export function recordWidgetUpdate(ok: boolean): void {
  status.lastWidgetUpdateAt = new Date();
  status.lastWidgetUpdateOk = ok;
  if (ok) status.widgetActive = true;
}

export function recordStatsfmFetch(ok: boolean): void {
  status.lastStatsfmFetchAt = new Date();
  status.lastStatsfmFetchOk = ok;
  if (ok) status.statsfmConnected = true;
}

export function formatLastUpdate(date: Date | null): string {
  if (!date) return "never";
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}
