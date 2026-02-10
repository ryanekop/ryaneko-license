'use client';

export default function FastpikPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <span>📸</span> Fastpik
                </h2>
                <p className="text-neutral-500 text-sm mt-2">
                    Fastpik menggunakan sistem membership Mayar
                </p>
            </div>

            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-12 text-center">
                <div className="text-5xl mb-4">🚧</div>
                <h3 className="text-lg font-semibold text-white mb-2">Coming Soon</h3>
                <p className="text-neutral-500 text-sm">
                    Integrasi dengan Mayar Membership API akan segera hadir.
                </p>
                <p className="text-neutral-600 text-xs mt-4">
                    Sementara ini, kelola membership Fastpik di dashboard Mayar.
                </p>
            </div>
        </div>
    );
}
