# 공마일(0MILE) 작업 규칙

## 이미지 생성 (GPT)
- 기존 test0 세션에서 정한 설정을 따른다: `kwonyujin119/test0`의 `tools/image-prompting/GUIDE.md`, `tools/gpt-image/server.py`.
- 모델: 그 도구의 기본 모델(`gpt-image-2.6-sunburst`).
- 품질: **`quality: low`** (test0 도구 `server.py`의 기본값). medium·high·xhigh·max로 올리려면 먼저 사용자에게 묻는다(비용이 몇 배).
  - 참고: GUIDE.md의 용도별 추천(초안 low, 일반 삽화 medium, 글자 많은 그림 high)은 추천일 뿐 기본값이 아니다.
- 크기: 가로 `1536x1024`, 정사각 `1024x1024` (가이드 크기 표 기준).
- 이미 통과한 이미지는 같은 내용으로 다시 만들지 않는다(비용).
- 그림 안에 글자·숫자·로고·워터마크·사람 얼굴 금지, 인주색(#C43F15) 포인트는 한 곳만. 위반이면 다시 생성(슬롯당 최대 3회).
- 결과물: `assets/img/<slot>.webp` + `data/images.json`의 `slots` 목록.
- OpenAI 키는 "기본 클라우드 환경"의 네트워크 비밀값에만 있다. 키가 없는 환경에서는 그 환경으로 새 세션을 열어 이미지 작업만 맡긴다.
