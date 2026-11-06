import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { recruitmentAPI } from '../../api/recruitment';

const fmtSize = (n) => (n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '');

// Review resume uploads that did not turn into a profile: see why, open the
// original file, then delete one, the selected ones, or all of them.
export default function FailedUploadsPanel({ onChanged }) {
    const [items, setItems]     = useState([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(new Set());
    const [busy, setBusy]       = useState(false);

    const load = useCallback(async () => {
        try {
            const r = await recruitmentAPI.listFailedUploads();
            setItems(r.data.data || []);
            setTotal(r.data.total || 0);
            setSelected(new Set());
        } catch {
            toast.error('Could not load failed uploads.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let alive = true;
        recruitmentAPI.listFailedUploads()
            .then((r) => { if (!alive) return; setItems(r.data.data || []); setTotal(r.data.total || 0); })
            .catch(() => toast.error('Could not load failed uploads.'))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    const openFile = async (it) => {
        try {
            const res = await recruitmentAPI.downloadUploadItem(it.id);
            const url = URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' }));
            window.open(url, '_blank');
        } catch {
            // blob error bodies are not JSON-parsed by axios
            toast.error('The original file is no longer available.');
        }
    };

    const removeOne = async (it) => {
        if (!window.confirm(`Delete the failed upload "${it.file_name}"?`)) return;
        setBusy(true);
        try { await recruitmentAPI.deleteUploadItem(it.id); toast.success('Deleted'); await load(); onChanged?.(); }
        catch (err) { toast.error(err.response?.data?.message || 'Could not delete.'); }
        finally { setBusy(false); }
    };

    const removeMany = async (ids, label) => {
        if (!window.confirm(`Delete ${label}? The uploaded files will be removed too. This cannot be undone.`)) return;
        setBusy(true);
        try {
            const r = await recruitmentAPI.deleteUploadItems(ids);
            toast.success(r.data.message);
            await load(); onChanged?.();
        } catch (err) { toast.error(err.response?.data?.message || 'Could not delete.'); }
        finally { setBusy(false); }
    };

    const toggle = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const allSel = items.length > 0 && items.every((i) => selected.has(i.id));

    if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-sm text-gray-500">
                    Resumes that could not be turned into a profile. Check the reason, open the original file if you want to look at it,
                    then delete the ones you do not need. (Anything fixed can simply be uploaded again.)
                </p>
                {total > 0 && (
                    <div className="flex gap-2">
                        {selected.size > 0 && (
                            <button disabled={busy} onClick={() => removeMany([...selected], `${selected.size} selected upload${selected.size === 1 ? '' : 's'}`)}
                                className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                                Delete selected ({selected.size})
                            </button>
                        )}
                        <button disabled={busy} onClick={() => removeMany(null, `all ${total} failed upload${total === 1 ? '' : 's'}`)}
                            className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                            Delete all failed ({total})
                        </button>
                    </div>
                )}
            </div>

            {items.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-sm text-gray-400">
                    No failed uploads. 🎉
                </div>
            ) : (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th className="w-8"><input type="checkbox" checked={allSel} onChange={() => setSelected(allSel ? new Set() : new Set(items.map((i) => i.id)))} aria-label="Select all" /></th>
                                <th>File</th><th>Why it failed</th><th>Uploaded for</th><th>When</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it) => (
                                <tr key={it.id}>
                                    <td><input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} aria-label="Select" /></td>
                                    <td className="max-w-[220px]">
                                        <p className="truncate font-medium text-gray-800" title={it.file_name}>{it.file_name}</p>
                                        <p className="text-xs text-gray-400">{fmtSize(it.file_size)}{it.extracted_email ? ` · ${it.extracted_email}` : ''}</p>
                                    </td>
                                    <td className="max-w-[320px]">
                                        <span className={it.is_stuck ? 'badge-yellow' : 'badge-red'}>{it.is_stuck ? 'stuck' : 'failed'}</span>
                                        <p className="text-xs text-gray-600 mt-1">{it.error_message}</p>
                                    </td>
                                    <td className="text-xs text-gray-600">
                                        {it.job_title ? <>{it.job_title}<br /><span className="text-gray-400">{it.company_name}</span></> : 'Free pool'}
                                        <br /><span className="text-gray-400">by {it.uploaded_by_name}</span>
                                    </td>
                                    <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(it.created_at).toLocaleString()}</td>
                                    <td className="whitespace-nowrap space-x-3 text-right">
                                        {it.file_available && <button onClick={() => openFile(it)} className="text-xs text-indigo-600 hover:underline">View file</button>}
                                        <button disabled={busy} onClick={() => removeOne(it)} className="text-xs text-red-500 hover:underline disabled:opacity-50">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {total > items.length && <p className="text-xs text-gray-400 px-4 py-2">Showing the latest {items.length} of {total}.</p>}
                </div>
            )}
        </div>
    );
}
