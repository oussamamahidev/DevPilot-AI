const SENSITIVE_KEY_PARTS = ["key", "secret", "token", "password"];

export function isSensitiveConfigKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part));
}

export function maskSensitiveConfig(config: unknown): unknown {
  if (Array.isArray(config)) {
    return config.map((item) => maskSensitiveConfig(item));
  }

  if (config && typeof config === "object") {
    const safeEntries: Array<[string, unknown]> = [];
    let hiddenFieldCount = 0;

    for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
      if (isSensitiveConfigKey(key)) {
        hiddenFieldCount += 1;
        safeEntries.push([`hidden_sensitive_field_${hiddenFieldCount}`, "Hidden"]);
      } else {
        safeEntries.push([key, maskSensitiveConfig(value)]);
      }
    }

    return Object.fromEntries(safeEntries);
  }

  return config;
}

export function displayValue(value: unknown) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  if (typeof value === "string") {
    return value.trim() ? value : "Not available";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

export function getConfigValue(
  config: Record<string, unknown> | null,
  key: string,
) {
  return config ? config[key] : undefined;
}

export function isMissingConfigValue(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  return typeof value === "string" && !value.trim();
}

export function shortenId(value: unknown, visibleCharacters = 8) {
  if (typeof value !== "string" || !value.trim()) {
    return "Not available";
  }

  if (value.length <= visibleCharacters) {
    return value;
  }

  return `${value.slice(0, visibleCharacters)}...`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatNow() {
  return new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export function getProviderBadgeTone(provider: unknown) {
  if (typeof provider !== "string") {
    return "slate";
  }

  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider === "gemini") {
    return "gemini";
  }

  if (normalizedProvider === "ollama") {
    return "ollama";
  }

  if (normalizedProvider === "openai") {
    return "openai";
  }

  return "slate";
}

export function checkLocalStorageAvailable() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const checkKey = "__devpilot_storage_check__";
    window.localStorage.setItem(checkKey, "1");
    window.localStorage.removeItem(checkKey);
    return true;
  } catch {
    return false;
  }
}
