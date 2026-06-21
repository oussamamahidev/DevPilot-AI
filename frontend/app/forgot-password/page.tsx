"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField } from "@/components/auth/AuthField";
import { validateEmail } from "@/components/auth/validators";

const linkClass =
  "inline-flex items-center gap-1 rounded font-medium text-brand-fg transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateEmail(email);
    setTouched(true);
    setError(validationError);
    if (validationError) {
      emailRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      // Always show the same confirmation regardless of outcome — never reveal
      // whether an account exists for the address (no user enumeration).
      await apiPost("/api/v1/auth/forgot-password", { email });
    } catch {
      // Intentionally swallowed.
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={`If an account exists for ${email}, we've sent a link to reset your password.`}
        footer={
          <Link href="/login" className={linkClass}>
            <Icon name="arrowLeft" size={14} />
            Back to sign in
          </Link>
        }
      >
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-success-subtle text-success-fg">
            <Icon name="mail" size={22} />
          </span>
          <p className="text-sm text-fg-muted">
            The link expires in 30 minutes. Didn&apos;t get it? Check your spam folder or{" "}
            <button type="button" onClick={() => setSubmitted(false)} className={linkClass}>
              try another email
            </button>
            .
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email linked to your account and we'll send a reset link."
      footer={
        <Link href="/login" className={linkClass}>
          <Icon name="arrowLeft" size={14} />
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <AuthField
          id="email"
          label="Email"
          type="email"
          leadingIcon="mail"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(value) => {
            setEmail(value);
            if (touched) setError(validateEmail(value));
          }}
          onBlur={() => {
            setTouched(true);
            setError(validateEmail(email));
          }}
          error={touched ? error : null}
          showValid
          inputRef={emailRef}
          disabled={isSubmitting}
        />
        <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
          {isSubmitting ? "Sending link…" : "Send reset link"}
        </Button>
      </form>
    </AuthLayout>
  );
}
