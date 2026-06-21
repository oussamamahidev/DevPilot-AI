export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${formatDecimal(percent, digits)}%`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function formatDateTime(value: string | null | undefined, fallback = "Never") {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${formatDecimal(value / 1024, 1)} KB`;
  }
  return `${formatDecimal(value / (1024 * 1024), 1)} MB`;
}

export function safePreview(text: string | null | undefined, maxLength = 180) {
  if (!text) {
    return "Not recorded";
  }
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, Math.max(0, maxLength - 3))}...`;
}
