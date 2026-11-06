export const MAX_ATTACH_BYTES = 2.5 * 1024 * 1024;
export const ATTACH_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx'];
// Email campaigns also take Excel / PowerPoint, and video + audio (sent to the reader as a download link).
export const MAX_LINK_BYTES = 25 * 1024 * 1024;
export const MEDIA_EXT = ['mp4', 'mov', 'webm', 'mp3', 'm4a', 'wav'];
export const CAMPAIGN_EXT = [...ATTACH_EXT, 'xls', 'xlsx', 'ppt', 'pptx', ...MEDIA_EXT];
export const CAMPAIGN_ACCEPT = CAMPAIGN_EXT.map((e) => `.${e}`).join(',');
export const formatSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
