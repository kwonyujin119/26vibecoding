fast-formula-parser 1.0.19 (MIT) 배포 빌드(build/parser.min.js)
- 출처: npm 패키지 fast-formula-parser@1.0.19
- 라이선스: LICENSE(MIT), 함께 묶인 라이브러리 고지: THIRD-PARTY-NOTICES.txt

수정한 곳 (1곳)
- 비교 연산(compareOp)에서 빈 셀을 문자열과 비교할 때 엑셀처럼 ""로 취급하도록 바꿈.
  원래: null==t&&(t=0),null==n&&(n=0),
  변경: {const T=t,N=n;null==T&&(t="string"==typeof N?"":0),null==N&&(n="string"==typeof T?"":0)};
  효과: 빈 셀 A1 에 대해 =A1="" 이 TRUE (엑셀과 같음).

빠진 엑셀 함수(MAX, MIN, MATCH, XLOOKUP, COUNTIFS, SUMIFS, CHOOSE, SUBSTITUTE, TEXTJOIN 등)는
apps/sheets.js 의 extraFunctions() 에서 채워 넣는다.
