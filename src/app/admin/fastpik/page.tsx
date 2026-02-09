'use client';

export default function FastpikPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white">Fastpik</h2>
                <p className="text-gray-400 text-sm">
                    Fastpik menggunakan sistem membership Mayar. Data ditarik dari Mayar API.
                </p>
            </div>

            {/* Coming Soon */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-12 text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h3 className="text-xl font-semibold text-white mb-2">Coming Soon</h3>
                <p className="text-gray-400">
                    Integrasi dengan Mayar Membership API akan segera hadir.
                </p>
                <p className="text-gray-500 text-sm mt-4">
                    Sementara ini, kelola membership Fastpik di dashboard Mayar.
                </p>
            </div>
        </div>
    );
}
