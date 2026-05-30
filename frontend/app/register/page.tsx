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
import { validateEmail, validatePassword, validateRequired } from "@/components/auth/validators";
import { useAuth } from "@/hooks/useAuth";
import { AUTHENTICATED_HOME_PATH } from "@/lib/constants";

type Field = "fullName" | "email" | "password";
const linkClass =
  "rounded font-medium text-brand-fg transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string | null>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(AUTHENTICATED_HOME_PATH);
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const values: Record<Field, string> = { fullName, email, password };
  const validateField = (field: Field, value: string) => {
    if (field === "email") return validateEmail(value);
    if (field === "password") return validatePassword(value);
    return validateRequired(value, "Full name");
  };

  const handleChange = (field: Field, value: string) => {
    if (field === "fullName") setFullName(value);
    else if (field === "email") setEmail(value);
    else setPassword(value);
    if (touched[field]) {
      setErrors((current) => ({ ...current, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field: Field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateField(field, values[field]) }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const nextErrors: Record<Field, string | null> = {
      fullName: validateRequired(fullName, "Full name"),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(nextErrors);
    setTouched({ fullName: true, email: true, password: true });
    if (nextErrors.fullName) return nameRef.current?.focus();
    if (nextErrors.email) return emailRef.current?.focus();
    if (nextErrors.password) return passwordRef.current?.focus();

    setIsSubmitting(true);
    try {
      await register({ full_name: fullName, email, password });
      setPassword("");
      router.replace(AUTHENTICATED_HOME_PATH);
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        setFormError(
          requestError.status === 409
            ? "An account with this email already exists."
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
      title="Create your account"
      subtitle="Start asking questions across your documents in minutes."
      footer={
        <p className="text-sm text-fg-muted">
          Already have an account?{" "}
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <AuthError message={formError} />
        <AuthField
          id="fullName"
          label="Full name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={fullName}
          onChange={(value) => handleChange("fullName", value)}
          onBlur={() => handleBlur("fullName")}
          error={touched.fullName ? errors.fullName : null}
          inputRef={nameRef}
          disabled={isSubmitting}
        />
        <AuthField
          id="email"
          label="Work email"
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
          autoComplete="new-password"
          hint="Use at least 8 characters."
          showStrength
          value={password}
          onChange={(value) => handleChange("password", value)}
          onBlur={() => handleBlur("password")}
          error={touched.password ? errors.password : null}
          inputRef={passwordRef}
          disabled={isSubmitting}
        />
        <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-xs text-fg-subtle">
          By creating an account you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  );
}
