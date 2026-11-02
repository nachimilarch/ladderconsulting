export const MAX_ATTACH_BYTES = 2.5 * 1024 * 1024;
export const ATTACH_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx'];
export const formatSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
