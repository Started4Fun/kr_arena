import { getFirstPlaceChampions } from './riot-client.js';

export function aggregateFirstPlaceChampions(matches, championNames = new Map(), { puuid = null } = {}) {
  const counts = new Map();
  const countedMatchIds = new Set();

  for (const match of matches) {
    const winners = getFirstPlaceChampions(match, championNames)
      .filter((winner) => !puuid || winner.puuid === puuid);
    if (winners.length === 0) continue;

    countedMatchIds.add(match.metadata?.matchId || `${match.info?.gameStartTimestamp}-${countedMatchIds.size}`);
    for (const winner of winners) {
      const current = counts.get(winner.championId) || {
        championId: winner.championId,
        championName: winner.championName,
        count: 0,
      };
      current.count += 1;
      counts.set(winner.championId, current);
    }
  }

  return {
    rankings: [...counts.values()].sort((a, b) => b.count - a.count || a.championName.localeCompare(b.championName, 'ko')),
    firstPlaceAppearances: [...counts.values()].reduce((total, item) => total + item.count, 0),
    firstPlaceMatches: countedMatchIds.size,
  };
}

export function mergeUniqueMatches(matchGroups) {
  const unique = new Map();
  for (const group of matchGroups) {
    for (const match of group.matches ?? []) {
      const id = match.metadata?.matchId;
      if (id) unique.set(id, match);
    }
  }
  return [...unique.values()];
}
