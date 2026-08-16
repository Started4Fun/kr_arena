# 한국 서버 아레나 1등 챔피언 Discord 봇

Riot API의 한국 서버 공개 경기 기록을 조회해, 등록한 계정 표본에서 아레나 `placement === 1`인 챔피언을 집계하는 Discord 봇입니다.

## 왜 “한국 서버 전체 통계”가 아닌가요?

Riot의 공개 Match-v5 API는 전체 서버의 아레나 경기 ID를 전역으로 나열하는 API가 없습니다. 경기 ID는 PUUID별 매치 목록으로 조회하므로, 이 봇은 서버 관리자가 등록한 계정들을 표본으로 사용합니다. `/arena-summary`는 같은 경기를 중복 제거해 합산합니다.

## 준비

1. Riot Developer Portal에서 Development API Key를 발급합니다.
2. Discord Developer Portal에서 봇 애플리케이션을 만들고 `applications.commands`와 `bot` 권한으로 서버에 초대합니다.
3. Node.js 20 이상을 설치합니다.
4. `.env.example`을 `.env`로 복사하고 값을 입력합니다.

```powershell
Copy-Item .env.example .env
npm install
npm test
npm start
```

`DISCORD_GUILD_ID`를 입력하면 명령어가 특정 서버에 즉시 등록됩니다. 비워두면 전역 명령어 등록이므로 Discord에 반영되기까지 시간이 걸릴 수 있습니다.

## 명령어

- `/arena-add game_name:... tag_line:...`: 집계 표본에 계정을 추가합니다. 서버 관리 권한이 필요합니다.
- `/arena-remove game_name:... tag_line:...`: 계정을 삭제합니다. 서버 관리 권한이 필요합니다.
- `/arena-players`: 등록 계정을 본인에게만 표시합니다.
- `/arena-player game_name:... tag_line:...`: 한 계정의 1등 챔피언을 집계합니다.
- `/arena-summary`: 등록 계정 전체의 표본을 합산합니다.

예를 들어 `9B5#KR1`은 `/arena-player game_name:9B5 tag_line:#KR1`처럼 조회할 수 있습니다. 태그라인의 `#`은 생략해도 됩니다.

`days`와 `matches` 옵션을 생략하면 최근 기록에서 계정당 최대 `MAX_MATCHES_PER_PLAYER`경기를 조회합니다. 아레나는 Riot의 큐 목록에 있는 `1700`과 `1710`을 모두 인식합니다. API 키의 요청 한도에 걸리면 `RIOT_REQUEST_DELAY_MS`를 늘리거나 한 번에 조회할 경기 수를 줄이세요.

## 정책 및 표시 범위

Riot Developer API 정책을 확인하고, API 키를 공개 저장소에 올리지 마세요. 이 봇은 챔피언과 1등 횟수만 표시하며, 아레나 아이템 승률이나 플레이어에게 실시간으로 유리한 정보를 제공하는 기능은 포함하지 않습니다.
