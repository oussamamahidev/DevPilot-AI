export function validateEmail(value: string): string | null {
  if (!value.trim()) {
    return "Email is required";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "Enter a valid email address";
  }
  return null;
}

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required`;
}

export function validatePassword(value: string, min = 8): string | null {
  if (!value) {
    return "Password is required";
  }
  if (value.length < min) {
    return `Password must be at least ${min} characters`;
  }
  return null;
}

export type PasswordStrength = {
  score: number; // 0–4
  label: string;
  barClass: string;
  textClass: string;
};

const STRENGTH_LEVELS: Omit<PasswordStrength, "score">[] = [
  { label: "Too weak", barClass: "bg-danger", textClass: "text-danger-fg" },
  { label: "Weak", barClass: "bg-danger", textClass: "text-danger-fg" },
  { label: "Fair", barClass: "bg-warning", textClass: "text-warning-fg" },
  { label: "Good", barClass: "bg-info", textClass: "text-info-fg" },
  { label: "Strong", barClass: "bg-success", textClass: "text-success-fg" },
];

export function passwordStrength(value: string): PasswordStrength {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  const level = STRENGTH_LEVELS[score] ?? STRENGTH_LEVELS[0];
  return { score, ...level };
}
