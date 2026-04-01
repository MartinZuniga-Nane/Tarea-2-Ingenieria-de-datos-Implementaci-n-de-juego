function safeParseLeaderboard(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

export function loadLeaderboard(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    return safeParseLeaderboard(raw);
  } catch (_error) {
    return [];
  }
}

export function saveLeaderboard(storageKey, entries) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entries));
    return true;
  } catch (_error) {
    return false;
  }
}

export function pushLeaderboardEntry(storageKey, entry, maxSize = 10) {
  const entries = loadLeaderboard(storageKey);
  const nextEntries = [...entries, entry]
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      return left.completedAt - right.completedAt;
    })
    .slice(0, maxSize);

  saveLeaderboard(storageKey, nextEntries);
  return nextEntries;
}
