export function escText(value) {
  return String(value || '');
}

export function timeAgo(date) {
  if (!date) {
    return 'JUST NOW';
  }

  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) {
    return 'JUST NOW';
  }

  if (mins < 60) {
    return `${mins}M AGO`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}H AGO`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}D AGO`;
  }

  return new Date(date).toLocaleDateString();
}

export function formatFullDate(date) {
  if (!date) {
    return 'Not available';
  }

  return new Date(date).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function buildBodyPreview(body, maxLength = 220) {
  const normalised = String(body || '').replace(/\s+/g, ' ').trim();

  if (!normalised) {
    return '';
  }

  return normalised.length > maxLength
    ? `${normalised.slice(0, maxLength)}...`
    : normalised;
}

export function normaliseTags(tags) {
  const incoming = Array.isArray(tags)
    ? tags
    : String(tags || '')
        .split(',')
        .map((tag) => tag.trim());

  return [
    ...new Set(
      incoming
        .map((tag) => String(tag || '').trim().replace(/^#/, ''))
        .filter(Boolean)
    ),
  ];
}
