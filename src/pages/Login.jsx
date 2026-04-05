import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { signInWithGoogle } from "@/firebase/auth";

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError("");

    try {
      await signInWithGoogle();
      navigate({ to: "/" });
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Sign-in failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#18222f_0%,#0a0f16_45%,#05070b_100%)] text-white px-6 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center">
        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_35px_rgba(16,185,129,0.35)]">
            <span className="text-2xl font-black tracking-tight text-emerald-300">M</span>
          </div>

          <h1 className="text-center text-3xl font-black tracking-tight">MindPulse</h1>
          <p className="mt-2 text-center text-sm text-slate-300">
            Cognitive load intelligence for focused coding sessions.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="mt-8 w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </button>

          {error ? (
            <p className="mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
