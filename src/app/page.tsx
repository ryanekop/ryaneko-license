import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            🔐 Ryaneko License
          </h1>
          <p className="text-gray-400 mt-4 text-lg">
            License Management System
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            href="/admin"
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            🔧 Admin Dashboard
          </Link>

          <Link
            href="/api/mayar/webhook"
            className="px-8 py-4 bg-gray-800 text-gray-300 font-medium rounded-xl hover:bg-gray-700 transition-all border border-gray-700"
          >
            📡 Webhook Status
          </Link>
        </div>

        <div className="text-gray-500 text-sm">
          <p>Supported Products:</p>
          <p className="text-gray-400">
            RAW File Copy Tool • Realtime Upload Pro • Photo Split Express
          </p>
        </div>
      </div>
    </div>
  );
}
