export function hasCallAnalysis(value) {
  if (value == null) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return false;
    try {
      return hasCallAnalysis(JSON.parse(trimmed));
    } catch {
      return true;
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).some(([key, item]) => (
    !['voicemail_detection', 'voicemail_detected'].includes(key)
    && item != null && item !== ''
    && (!Array.isArray(item) || item.length > 0)
  ));
}
