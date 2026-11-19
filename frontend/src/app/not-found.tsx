import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h2 className="text-3xl font-black text-white">404 - Halaman Tidak Ditemukan</h2>
      <p className="mt-2 text-sm text-slate-400">
        Halaman atau rute yang Anda tuju tidak tersedia di W3 Football KANS Manager.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
