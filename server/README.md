# 저장 위치 설정 안내

플랫폼은 데이터를 세 곳 중 하나에 저장합니다. 화면 오른쪽 위 **저장 위치 단추**를 눌러 언제든 바꿀 수 있고, 바꿀 때 기존 데이터를 새 위치로 복사할 수 있습니다.

| 저장 위치 | 특징 | 준비물 |
|---|---|---|
| 이 브라우저 | 설정 없이 바로 사용. 이 PC·이 브라우저에만 저장 | 없음 |
| 클라우드(Supabase) | 어디서든 이어서 작업, 부서원과 공유 | Supabase 무료 계정 |
| 사무실 서버 | 인터넷 없이 내부망에서 공유 | Python 3가 설치된 PC 한 대 |

## 1. 클라우드(Supabase)

1. https://supabase.com 에서 무료 프로젝트를 만듭니다.
2. 왼쪽 메뉴 **SQL Editor** → 새 쿼리에 `server/supabase.sql` 내용을 붙여 넣고 **Run**. (여러 번 실행해도 안전합니다.)
3. **Project Settings → API**(또는 Data API)에서 `Project URL`과 `anon`(publishable) 키를 복사합니다.
4. 플랫폼에서 저장 위치 단추 → **클라우드(Supabase)** → URL, anon 키, **작업공간 코드**(8자 이상, 부서끼리만 공유하는 비밀 코드)를 입력하고 저장합니다.

- 테이블은 직접 읽거나 쓸 수 없게 막혀 있고, 작업공간 코드를 함께 보내는 함수로만 접근합니다.
- 작업공간 코드를 아는 사람은 그 공간의 데이터를 모두 볼 수 있으므로 비밀번호처럼 관리하세요. 민감한 개인정보·비공개 문서는 저장하지 마세요.

## 2. 사무실 서버

```bash
python3 server/local_server.py 8787
# 접속 키를 쓰려면
python3 server/local_server.py 8787 --key 우리부서키
```

- Python 표준 라이브러리만 사용합니다(추가 설치 없음). 데이터는 `server/platform.db`(SQLite)에 저장됩니다.
- 서버를 켠 PC의 IP가 `192.168.0.10` 이라면, 같은 내부망 PC에서 **`http://192.168.0.10:8787/`** 로 플랫폼을 엽니다. 이 주소로 열면 저장 위치 설정에서 서버 주소를 비워 두어도 됩니다.
- GitHub Pages(https) 주소로 연 화면에서는 브라우저 보안 정책 때문에 http 사무실 서버에 접속이 막힐 수 있습니다. 사무실 서버를 쓸 때는 서버 주소로 플랫폼을 여세요.
- Windows 방화벽에서 해당 포트 허용이 필요할 수 있습니다.
- 백업: `server/platform.db` 파일을 복사하거나, 플랫폼 설정의 **백업 내보내기**를 사용하세요.

### API

| 메서드 | 주소 | 설명 |
|---|---|---|
| GET | `/api/health` | `{"ok": true, "app": "platform"}` |
| GET | `/api/items` | 컬렉션 목록 `{"cols": [...]}` |
| GET | `/api/items/<col>` | `[{id, data, updatedAt}]` 최신순 |
| GET | `/api/items/<col>/<id>` | `{id, data, updatedAt}` 또는 404 |
| PUT | `/api/items/<col>/<id>` | 본문 JSON을 저장 |
| DELETE | `/api/items/<col>/<id>` | 삭제 |

`--key` 로 실행하면 모든 `/api/items` 요청에 `X-Platform-Key` 헤더가 필요합니다.
