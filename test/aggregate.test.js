import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateFirstPlaceChampions, mergeUniqueMatches } from '../src/aggregate.js';
import { isArenaMatch } from '../src/riot-client.js';
import { playerKey } from '../src/store.js';

function match(id, participants, queueId = 1700) {
  return {
    metadata: { matchId: id },
    info: { queueId, gameMode: 'ARENA', participants },
  };
}

test('1등 챔피언을 경기별로 집계한다', () => {
  const matches = [
    match('KR_1', [
      { championId: 1, championName: 'Annie', placement: 1, puuid: 'p1' },
      { championId: 2, championName: 'Olaf', placement: 2, puuid: 'p2' },
    ]),
    match('KR_2', [
      { championId: 1, championName: 'Annie', placement: 1, puuid: 'p3' },
      { championId: 3, championName: 'Galio', placement: 1, puuid: 'p4' },
    ]),
  ];
  const result = aggregateFirstPlaceChampions(matches, new Map([
    ['1', '애니'],
    ['3', '갈리오'],
  ]));
  assert.deepEqual(result.rankings.map(({ championName, count }) => [championName, count]), [['애니', 2], ['갈리오', 1]]);
  assert.equal(result.firstPlaceMatches, 2);
  assert.equal(result.firstPlaceAppearances, 3);
});

test('특정 PUUID만 필터링할 수 있다', () => {
  const result = aggregateFirstPlaceChampions([
    match('KR_1', [
      { championId: 1, championName: 'Annie', placement: 1, puuid: 'p1' },
      { championId: 2, championName: 'Olaf', placement: 1, puuid: 'p2' },
    ]),
  ], new Map(), { puuid: 'p2' });
  assert.deepEqual(result.rankings.map(({ championName, count }) => [championName, count]), [['Olaf', 1]]);
});

test('여러 계정에서 같은 매치는 한 번만 남긴다', () => {
  const duplicate = match('KR_DUP', [{ championId: 1, championName: 'Annie', placement: 1, puuid: 'p1' }]);
  const unique = match('KR_UNIQUE', [{ championId: 2, championName: 'Olaf', placement: 1, puuid: 'p2' }]);
  assert.deepEqual(mergeUniqueMatches([{ matches: [duplicate] }, { matches: [duplicate, unique] }]).map((item) => item.metadata.matchId), ['KR_DUP', 'KR_UNIQUE']);
});

test('1700과 1710 아레나 큐를 인식한다', () => {
  assert.equal(isArenaMatch({ info: { queueId: 1700, gameMode: 'CLASSIC' } }), true);
  assert.equal(isArenaMatch({ info: { queueId: 1710, gameMode: 'CLASSIC' } }), true);
  assert.equal(isArenaMatch({ info: { queueId: 450, gameMode: 'ARAM' } }), false);
});

test('태그라인 앞의 #을 허용한다', () => {
  assert.equal(playerKey('9B5', 'KR1'), playerKey('9B5', '#KR1'));
});
