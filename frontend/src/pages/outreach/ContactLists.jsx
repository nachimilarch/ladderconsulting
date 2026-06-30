import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { contactListAPI } from '../../api/outreach';

const STATUS_COLORS = {
    pending:    'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    done:       'bg-green-100 text-green-700',
    failed:     'bg-red-100 text-red-700',
};

export default function ContactLists() {
    const [lists, setLists]         = useState([]);
    const [loading, setLoading]     = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [form, setForm]           = useState({ list_name: '', description: '', file: null });
    const fileRef                   = useRef();

    const fetchLists = () => {
        setLoading(true);
        contactListAPI.getAll()
            .then(r => setLists(r.data.data || []))
            .catch(() => toast.error('Failed to load contact lists'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchLists();
    }, []);

    // Poll processing lists every 5 seconds
    useEffect(() => {
        const processing = lists.some(l => l.import_status === 'processing');
        if (!processing) return;
        const t = setTimeout(fetchLists, 5000);
        return () => clearTimeout(t);
    }, [lists]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!form.file)      return toast.error('Select a file');
        if (!form.list_name) return toast.error('Enter a list name');

        const fd = new FormData();
        fd.append('file',        form.file);
        fd.append('list_name',   form.list_name);
        fd.append('description', form.description);

        setUploading(true);
        try {
            const r = await contactListAPI.upload(fd);
            toast.success('Upload started — import running in background');
            setShowUploadForm(false);
            setForm({ list_name: '', description: '', file: null });
            if (fileRef.current) fileRef.current.value = '';
            fetchLists();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete "${name}" and all its contacts?`)) return;
        try {
            await contactListAPI.remove(id);
            toast.success('List deleted');
            fetchLists();
        } catch {
            toast.error('Delete failed');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Contact Lists</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Upload Excel files to import outreach contacts</p>
                </div>
                <button onClick={() => setShowUploadForm(!showUploadForm)}
                    className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-700 transition">
                    + Upload List
                </button>
            </div>

            {showUploadForm && (
                <form onSubmit={handleUpload} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Upload Contact List</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">List Name *</label>
                            <input type="text" value={form.list_name} onChange={e => setForm(f => ({ ...f, list_name: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                placeholder="e.g. IT Managers Q3 2026" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
                            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                placeholder="Optional description" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="text-xs font-medium text-gray-600 block mb-1">Excel / CSV File *</label>
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-green-400 transition"
                            onClick={() => fileRef.current?.click()}>
                            {form.file ? (
                                <p className="text-sm text-green-700 font-medium">{form.file.name}</p>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-400">Drop file here or click to browse</p>
                                    <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv · Max 20MB</p>
                                </>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                            onChange={e => setForm(f => ({ ...f, file: e.target.files[0] }))} />
                        <p className="text-xs text-gray-400 mt-2">
                            Expected columns (any order): Name, Email, Phone, WhatsApp, Company, Designation, City
                        </p>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button type="submit" disabled={uploading}
                            className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition">
                            {uploading ? 'Uploading…' : 'Upload & Import'}
                        </button>
                        <button type="button" onClick={() => setShowUploadForm(false)}
                            className="text-sm text-gray-500 hover:underline px-4">Cancel</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : lists.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <p className="text-gray-400 text-sm">No contact lists yet. Upload your first Excel file to get started.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="divide-y divide-gray-50">
                        {lists.map(list => (
                            <div key={list.id} className="px-6 py-4 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{list.list_name}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[list.import_status] || 'bg-gray-100 text-gray-600'}`}>
                                            {list.import_status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {list.imported_contacts} contacts
                                        {list.failed_rows > 0 && ` · ${list.failed_rows} skipped`}
                                        {list.file_name && ` · ${list.file_name}`}
                                    </p>
                                    {list.import_status === 'processing' && (
                                        <p className="text-xs text-blue-600 mt-0.5 animate-pulse">Import in progress…</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 ml-4 shrink-0">
                                    <Link to={`/outreach/lists/${list.id}`}
                                        className="text-xs text-blue-600 hover:underline">View</Link>
                                    <button onClick={() => handleDelete(list.id, list.list_name)}
                                        className="text-xs text-red-500 hover:underline">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
