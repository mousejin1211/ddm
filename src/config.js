// 실험 설정. URL 파라미터로 대부분 덮어쓸 수 있다.
//   예) index.html?pid=P07
//       index.html?pid=T01&d=0.03,0.05,0.09&nosave=1&debug=1   (파일럿 / 테스트)
const DATAPIPE_EXPERIMENT_ID = "cBoarMMoufM0";   // DataPipe 대시보드의 실험 ID (Google Drive 저장)
const CODE_VERSION = "0.1.0";

const DDM_CONFIG = (() => {
  const P = new URLSearchParams(location.search);
  const num = (k, d) => { const v = P.get(k); const n = v === null || v === "" ? NaN : Number(v); return Number.isFinite(n) ? n : d; };

  let deltas = (P.get("d") || "0.02,0.04,0.08").split(",").map(Number);
  if (deltas.length !== 3 || deltas.some(x => !(x > 0 && x < 0.5))) deltas = [0.02, 0.04, 0.08];

  const kmRaw = P.get("km");
  return {
    pid: (P.get("pid") || "").trim(),
    deltas,                                   // 흰 픽셀 비율 .50 ± Δ (난이도 어려움 → 쉬움)
    nSingle: Math.round(num("ns", 50)),       // 단일반응: 난이도당 시행 수 (3수준 → 총 150)
    nDouble: Math.round(num("nd", 150)),      // 이중반응: 난이도당 시행 수 (3수준 → 총 450)
    nPracSingle: Math.round(num("nps", 12)),  // 연습 시행 수 (총)
    nPracDouble: Math.round(num("npd", 12)),
    breakSingle: Math.round(num("brks", 75)), // 블록 중간 휴식 간격(시행)
    breakDouble: Math.round(num("brkd", 90)),
    km: kmRaw === "0" ? 0 : kmRaw === "1" ? 1 : null,  // R2 키: 0 = F 확인/J 번복, 1 = F 번복/J 확인, 없으면 pid로 역균형
    fixMs: Math.round(num("fix", 500)),
    fbMs: Math.round(num("fb", 500)),
    r1MaxMs: Math.round(num("r1max", 12000)), // 시간 안내용 상한(이 이상이면 시행 무효, 분석 컷오프는 사후에 별도 지정)
    r2MaxMs: Math.round(num("r2max", 8000)),
    cycleN: Math.round(num("cyc", 4)),        // 순환하는 패치 장수
    nosave: P.has("nosave"),                  // 1이면 DataPipe 저장 끔 (테스트용)
    nofs: P.has("nofs"),                      // 전체화면 생략 (테스트용)
    debug: P.has("debug"),
    minW: 800, minH: 500,
  };
})();
