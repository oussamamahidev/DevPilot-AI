"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Button, Card, ErrorState, Input } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { AUTHENTICATED_HOME_PATH } from "@/lib/constants";

export default function RegisterPage() {
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    register,
  } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(AUTHENTICATED_HOME_PATH);
    }
  }, [isAuthenticated, isAuthLoading, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({
        full_name: fullName,
        email,
        password,
      });
      setPassword("");
      router.replace(AUTHENTICATED_HOME_PATH);
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 409) {
          setError("An account with this email already exists.");
        } else {
          setError(requestError.message);
        }
      } else {
        setError("Unable to reach the backend. Check that the API is running.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="mx-auto max-w-xl px-6 py-10">
        <Card className="p-6">
          <p className="text-sm font-medium text-emerald-700">Register</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">
            Create your account
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Register a DevPilot AI user account and continue to the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <Input
              autoComplete="name"
              label="Full name"
              onChange={(event) => setFullName(event.target.value)}
              required
              type="text"
              value={fullName}
            />

            <Input
              autoComplete="email"
              label="Email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />

            <Input
              autoComplete="new-password"
              label="Password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />

            <ErrorState message={error} title="Unable to create account" />

            <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} size="lg">
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-sm text-slate-600">
              Already registered?{" "}
              <Link
                href="/login"
                className="font-medium text-slate-950 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </Card>
      </section>
    </main>
  );
}
