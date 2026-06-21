"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordField } from "@/components/auth/PasswordField";
import { AuthError } from "@/components/auth/AuthError";
import { validateEmail, validatePassword } from "@/components/auth/validators";
import { useAuth } from "@/hooks/useAuth";

type Field = "email" | "password";
const linkClass =
  "rounded font-medium text-brand-fg transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const validateField = (field: Field, value: string) =>
    field === "email" ? validateEmail(value) : validatePassword(value);

  const handleChange = (field: Field, value: string) => {
    if (field === "email") setEmail(value);
    else setPassword(value);
    if (touched[field]) {
      setErrors((current) => ({ ...current, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field: Field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({
      ...current,
      [field]: validateField(field, field === "email" ? email : password),
    }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const nextErrors = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(nextErrors);
    setTouched({ email: true, password: true });
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.replace("/dashboard");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        setFormError(
          requestError.status === 401
            ? "The email or password is incorrect."
            : requestError.message,
        );
      } else {
        setFormError("Unable to reach the backend. Check that the API is running.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in to DevPilot AI"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <p className="text-sm text-fg-muted">
          New to DevPilot AI?{" "}
          <Link href="/register" className={linkClass}>
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <AuthError message={formError} />
        <AuthField
          id="email"
          label="Email"
          type="email"
          leadingIcon="mail"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(value) => handleChange("email", value)}
          onBlur={() => handleBlur("email")}
          error={touched.email ? errors.email : null}
          showValid
          inputRef={emailRef}
          disabled={isSubmitting}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(value) => handleChange("password", value)}
          onBlur={() => handleBlur("password")}
          error={touched.password ? errors.password : null}
          inputRef={passwordRef}
          disabled={isSubmitting}
          labelAction={
            <Link href="/forgot-password" className={`text-xs ${linkClass}`}>
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
