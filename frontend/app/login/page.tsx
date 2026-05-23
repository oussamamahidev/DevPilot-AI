"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Button, Card, ErrorState, Input } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({
        email,
        password,
      });
      router.replace("/dashboard");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          setError("The email or password is incorrect.");
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
          <p className="text-sm font-medium text-emerald-700">Login</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">
            Sign in to DevPilot AI
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Use your account credentials to access the workspace dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <Input
              autoComplete="email"
              label="Email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />

            <Input
              autoComplete="current-password"
              label="Password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />

            <ErrorState message={error} title="Unable to sign in" />

            <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} size="lg">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>

            <p className="text-sm text-slate-600">
              No account yet?{" "}
              <Link
                href="/register"
                className="font-medium text-slate-950 hover:underline"
              >
                Create one
              </Link>
            </p>
          </form>
        </Card>
      </section>
    </main>
  );
}
