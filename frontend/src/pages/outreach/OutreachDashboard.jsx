import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI } from '../../api/outreach';

const Stat = ({ label, value, color }) => {
    const colors = {
        blue:   'bg-blue-50 border-blue-100 text-blue-700',
        green:  'bg-green-50 border-green-100 text-green-700',
        yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
        purple: 'bg-purple-50 border-purple-100 text-purple-700',
        red:    'bg-red-50 border-red-100 text-red-700',
    };
    return (
        <div className={`rounded-2xl border p-5 ${colors[color]}`}>
            <div className="text-2xl font-bold">{value ?? '—'}</div>
            <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
        </div>
    );
};

export default function OutreachDashboard() {
    const [summary, setSummary] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        analyticsAPI.campaigns()
            .then(r => {
                setSummary(r.data.summary);
                setCampaigns(r.data.data || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const statusColor = (s) => ({
        draft: 'bg-gray-100 text-gray-600',
        sending: 'bg-blue-100 text-blue-700',
        sent: 'bg-green-100 text-green-700',
        paused: 'bg-yellow-100 text-yellow-700',
        failed: 'bg-red-100 text-red-700',
        scheduled: 'bg-purple-100 text-purple-700',
    }[s] || 'bg-gray-100 text-gray-600');

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Outreach Dashboard</h2>
                <p className="text-sm text-gray-500 mt-0.5">Campaign overview and lead generation stats</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <Stat label="Total Contacts"       value={summary?.total_contacts}        color="blue" />
                        <Stat label="Campaigns Sent"       value={summary?.total_campaigns}       color="green" />
                        <Stat label="Total Replies"        value={summary?.total_replies}         color="yellow" />
                        <Stat label="Leads Generated"      value={summary?.total_leads_generated} color="purple" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                        {[
                            { label: 'Contact Lists',   to: '/outreach/lists',     icon: '📋' },
                            { label: 'Email Campaigns', to: '/outreach/email',     icon: '✉️' },
                            { label: 'WhatsApp',        to: '/outreach/whatsapp',  icon: '💬' },
                            { label: 'Replies Inbox',   to: '/outreach/replies',   icon: '📥' },
                            { label: 'Cold Calls',      to: '/outreach/calls',     icon: '📞' },
                            { label: 'Analytics',       to: '/outreach/analytics', icon: '📈' },
                            { label: 'WA Templates',    to: '/outreach/whatsapp/templates', icon: '📝' },
                        ].map(({ label, to, icon }) => (
                            <Link key={to} to={to}
                                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-green-300 hover:shadow-md transition flex flex-col items-center gap-2 text-center">
                                <span className="text-2xl">{icon}</span>
                                <span className="text-xs font-medium text-gray-700">{label}</span>
                            </Link>
                        ))}
                    </div>

                    {campaigns.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-800">Recent Campaigns</h3>
                                <Link to="/outreach/email" className="text-xs text-green-600 hover:underline">View all</Link>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {campaigns.slice(0, 8).map(c => (
                                    <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{c.campaign_name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{c.campaign_type} · {c.list_name}</p>
                                        </div>
                                        <div className="flex items-center gap-4 ml-4">
                                            <span className="text-xs text-gray-500">{c.sent_count} sent · {c.reply_count} replies</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(c.status)}`}>{c.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {campaigns.length === 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                            <p className="text-gray-400 text-sm">No campaigns yet. Upload a contact list and create your first campaign.</p>
                            <Link to="/outreach/lists" className="mt-4 inline-block text-sm font-medium text-green-600 hover:underline">
                                Upload Contact List →
                            </Link>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
