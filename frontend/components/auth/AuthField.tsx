"use client";

import type { ReactNode, Ref } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

type AuthFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: "text" | "email" | "numeric";
  leadingIcon?: IconName;
  labelAction?: ReactNode;
  trailing?: ReactNode;
  showValid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  hint,
  optional,
  autoComplete,
  placeholder,
  disabled,
  inputMode,
  leadingIcon,
  labelAction,
  trailing,
  showValid,
  inputRef,
}: AuthFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const showCheck = Boolean(showValid && !error && value.length > 0 && !trailing);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
          {optional ? (
            <span className="ml-1.5 text-xs font-normal text-fg-subtle">Optional</span>
          ) : null}
        </label>
        {labelAction}
      </div>

      <div className="relative">
        {leadingIcon ? (
          <Icon
            name={leadingIcon}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          inputMode={inputMode}
          ref={inputRef}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-10 w-full min-w-0 rounded-md border bg-surface text-sm text-fg outline-none transition placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60 ${
            leadingIcon ? "pl-9" : "pl-3"
          } ${trailing || showCheck ? "pr-10" : "pr-3"} ${
            error
              ? "border-danger focus-visible:ring-danger"
              : "border-line focus:border-line-strong focus-visible:ring-focus"
          }`}
        />
        {trailing ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
        ) : showCheck ? (
          <Icon
            name="checkCircle"
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-success-fg"
          />
        ) : null}
      </div>

      <div aria-live="polite" className="mt-1.5 min-h-[1rem]">
        {error ? (
          <p id={errorId} className="flex items-start gap-1 text-xs font-medium text-danger-fg">
            <Icon name="alertCircle" size={13} className="mt-px shrink-0" />
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-fg-subtle">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
