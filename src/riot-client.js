const ACCOUNT_BASE = 'https://{region}.api.riotgames.com/riot/account/v1';
const MATCH_BASE = 'https://{region}.api.riotgames.com/lol/match/v5';
const ARENA_QUEUE_IDS = new Set([1700, 1710]);

export class RiotApiError extends Error {
  constructor(message, { status, retryAfterSeconds } = {}) {
    super(message);
    this.name = 'RiotApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class RiotClient {
  constructor({ apiKey, region = 'asia', requestDelayMs = 100 }) {
    this.apiKey = apiKey;
    this.region = region;
    this.requestDelayMs = requestDelayMs;
    this.lastRequestAt = 0;
    this.championNames = null;
  }

  async getAccountByRiotId(gameName, tagLine) {
    const normalizedTagLine = tagLine.trim().replace(/^#+/, '');
    const path = `/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(normalizedTagLine)}`;
    return this.request(`${ACCOUNT_BASE.replace('{region}', this.region)}${path}`);
  }

  async getMatchIdsByPuuid(puuid, { startTime, endTime, count = 20 } = {}) {
    const params = new URLSearchParams({ start: '0', count: String(count) });
    if (startTime) params.set('startTime', String(startTime));
    if (endTime) params.set('endTime', String(endTime));
    const path = `/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params}`;
    return this.request(`${MATCH_BASE.replace('{region}', this.region)}${path}`);
  }

  async getMatch(matchId) {
    return this.request(`${MATCH_BASE.replace('{region}', this.region)}/matches/${encodeURIComponent(matchId)}`);
  }

  async getChampionNames() {
    if (this.championNames) return this.championNames;

    const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
    const version = versions[0];
    const payload = await fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/champion.json`);
    this.championNames = new Map(
      Object.values(payload.data).map((champion) => [String(champion.key), champion.name]),
    );
    return this.championNames;
  }

  async getArenaMatchesForPlayer(puuid, options = {}) {
    const matchIds = await this.getMatchIdsByPuuid(puuid, options);
    const matches = [];
    const errors = [];
    for (const matchId of matchIds) {
      try {
        const match = await this.getMatch(matchId);
        if (isArenaMatch(match)) matches.push(match);
      } catch (error) {
        errors.push({ matchId, message: error.message });
      }
    }
    return { matches, matchIds, errors };
  }

  async request(url) {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.requestDelayMs) await sleep(this.requestDelayMs - elapsed);
    this.lastRequestAt = Date.now();

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) return response.json();

    const retryAfter = Number(response.headers.get('retry-after')) || undefined;
    let detail = '';
    try {
      const body = await response.json();
      detail = body.status?.message || body.message || '';
    } catch {
      // 오류 응답이 JSON이 아닐 수도 있습니다.
    }

    if (response.status === 429) {
      throw new RiotApiError(
        `Riot API 요청 한도를 초과했습니다.${retryAfter ? ` ${retryAfter}초 후 다시 시도하세요.` : ''}`,
        { status: response.status, retryAfterSeconds: retryAfter },
      );
    }

    const suffix = detail ? ` (${detail})` : '';
    throw new RiotApiError(`Riot API 오류 ${response.status}${suffix}`, { status: response.status });
  }
}

export function isArenaMatch(match) {
  const info = match?.info;
  return ARENA_QUEUE_IDS.has(info?.queueId) || info?.gameMode === 'ARENA';
}

export function getFirstPlaceChampions(match, championNames = new Map()) {
  return (match?.info?.participants ?? [])
    .filter((participant) => participant.placement === 1)
    .map((participant) => ({
      championId: String(participant.championId),
      championName: championNames.get(String(participant.championId)) || participant.championName || `챔피언 ${participant.championId}`,
      puuid: participant.puuid,
      matchId: match.metadata?.matchId,
    }));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Data Dragon 오류 ${response.status}`);
  return response.json();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
