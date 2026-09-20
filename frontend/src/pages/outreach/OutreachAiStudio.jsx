import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { outreachAiAPI } from '../../api/outreachAi';
import EmailDraftPanel from '../../components/outreach/ai/EmailDraftPanel';
import { SubjectLinesPanel, ImproveCopyPanel, FollowUpPanel, WhatsAppTemplatePanel, CallScriptPanel } from '../../components/outreach/ai/WriteTools';
import ContactsTab from '../../components/outreach/ai/ContactsTab';
import PlannerTab from '../../components/outreach/ai/PlannerTab';
import RepliesTab from '../../components/outreach/ai/RepliesTab';
import InsightsTab from '../../components/outreach/ai/InsightsTab';

const TABS = [
    { id: 'write',    icon: '✍️', label: 'Write',     hint: 'Campaign emails, subject lines, follow-ups' },
    { id: 'whatsapp', icon: '💬', label: 'WhatsApp',  hint: 'Draft message templates' },
    { id: 'contacts', icon: '👥', label: 'Contacts',  hint: 'Check, sort and rank a list' },
    { id: 'planner',  icon: '🗓', label: 'Planner',   hint: 'Plan and schedule sends' },
    { id: 'replies',  icon: '📥', label: 'Replies',   hint: 'Sort replies, draft answers' },
    { id: 'insights', icon: '📈', label: 'Insights',  hint: 'What your numbers mean' },
    { id: 'calls',    icon: '📞', label: 'Calls',     hint: 'Cold-call scripts' },
];

const WRITE_TOOLS = [
    { id: 'email',    label: 'Campaign email' },
    { id: 'subject',  label: 'Subject lines' },
    { id: 'improve',  label: 'Improve my copy' },
    { id: 'followup', label: 'Follow-ups' },
];

export default function OutreachAiStudio() {
    const [sp, setSp] = useSearchParams();
    const tab = TABS.some((t) => t.id === sp.get('tab')) ? sp.get('tab') : 'write';
    const [tool, setTool] = useState('email');
    const [status, setStatus] = useState(null);

    useEffect(() => { outreachAiAPI.status().then(({ data }) => setStatus(data.data)).catch(() => {}); }, []);

    const go = (id) => setSp({ tab: id }, { replace: true });
    const current = TABS.find((t) => t.id === tab);

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">✨ AI Studio</h2>
                <p className="text-sm text-gray-500 mt-0.5">Write campaigns, sort your contacts, plan when to send and answer replies faster. The AI suggests; you decide, and nothing is sent without you.</p>
            </div>

            {status && !status.ai_enabled && (
                <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">AI writing help is switched off by an admin. Contact analysis, copy checks and the send planner still work.</div>
            )}

            <div className="flex gap-1 overflow-x-auto pb-1 mb-5 -mx-1 px-1" role="tablist">
                {TABS.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}
                        className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition ${tab === t.id ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-200 hover:text-brand-700'}`}>
                        <span aria-hidden="true">{t.icon}</span>{t.label}
                    </button>
                ))}
            </div>
            <p className="text-xs text-gray-400 -mt-3 mb-4">{current.hint}</p>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                {tab === 'write' && (
                    <>
                        <div className="flex gap-1.5 flex-wrap mb-5">
                            {WRITE_TOOLS.map((t) => (
                                <button key={t.id} type="button" onClick={() => setTool(t.id)}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${tool === t.id ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t.label}</button>
                            ))}
                        </div>
                        {tool === 'email' && <EmailDraftPanel />}
                        {tool === 'subject' && <SubjectLinesPanel />}
                        {tool === 'improve' && <ImproveCopyPanel />}
                        {tool === 'followup' && <FollowUpPanel />}
                    </>
                )}
                {tab === 'whatsapp' && <WhatsAppTemplatePanel />}
                {tab === 'contacts' && <ContactsTab initialList={sp.get('list') || ''} />}
                {tab === 'planner' && <PlannerTab initial={{ list: sp.get('list') || '', segment: sp.get('segment') || '', channel: sp.get('channel') || 'email' }} />}
                {tab === 'replies' && <RepliesTab />}
                {tab === 'insights' && <InsightsTab />}
                {tab === 'calls' && <CallScriptPanel />}
            </div>
        </div>
    );
}
