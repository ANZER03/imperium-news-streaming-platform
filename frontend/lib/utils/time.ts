export function relativeTime(epochValue: number | null | undefined): string {
  if (!epochValue) return '';

  // Normalize: values > 1e10 are milliseconds, convert to seconds
  const epochSeconds = epochValue > 1e10 ? Math.floor(epochValue / 1000) : epochValue;

  const diff = Math.floor(Date.now() / 1000) - epochSeconds;

  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo`;
  return `${Math.floor(diff / 31536000)}y`;
}
