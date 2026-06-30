export default function MaintenancePage() {
    return (
        <div className="auth-page">
            <div className="max-w-md w-full text-center">
                <div className="flex justify-center mb-6">
                    <img src="/logo-full.png" alt="LadderStep Human Consulting" className="h-20 object-contain" />
                </div>
                <div className="text-6xl mb-6">🔧</div>
                <h1 className="text-2xl font-bold text-gray-800 mb-3">
                    Platform Under Maintenance
                </h1>
                <p className="text-gray-500 mb-6">
                    We're performing scheduled maintenance and will be back shortly.
                    Thank you for your patience.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}
