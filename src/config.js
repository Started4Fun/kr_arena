import 'dotenv/config';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
  return value;
}

function integer(name, fallback, { min, max }) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name}은(는) ${min}~${max} 사이의 정수여야 합니다.`);
  }
  return value;
}

export function loadConfig() {
  return {
    discordToken: required('DISCORD_TOKEN'),
    discordClientId: required('DISCORD_CLIENT_ID'),
    discordGuildId: process.env.DISCORD_GUILD_ID?.trim() || null,
    riotApiKey: required('RIOT_API_KEY'),
    riotRegion: process.env.RIOT_REGION?.trim() || 'asia',
    requestDelayMs: integer('RIOT_REQUEST_DELAY_MS', 100, { min: 0, max: 10_000 }),
    maxMatchesPerPlayer: integer('MAX_MATCHES_PER_PLAYER', 20, { min: 1, max: 100 }),
    dataFile: process.env.DATA_FILE?.trim() || './data/state.json',
  };
}
