import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import { analyticsAPI } from '../../api/outreach';

Chart.register(...registerables);

const TYPE_COLORS = { email:'bg-blue-100 text-blue-700', whatsapp:'bg-green-100 text-green-700', call:'bg-orange-100 text-orange-700' };

export default function OutreachAnalytics() {
    const [campaigns, setCampaigns]   = useState([]);
    const [conversions, setConversions] = useState(null);
    const [summary, setSummary]       = useState(null);
    const [loading, setLoading]       = useState(true);
    const barRef                      = useRef(null);
    const doughnutRef                 = useRef(null);
    let barChart = null, doughnutChart = null;

    useEffect(() => {
        Promise.all([
            analyticsAPI.campaigns(),
            analyticsAPI.conversions(),
        ]).then(([campRes, convRes]) => {
            setCampaigns(campRes.data.data || []);
            setSummary(campRes.data.summary);
            setConversions(convRes.data);
        }).catch(() => toast.error('Failed to load analytics'))
          .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!campaigns.length || !barRef.current) return;

        if (barChart) barChart.destroy();
        const top10 = campaigns.slice(0,10);
        barChart = new Chart(barRef.current, {
            type: 'bar',
            data: {
                labels: top10.map(c => c.campaign_name.slice(0,20)),
                datasets: [
                    { label: 'Sent', data: top10.map(c => c.sent_count), backgroundColor: 'rgba(59,130,246,0.7)' },
                    { label: 'Replies', data: top10.map(c => c.reply_count), backgroundColor: 'rgba(34,197,94,0.7)' },
                    { label: 'Leads', data: top10.map(c => c.leads_generated), backgroundColor: 'rgba(168,85,247,0.7)' },
                ],
            },
            options: { responsive:true, plugins:{ legend:{ position:'top' } }, scales:{ y:{ beginAtZero:true } } },
        });

        return () => { if (barChart) barChart.destroy(); };
    }, [campaigns]);

    useEffect(() => {
        if (!conversions?.grouped || !doughnutRef.current) return;
        const g = conversions.grouped;

        if (doughnutChart) doughnutChart.destroy();
        doughnutChart = new Chart(doughnutRef.current, {
            type: 'doughnut',
            data: {
                labels: ['Email', 'Cold Call', 'WhatsApp'],
                datasets: [{ data: [g.from_email||0, g.from_call||0, g.from_whatsapp||0],
                    backgroundColor: ['rgba(59,130,246,0.7)','rgba(251,146,60,0.7)','rgba(34,197,94,0.7)'] }],
            },
            options: { responsive:true, plugins:{ legend:{ position:'bottom' } } },
        });

        return () => { if (doughnutChart) doughnutChart.destroy(); };
    }, [conversions]);

    if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>;

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Outreach Analytics</h2>
                <p className="text-sm text-gray-500 mt-0.5">Campaign performance and lead conversion stats</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {[
                    { label:'Total Contacts',  value: summary?.total_contacts        },
                    { label:'Campaigns',       value: summary?.total_campaigns       },
                    { label:'Total Replies',   value: summary?.total_replies         },
                    { label:'Leads Generated', value: summary?.total_leads_generated },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <p className="text-2xl font-bold text-gray-800">{s.value ?? '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4 text-sm">Campaign Performance (Top 10)</h3>
                    <canvas ref={barRef} />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4 text-sm">Leads by Source</h3>
                    <canvas ref={doughnutRef} />
                    {conversions?.grouped && (
                        <div className="mt-4 text-xs text-gray-500 text-center">
                            Converted: <span className="font-semibold text-green-700">{conversions.grouped.converted}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Campaign table */}
            {campaigns.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-800 text-sm">All Campaigns</h3>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <tr>
                                <th className="text-left px-4 py-3">Campaign</th>
                                <th className="text-left px-4 py-3">Type</th>
                                <th className="text-right px-4 py-3">Sent</th>
                                <th className="text-right px-4 py-3">Replies</th>
                                <th className="text-right px-4 py-3">Reply Rate</th>
                                <th className="text-right px-4 py-3">Leads</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {campaigns.map(c => (
                                <tr key={c.id}>
                                    <td className="px-4 py-2.5 font-medium text-gray-800">{c.campaign_name}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[c.campaign_type]}`}>{c.campaign_type}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-gray-600">{c.sent_count}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-600">{c.reply_count}</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-green-700">{c.reply_rate}%</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-purple-700">{c.leads_generated}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
