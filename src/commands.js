import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

const daysOption = (option) => option
  .setName('days')
  .setDescription('최근 며칠의 경기까지 볼지 선택합니다.')
  .setRequired(false)
  .setMinValue(1)
  .setMaxValue(30);

const countOption = (option) => option
  .setName('matches')
  .setDescription('최대 조회 경기 수입니다.')
  .setRequired(false)
  .setMinValue(1)
  .setMaxValue(100);

export const commands = [
  new SlashCommandBuilder()
    .setName('arena-add')
    .setDescription('집계할 한국 서버 Riot ID를 등록합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addStringOption((option) => option.setName('game_name').setDescription('Riot ID의 게임 이름').setRequired(true))
    .addStringOption((option) => option.setName('tag_line').setDescription('Riot ID의 태그라인(예: KR1 또는 #KR1)').setRequired(true))
    .addStringOption((option) => option.setName('label').setDescription('표시할 별칭(선택)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('arena-remove')
    .setDescription('집계 중인 Riot ID를 삭제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addStringOption((option) => option.setName('game_name').setDescription('Riot ID의 게임 이름').setRequired(true))
    .addStringOption((option) => option.setName('tag_line').setDescription('Riot ID의 태그라인(예: KR1 또는 #KR1)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('arena-players')
    .setDescription('현재 등록된 집계 계정을 확인합니다.'),
  new SlashCommandBuilder()
    .setName('arena-player')
    .setDescription('특정 Riot ID의 아레나 1등 챔피언을 집계합니다.')
    .addStringOption((option) => option.setName('game_name').setDescription('Riot ID의 게임 이름').setRequired(true))
    .addStringOption((option) => option.setName('tag_line').setDescription('Riot ID의 태그라인(예: KR1 또는 #KR1)').setRequired(true))
    .addIntegerOption(daysOption)
    .addIntegerOption(countOption),
  new SlashCommandBuilder()
    .setName('arena-summary')
    .setDescription('등록된 계정 표본의 아레나 1등 챔피언을 합산합니다.')
    .addIntegerOption(daysOption)
    .addIntegerOption(countOption),
].map((command) => command.toJSON());
