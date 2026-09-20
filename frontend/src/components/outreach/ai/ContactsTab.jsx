import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { contactListAPI } from '../../../api/outreach';
import { outreachAiAPI } from '../../../api/outreachAi';
import { Spinner, Pill, Field, PrimaryButton, GhostButton } from './common';
import { inputClass } from './ui';

const SEV = { high: 'bg-danger-500', medium: 'bg-warning-500', low: 'bg-gray-300' };

const Stat = ({ label, value, sub }) => (
    <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3">
        <p className="text-[11px] font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
);

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '0%');

// A single number for "how ready is this list to send": every problem address costs points.
function healthScore(h) {
    if (!h.total) return 0;
    const bad = h.email_invalid + h.email_typos + h.email_duplicates + h.email_role_based + h.email_disposable + h.bounced;
    return Math.max(0, Math.round(100 - (bad / h.total) * 120));
}

export default function ContactsTab({ initialList }) {
    const navigate = useNavigate();
    const [lists, setLists] = useState([]);
    const [listId, setListId] = useState(initialList || '');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null); // { key, label, total, contacts }
    const [busy, setBusy] = useState('');
    const [tagInfo, setTagInfo] = useState(null);

    useEffect(() => {
        contactListAPI.getAll().then((r) => setLists((r.data.data || []).filter((l) => l.import_status === 'done'))).catch(() => {});
    }, []);

    const analyse = (id) => {
        setLoading(true); setPreview(null); setTagInfo(null);
        outreachAiAPI.analyseList(id)
            .then(({ data: d }) => setData(d.data))
            .catch((err) => { setData(null); toast.error(err.response?.data?.message || 'Could not analyse this list'); })
            .finally(() => setLoading(false));
    };

    // Analyse whenever a list is picked (also covers a list passed in the address).
    useEffect(() => {
        if (!listId) return undefined;
        let cancelled = false;
        outreachAiAPI.analyseList(listId)
            .then(({ data: d }) => { if (!cancelled) { setData(d.data); setPreview(null); setTagInfo(null); } })
            .catch((err) => { if (!cancelled) { setData(null); toast.error(err.response?.data?.message || 'Could not analyse this list'); } });
        return () => { cancelled = true; };
    }, [listId]);

    const openPreview = async (seg) => {
        setBusy(`preview:${seg.key}`);
        try {
            const { data: d } = await outreachAiAPI.segmentContacts(listId, seg.key);
            setPreview({ key: seg.key, label: seg.label, total: d.data.total, contacts: d.data.contacts });
        } catch { toast.error('Could not load this segment'); } finally { setBusy(''); }
    };

    const saveSegment = async (seg) => {
        const name = window.prompt('Name for the new list', `${data.list.name} – ${seg.label}`);
        if (!name) return;
        setBusy(`save:${seg.key}`);
        try {
            const { data: d } = await outreachAiAPI.saveSegment(listId, seg.key, { name });
            toast.success(`Saved ${d.data.count} contacts as a new list, best prospects first`);
            navigate(`/outreach/lists/${d.data.list_id}`);
        } catch (err) { toast.error(err.response?.data?.message || 'Could not save the segment'); } finally { setBusy(''); }
    };

    const runCleanup = async (action, count, verb) => {
        if (!window.confirm(`${verb} ${count} contact${count === 1 ? '' : 's'}? This changes the list.`)) return;
        setBusy(`clean:${action}`);
        try {
            await outreachAiAPI.cleanup(listId, [action], true);
            toast.success('Done');
            analyse(listId);
        } catch (err) { toast.error(err.response?.data?.message || 'Could not clean the list'); } finally { setBusy(''); }
    };

    const checkTags = async () => {
        setBusy('tags');
        try { const { data: d } = await outreachAiAPI.applyTags(listId, false); setTagInfo(d.data); }
        catch { toast.error('Could not prepare tags'); } finally { setBusy(''); }
    };
    const applyTags = async () => {
        setBusy('tags');
        try { const { data: d } = await outreachAiAPI.applyTags(listId, true); toast.success(`Tagged ${d.data.contacts_tagged} contacts`); setTagInfo(null); }
        catch { toast.error('Could not add tags'); } finally { setBusy(''); }
    };

    const h = data?.health;
    const score = h ? healthScore(h) : 0;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Which contact list?">
                    <select value={listId} onChange={(e) => { setData(null); setListId(e.target.value); }} className={inputClass}>
                        <option value="">Choose a list…</option>
                        {lists.map((l) => <option key={l.id} value={l.id}>{l.list_name} ({l.imported_contacts} contacts)</option>)}
                    </select>
                </Field>
            </div>

            {!listId && <p className="text-sm text-gray-500">Pick a list and the AI will check its quality, sort it into groups, and rank who to contact first. It takes a second and changes nothing until you say so.</p>}
            {loading && <p className="text-sm text-gray-500 flex items-center gap-2"><Spinner /> Analysing…</p>}

            {data && h && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3">
                            <p className="text-[11px] font-medium text-gray-500">List health</p>
                            <p className="text-xl font-bold text-gray-900 leading-tight">{score}/100</p>
                            <Pill tone={score >= 80 ? 'green' : score >= 55 ? 'amber' : 'red'}>{score >= 80 ? 'Ready to send' : score >= 55 ? 'Clean it first' : 'Needs work'}</Pill>
                        </div>
                        <Stat label="Contacts" value={h.total} sub={`${h.unsubscribed} unsubscribed`} />
                        <Stat label="Valid emails" value={h.email_valid} sub={`${pct(h.email_valid, h.total)} of the list`} />
                        <Stat label="On WhatsApp" value={h.whatsapp_ready} sub={`${pct(h.whatsapp_ready, h.total)} have a mobile`} />
                        <Stat label="Company emails" value={h.email_company_domain} sub={`${h.email_free_domain} personal (Gmail etc.)`} />
                        <Stat label="Already emailed" value={h.previously_contacted} sub={`${h.replied} replied, ${h.bounced} bounced`} />
                        <Stat label="With designation" value={h.has_designation} sub={pct(h.has_designation, h.total)} />
                        <Stat label="Have a phone" value={h.has_phone} sub={pct(h.has_phone, h.total)} />
                    </div>

                    {data.issues.length > 0 ? (
                        <div className="card-p">
                            <h3 className="font-semibold text-gray-800 mb-3">Problems found</h3>
                            <ul className="space-y-2">
                                {data.issues.map((i) => (
                                    <li key={i.message} className="flex gap-2.5 text-sm">
                                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV[i.severity]}`} />
                                        <span><span className="font-medium text-gray-800">{i.count} · {i.message}.</span> <span className="text-gray-500">{i.fix}</span></span>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {data.fixable.email_typos > 0 && <GhostButton disabled={!!busy} onClick={() => runCleanup('fix_email_typos', data.fixable.email_typos, 'Correct the mistyped email domain for')}>Fix {data.fixable.email_typos} email typo{data.fixable.email_typos === 1 ? '' : 's'}</GhostButton>}
                                {data.fixable.duplicates > 0 && <GhostButton disabled={!!busy} onClick={() => runCleanup('remove_duplicates', data.fixable.duplicates, 'Remove the duplicate rows for')}>Remove {data.fixable.duplicates} duplicate{data.fixable.duplicates === 1 ? '' : 's'}</GhostButton>}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">No quality problems found in this list.</div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                            <h3 className="section-title mb-0">Groups the AI found</h3>
                            <div className="flex items-center gap-2 text-xs">
                                {tagInfo ? (
                                    <>
                                        <span className="text-gray-500">Adds {tagInfo.tags_added} tags to {tagInfo.contacts_to_tag} contacts.</span>
                                        <PrimaryButton onClick={applyTags} disabled={busy === 'tags'} className="!py-1.5 !px-3 !text-xs">Add the tags</PrimaryButton>
                                        <button type="button" onClick={() => setTagInfo(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                                    </>
                                ) : (
                                    <GhostButton onClick={checkTags} disabled={!!busy} className="!py-1.5 !px-3 !text-xs">Tag every contact with these groups</GhostButton>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {data.segments.map((seg) => (
                                <div key={seg.key} className="rounded-2xl border border-gray-100 bg-white p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900">{seg.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{seg.description}</p>
                                        </div>
                                        <span className="text-2xl font-bold text-brand-700 leading-none">{seg.count}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <button type="button" onClick={() => openPreview(seg)} disabled={!!busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
                                            {busy === `preview:${seg.key}` ? 'Loading…' : 'See who'}
                                        </button>
                                        {seg.key !== 'needs_cleanup' && (
                                            <>
                                                <button type="button" onClick={() => saveSegment(seg)} disabled={!!busy} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100">
                                                    {busy === `save:${seg.key}` ? 'Saving…' : 'Save as new list'}
                                                </button>
                                                <Link to={`/outreach/ai?tab=planner&list=${listId}&segment=${encodeURIComponent(seg.key)}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-brand-700 hover:bg-brand-50">Plan a send →</Link>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {preview && (
                        <div className="card-p">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-800">{preview.label}: {preview.total} contacts{preview.total > preview.contacts.length ? ` (top ${preview.contacts.length} shown)` : ''}</h3>
                                <button type="button" onClick={() => setPreview(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
                            </div>
                            <ContactRows rows={preview.contacts} />
                        </div>
                    )}

                    {!preview && data.top_prospects.length > 0 && (
                        <div className="card-p">
                            <h3 className="font-semibold text-gray-800">Contact these first</h3>
                            <p className="text-xs text-gray-500 mb-3">Ranked from seniority, HR relevance, email quality and whether they have been contacted recently.</p>
                            <ContactRows rows={data.top_prospects} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ContactRows({ rows }) {
    return (
        <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[520px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-400"><th className="px-1 pb-2 w-14">Score</th><th className="px-1 pb-2">Contact</th><th className="px-1 pb-2">Why</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                    {rows.map((p) => (
                        <tr key={p.id}>
                            <td className="px-1 py-2"><Pill tone={p.score >= 75 ? 'green' : p.score >= 45 ? 'brand' : 'gray'}>{p.score}</Pill></td>
                            <td className="px-1 py-2">
                                <p className="font-medium text-gray-800">{p.name || p.email || 'Unnamed'}</p>
                                <p className="text-xs text-gray-400">{[p.designation, p.company].filter(Boolean).join(' at ') || p.email}</p>
                            </td>
                            <td className="px-1 py-2 text-xs text-gray-500">{(p.reasons || []).slice(0, 3).join(' · ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
