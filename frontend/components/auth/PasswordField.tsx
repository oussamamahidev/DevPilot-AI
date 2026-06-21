"use client";

import { useState, type ReactNode, type Ref } from "react";
import { Icon } from "@/components/ui/Icon";
import { AuthField } from "@/components/auth/AuthField";
import { passwordStrength } from "@/components/auth/validators";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  hint?: string;
  autoComplete?: string;
  disabled?: boolean;
  labelAction?: ReactNode;
  showStrength?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

export function PasswordField({
  value,
  hint,
  showStrength = false,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength && value ? passwordStrength(value) : null;

  return (
    <div>
      <AuthField
        {...props}
        value={value}
        type={visible ? "text" : "password"}
        hint={showStrength && value ? undefined : hint}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            tabIndex={0}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-subtle transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Icon name={visible ? "eyeOff" : "eye"} size={16} />
          </button>
        }
      />
      {strength ? (
        <div className="mt-2">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((segment) => (
              <span
                key={segment}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  segment < strength.score ? strength.barClass : "bg-line"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-fg-subtle">
            Password strength:{" "}
            <span className={`font-medium ${strength.textClass}`}>{strength.label}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
