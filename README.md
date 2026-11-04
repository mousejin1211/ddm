# 이중반응 동적 밝기 변별 과제 (포스터 연구용)

jsPsych 8 기반 온라인 실험. GitHub Pages로 배포하고, 데이터는 DataPipe를 통해 연구자의 Google Drive로 저장됩니다.

## 흐름
동의 → 인적사항(번호·만 나이·성별) → 준비 안내 → 전체화면 → 화면 점검(주사율 측정) → **사전 척도**(`src/scale.js`에 문항이 있을 때만) →
**단일반응** 안내·연습 9·본 108 (난이도당 36) → **이중반응** 안내·연습 9·본 300 (난이도당 100) → 사후 문항 → 저장

- 자극: 64×64 흑백 픽셀, 흰 픽셀 비율 .50 ± Δ (Δ = .02 / .04 / .08, 난이도 3수준 블록 내 섞임). 시행마다 4장을 순환하며 R2(이중) 또는 R1(단일) 응답 전까지 계속 바뀝니다. R1 이후에도 정지하지 않습니다.
- R1: `F` = 어둡다, `J` = 밝다. R2(이중반응): 확인/번복. 키 배정은 `km`(0: F 확인·J 번복 / 1: 반대). **기본은 전원 km=0 고정**이며 R1 키도 고정입니다. 이 경우 `same_key`(같은 키 반복)는 어둡다(F) 응답 뒤의 확인에서만 생기므로 응답 종류와 교란됩니다 (한계로 기술).
- 피드백: 단일 = R1 정오답, 이중 = 최종(R2) 정오답, 500 ms.
- 시간 상한: R1 12 s, R2는 R1 후 8 s (안내용. 분석 컷오프는 사후에 따로 지정).
- 주사율: 화면 점검에서 측정 → 패치 교체 프레임 수 = round(Hz / 67). 60 Hz면 1프레임(≈60 Hz), 120/144 Hz면 2프레임.

## 참가자에게 줄 링크
```
https://mousejin1211.github.io/ddm/?pid=P01
```
`pid`만 참가자마다 바꿉니다 (영문·숫자·`-`·`_`, 최대 20자). 없으면 시작 전에 입력창이 뜹니다.

## URL 파라미터 (파일럿·테스트용)
| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `pid` | – | 참가자 번호 |
| `d` | `0.02,0.04,0.08` | 난이도 Δ (어려움→쉬움). 파일럿에서 정확도 약 .65/.80/.95에 맞게 조정 |
| `km` | 0 (고정) | R2 키 배정 0(F 확인) 또는 1(J 확인) |
| `ns` / `nd` | 36 / 100 | 단일/이중 난이도당 본 시행 수 |
| `nps` / `npd` | 9 / 9 | 연습 시행 수(총) |
| `brks` / `brkd` | 36 / 50 | 휴식 간격(시행). 휴식은 자유롭게 쉬고 "계속하기" 버튼으로 재개, 휴식 시간은 `break` 행의 `rt`(ms) |
| `r1max` / `r2max` | 12000 / 8000 | 시간 상한(ms) |
| `fix` / `fb` | 500 / 500 | 응시점 / 피드백 시간(ms) |
| `nosave` | 꺼짐 | 있으면 DataPipe 저장 **끔** (리허설용, 파일 안 생김) |
| `nofs` | 꺼짐 | 전체화면 생략 (개발용) |
| `debug` | 꺼짐 | 개발용 디버그 객체 노출 |

예) 짧은 리허설: `?pid=T01&nosave=1&ns=3&nd=3&brks=99&brkd=99`

## 실험자용 단축키 (참가자 안내문에는 없음)
- **Esc** = 일시 중지, **Enter** = 재개. 중지 중에는 화면이 가려지고 Enter 외 키 입력이 차단됩니다.
- 시행 중에 중지하면 그 시행은 **처음부터 다시** 진행됩니다. 중지된 횟수·단계는 `n_aborts`, `abort_phases`(예: `r1,r2`)에 기록되므로 분석에서 `n_aborts > 0` 시행은 제외하는 것을 권장합니다.
- 전체화면이 해제되면(전체화면에서 Esc 포함) 자동으로 중지되고, Enter로 재개하면 전체화면으로 돌아갑니다.
- 중지/재개 시각은 `post_survey` 행의 `event_log`에 `pause`(reason: `esc` / `fullscreen_exit`), `resume`으로 남습니다.

## 저장 (DataPipe → Google Drive)
- 실험 ID는 `src/config.js`의 `DATAPIPE_EXPERIMENT_ID`. DataPipe 대시보드에서 **Accept new data**가 켜져 있어야 합니다.
- 파일명: `참가자번호_날짜-시각.csv` (실험 안에서 유일해야 함). 시행마다 임시 저장되고, 중도 이탈 시 `.partial.json`으로 남습니다.
- 저장이 실패하면 참가자 화면에 안내와 CSV 내려받기 버튼이 뜹니다.
- 수집이 끝나면 DataPipe에서 **Accept new data를 꺼** 주세요 (공개 repo라 ID가 코드에 보입니다).
- 데이터 파일은 이 repo에 커밋하지 마세요 (`.gitignore`로 막아 둠).

## 데이터 주요 열 (시행당 1행)
`task_phase`(main_single / main_double / practice_* …), `trial_n`, `level`(1 어려움–3 쉬움), `delta`, `truth`, `p_white`,
`r1_key`·`r1_choice`·`rt1`(ms, 자극 onset 기준)·`r1_correct`, `r2_key`·`r2_action`(confirm/overturn)·`r2_choice`·`rt2_abs`(onset 기준)·`t2`(R1→R2 간격),
`final_correct`, `same_key`(R2 키 = R1 키), `status`(ok / r1_timeout / r2_timeout),
`n_frames`·`frame_mean`·`frame_sd`·`frame_max`·`n_long_frames`(공칭 간격의 1.5배 초과), `n_events`(시행 중 창 이탈 등 이벤트 수).
전체 행에 `pid`, `km`, `km_source`(url / fixed_default), `refresh_hz`, `frames_per_patch`, `deltas`, `test_mode`가 붙습니다.
`display_check` 행: 주사율, 화면·창 크기, devicePixelRatio, 전체화면 여부, user agent.
`scale` 행: `scale_1`…`scale_N`(원점수), `scale_total`(역채점 반영 합계).
`post_survey` 행: `device`, `event_log`(blur/focus/탭 전환/전체화면/크기 변경 타임스탬프 JSON).

## 배포 (GitHub Pages)
repo → Settings → Pages → Source: *Deploy from a branch*, Branch: `main` / `/ (root)` → Save.

## 배경색
- 글자가 있는 화면(동의·안내·설문·휴식·종료)은 `#BCBCBC`, 시행 화면(응시점·패치·피드백)만 `#808080` (`src/style.css`의 `--page-bg`, `--trial-bg`).
- 선행연구(Ratcliff 등 2003, Evans 등 2017)는 "회색 배경"이라고만 쓰고 색 코드는 밝히지 않았습니다. `#808080`은 관례적 중간 회색이고, `#BCBCBC`는 흑백 반반 패치의 평균 광량에 해당하는 sRGB 값(약 188, 감마 가정)입니다.

## 반드시 교체·확인할 것
- `src/consent.js`: **임시 동의서입니다. IRB 승인 문구로 교체**하세요.
- 시행 중 전체화면을 해제해도 자동으로 멈추지 않고 기록만 합니다 (Zoom 화면으로 확인).
- 자극 크기는 CSS 256 px 고정입니다 (물리적 시각도는 모니터마다 다름). 브라우저 확대 100%·DPR은 기록됩니다.

## 라이브러리
`vendor/`에 jsPsych 8.3.0, 플러그인, `@jspsych/extension-pipe` 0.2.0을 포함해 CDN 없이 동작합니다.
