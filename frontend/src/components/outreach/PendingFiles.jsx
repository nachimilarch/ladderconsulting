import { useRef } from 'react';
import toast from 'react-hot-toast';

import { MAX_ATTACH_BYTES, ATTACH_EXT as OK_EXT, formatSize } from '../../utils/attachmentRules';

// Files chosen before the campaign/template exists. The parent uploads them after saving.
// `includedBytes` = size of files that will be added anyway (e.g. inherited from a template).
export default function PendingFiles({ files, onChange, includedBytes = 0, disabled = false }) {
    const ref = useRef(null);
    const used = includedBytes + files.reduce((n, f) => n + f.size, 0);

    const add = (e) => {
        let total = used;
        const next = [...files];
        for (const f of Array.from(e.target.files || [])) {
            const ext = f.name.split('.').pop().toLowerCase();
            if (!OK_EXT.includes(ext)) { toast.error(`${f.name}: only PDF, images (JPG, PNG, GIF) or Word files`); continue; }
            if (total + f.size > MAX_ATTACH_BYTES) { toast.error(`${f.name}: attachments are limited to ${formatSize(MAX_ATTACH_BYTES)} in total`); continue; }
            total += f.size;
            next.push(f);
        }
        onChange(next);
        e.target.value = '';
    };

    return (
        <div>
            <div className="flex items-center gap-3">
                <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                    📎 Attach file
                </button>
                <span className="text-xs text-gray-400">PDF, JPG, PNG, GIF or Word · {formatSize(used)} of {formatSize(MAX_ATTACH_BYTES)} used</span>
                <input ref={ref} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx" onChange={add} />
            </div>
            {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                            <span className="truncate">{f.name} <span className="text-xs text-gray-400">{formatSize(f.size)}</span></span>
                            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))}
                                className="text-xs text-red-500 hover:text-red-700 ml-3">Remove</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
