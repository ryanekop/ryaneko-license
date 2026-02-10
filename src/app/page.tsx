import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <div className="text-center space-y-10 px-6">
        <div>
          <div className="text-6xl mb-4">🔑</div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Ryaneko License
          </h1>
          <p className="text-neutral-500 mt-3 text-base">
            License Management System
          </p>
        </div>

        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link
            href="/admin"
            className="px-6 py-3.5 bg-white text-neutral-900 font-medium rounded-xl hover:bg-neutral-200 transition-colors"
          >
            ⚙️ Admin Dashboard
          </Link>

          <Link
            href="/api/mayar/webhook"
            className="px-6 py-3.5 bg-neutral-900 text-neutral-400 font-medium rounded-xl hover:bg-neutral-800 transition-colors border border-neutral-800"
          >
            📡 Webhook Status
          </Link>
        </div>

        <div className="text-neutral-600 text-sm space-y-1">
          <p>Supported Products</p>
          <p className="text-neutral-500">
            📂 RAW File Copy Tool · 📤 Realtime Upload Pro · ✂️ Photo Split Express
          </p>
        </div>
      </div>
    </div>
  );
}
