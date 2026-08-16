import { Client, EmbedBuilder, GatewayIntentBits, PermissionFlagsBits, REST, Routes } from 'discord.js';
import { aggregateFirstPlaceChampions, mergeUniqueMatches } from './aggregate.js';
import { commands } from './commands.js';
import { loadConfig } from './config.js';
import { RiotApiError, RiotClient } from './riot-client.js';
import { StateStore } from './store.js';

const config = loadConfig();
const store = new StateStore(config.dataFile);
const riot = new RiotClient({
  apiKey: config.riotApiKey,
  region: config.riotRegion,
  requestDelayMs: config.requestDelayMs,
});

await store.load();
await registerCommands();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', (readyClient) => {
  console.log(`Discord 로그인 완료: ${readyClient.user.tag}`);
  console.log(`등록된 집계 계정: ${store.listPlayers().length}명`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await routeInteraction(interaction);
  } catch (error) {
    console.error(error);
    const message = error instanceof RiotApiError
      ? error.message
      : '처리 중 오류가 발생했습니다. 콘솔 로그를 확인해 주세요.';
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message });
    else await interaction.reply({ content: message, ephemeral: true });
  }
});

await client.login(config.discordToken);

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);
  await rest.put(route, { body: commands });
  console.log(config.discordGuildId ? '길드 슬래시 명령어 등록 완료' : '전역 슬래시 명령어 등록 완료');
}

async function routeInteraction(interaction) {
  switch (interaction.commandName) {
    case 'arena-add':
      return addPlayer(interaction);
    case 'arena-remove':
      return removePlayer(interaction);
    case 'arena-players':
      return listPlayers(interaction);
    case 'arena-player':
      return summarizePlayer(interaction);
    case 'arena-summary':
      return summarizeAll(interaction);
    default:
      return interaction.reply({ content: '알 수 없는 명령어입니다.', ephemeral: true });
  }
}

async function addPlayer(interaction) {
  ensureManageGuild(interaction);
  const gameName = interaction.options.getString('game_name', true).trim();
  const tagLine = interaction.options.getString('tag_line', true).trim();
  const label = interaction.options.getString('label')?.trim() || null;
  await interaction.deferReply({ ephemeral: true });

  const account = await riot.getAccountByRiotId(gameName, tagLine);
  const result = await store.addPlayer({ gameName, tagLine, label, puuid: account.puuid });
  const action = result.created ? '등록' : '갱신';
  await interaction.editReply(`✅ **${account.gameName}#${account.tagLine}** 계정을 ${action}했습니다.`);
}

async function removePlayer(interaction) {
  ensureManageGuild(interaction);
  const gameName = interaction.options.getString('game_name', true);
  const tagLine = interaction.options.getString('tag_line', true);
  const removed = await store.removePlayer(gameName, tagLine);
  await interaction.reply({
    content: removed ? '✅ 집계 계정을 삭제했습니다.' : '등록된 계정을 찾지 못했습니다.',
    ephemeral: true,
  });
}

async function listPlayers(interaction) {
  const players = store.listPlayers();
  const lines = players.length === 0
    ? ['등록된 계정이 없습니다. 서버 관리자에게 `/arena-add`를 요청하세요.']
    : players.map((player, index) => `${index + 1}. ${player.label ? `${player.label} — ` : ''}${player.gameName}#${player.tagLine}`);
  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}

async function summarizePlayer(interaction) {
  await interaction.deferReply();
  const gameName = interaction.options.getString('game_name', true);
  const tagLine = interaction.options.getString('tag_line', true);
  const days = interaction.options.getInteger('days') || null;
  const count = interaction.options.getInteger('matches') || config.maxMatchesPerPlayer;
  const account = await riot.getAccountByRiotId(gameName, tagLine);
  const result = await collectForPuuid(account.puuid, { days, count });
  const aggregate = aggregateFirstPlaceChampions(result.matches, await riot.getChampionNames(), { puuid: account.puuid });
  await interaction.editReply({ embeds: [rankingEmbed(`${account.gameName}#${account.tagLine}`, aggregate, result, { days, count })] });
}

async function summarizeAll(interaction) {
  await interaction.deferReply();
  const players = store.listPlayers();
  if (players.length === 0) {
    await interaction.editReply('등록된 계정이 없습니다. 먼저 `/arena-add`로 집계 계정을 등록해 주세요.');
    return;
  }

  const days = interaction.options.getInteger('days') || null;
  const count = interaction.options.getInteger('matches') || config.maxMatchesPerPlayer;
  const groups = [];
  for (const player of players) {
    const account = player.puuid
      ? { puuid: player.puuid }
      : await riot.getAccountByRiotId(player.gameName, player.tagLine);
    if (!player.puuid) await store.addPlayer({ ...player, puuid: account.puuid });
    groups.push(await collectForPuuid(account.puuid, { days, count }));
  }

  const matches = mergeUniqueMatches(groups);
  const errors = groups.flatMap((group) => group.errors);
  const aggregate = aggregateFirstPlaceChampions(matches, await riot.getChampionNames());
  await interaction.editReply({ embeds: [rankingEmbed(`한국 서버 아레나 표본 (${players.length}명)`, aggregate, { matches, errors }, { days, count })] });
}

async function collectForPuuid(puuid, { days, count }) {
  const time = days ? {
    startTime: Math.floor((Date.now() - days * 86_400_000) / 1000),
    endTime: Math.floor(Date.now() / 1000),
  } : {};
  return riot.getArenaMatchesForPlayer(puuid, { ...time, count });
}

function rankingEmbed(title, aggregate, result, { days, count }) {
  const ranking = aggregate.rankings.length === 0
    ? '조건에 맞는 아레나 1등 기록이 없습니다.'
    : aggregate.rankings.map((item, index) => `${index + 1}. **${item.championName}** — ${item.count}회`).join('\n');
  const period = days ? `최근 ${days}일` : '최근 경기 기록';
  const errors = result.errors?.length ? `\n일부 경기 조회 실패: ${result.errors.length}건` : '';
  return new EmbedBuilder()
    .setColor(0xC89B3C)
    .setTitle(`🏆 ${title}`)
    .setDescription(ranking)
    .addFields(
      { name: '집계 기준', value: `${period} · 계정당 최대 ${count}경기`, inline: true },
      { name: '아레나 경기', value: `${result.matches?.length ?? 0}경기`, inline: true },
      { name: '1등 챔피언 등장', value: `${aggregate.firstPlaceAppearances}회`, inline: true },
    )
    .setFooter({ text: 'Riot API 공개 경기 기록 표본 기준 · 아레나 queueId 1700/1710 / gameMode ARENA' })
    .setTimestamp();
}

function ensureManageGuild(interaction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('이 명령어는 서버 관리 권한이 필요합니다.');
  }
}
