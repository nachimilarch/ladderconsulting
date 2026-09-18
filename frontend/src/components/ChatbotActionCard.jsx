import { useState } from 'react';
import { chatbotAPI } from '../api/chatbot';
import toast from 'react-hot-toast';

// Renders a chatbot_pending_actions preview with Confirm/Discard — the
// human-in-the-loop gate the chatbot's write tools require before anything
// actually gets created or saved (see chatbotTools.js / chatbotController.js).
export default function ChatbotActionCard({ id, preview, onResolved }) {
    const [busy, setBusy] = useState(false);
    const [resolved, setResolved] = useState(null); // 'confirmed' | 'discarded' | null

    const handleConfirm = async () => {
        setBusy(true);
        try {
            const { data } = await chatbotAPI.confirmAction(id);
            toast.success(data?.message || 'Done.');
            setResolved('confirmed');
            onResolved?.('confirmed');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to apply.');
        } finally {
            setBusy(false);
        }
    };

    const handleDiscard = async () => {
        setBusy(true);
        try {
            await chatbotAPI.discardAction(id);
            setResolved('discarded');
            onResolved?.('discarded');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to discard.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="border border-indigo-200 bg-indigo-50/60 rounded-xl p-3 text-xs">
            <p className="whitespace-pre-line text-gray-700 mb-2">{preview}</p>
            {resolved ? (
                <p className={`font-medium ${resolved === 'confirmed' ? 'text-green-700' : 'text-gray-500'}`}>
                    {resolved === 'confirmed' ? '✓ Confirmed and applied.' : 'Discarded.'}
                </p>
            ) : (
                <div className="flex gap-2">
                    <button
                        onClick={handleConfirm}
                        disabled={busy}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition font-medium"
                    >
                        {busy ? '…' : 'Confirm'}
                    </button>
                    <button
                        onClick={handleDiscard}
                        disabled={busy}
                        className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-60 transition font-medium"
                    >
                        Discard
                    </button>
                </div>
            )}
        </div>
    );
}
