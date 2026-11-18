"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/Providers";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await register(email, username, password);
      } else {
        await login(email, password);
      }
      router.push("/squad");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-white">
            {mode === "login" ? "Masuk ke Klubmu" : "Daftar Manager Baru"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Tidak perlu MetaMask untuk mulai! Hubungkan wallet nanti saat ingin transaksi KANS.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-950 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-lg py-2 transition ${
              mode === "login" ? "bg-emerald-500 text-slate-950" : "text-slate-400"
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`rounded-lg py-2 transition ${
              mode === "register" ? "bg-emerald-500 text-slate-950" : "text-slate-400"
            }`}
          >
            Daftar Akun
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Nama Manager / Klub
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Garuda FC"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@gmail.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar & Mulai Gratis"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-800" />
          <span>atau</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <button
          type="button"
          onClick={() =>
            alert(
              "Endpoint Google OAuth (POST /api/auth/google) sudah siap di backend! Untuk mengaktifkan login Gmail sungguhan, isi GOOGLE_CLIENT_ID di .env backend dan NEXT_PUBLIC_GOOGLE_CLIENT_ID di frontend."
            )
          }
          className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
        >
          Lanjutkan dengan Akun Google (Gmail)
        </button>
      </div>
    </div>
  );
}
