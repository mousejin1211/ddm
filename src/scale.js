// 사전 척도: 단축형 종결 욕구 척도 (NFCS). 과제 안내·연습 시행 전에 한 페이지로 제시된다.
// items가 비어 있으면 이 단계는 건너뛴다.
//
// 항목 설명:
//   title / instruction  화면 제목·응답 안내문
//   points               리커트 점수 개수 (6점 척도 = 6)
//   low / high           labels가 없을 때 1점·마지막 점수의 설명
//   labels               모든 점수의 설명 (points개짜리 배열). 있으면 low/high 대신 사용
//   items                { text, reverse } — reverse: true면 역채점 (점수 = points + 1 − 응답)
//
// 저장되는 값: scale_1 … scale_N (원점수, 역채점 전), scale_total (역채점 반영 합계), scale_n_items
// 역채점 문항: 7, 8, 9, 13, 14
const SCALE = {
  title: "개인 성향에 대한 사전 설문",   // 참가자에게 보이는 제목 (척도 이름은 화면에 노출하지 않음)
  instruction: "자신에게 가장 가까운 응답에 체크해 주세요.",
  points: 6,
  low: "전혀 동의하지 않는다",
  high: "매우 동의한다",
  labels: ["전혀 동의하지 않는다", "동의하지 않는다", "약간 동의하지 않는다", "약간 동의한다", "동의한다", "매우 동의한다"],
  items: [
    { text: "나는 명확하고 구조화된 삶의 방식을 좋아한다.", reverse: false },
    { text: "규칙적으로 잘 계획된 생활이 내 성격에 맞는다.", reverse: false },
    { text: "나는 마지막 순간에 내 계획을 변경시키는 것이 정말 싫다.", reverse: false },
    { text: "나는 예측할 수 없는 상황을 싫어한다.", reverse: false },
    { text: "나는 예측할 수 없는 상황에 빠져들어 가기를 싫어한다.", reverse: false },
    { text: "외식할 때는 전에 가 보아서 대강 어떤 일들이 일어날지 예상할 수 있는 곳에 가는 것이 좋다.", reverse: false },
    { text: "나는 대부분의 의사 결정에서 매우 고심하는 경향이 있다.", reverse: true },
    { text: "어떤 문제를 해결하려 할 때, 나는 종종 너무 많은 대안들이 떠올라서 혼란스럽다.", reverse: true },
    { text: "나는 쇼핑을 할 때, 내가 원하는 것이 정확히 무엇인지를 결정내리기가 어렵다.", reverse: true },
    { text: "나는 불확실한 상황을 좋아하지 않는다.", reverse: false },
    { text: "나는 사람들의 의미나 의도가 나에게 명백하지 않을 때 불편함을 느낀다.", reverse: false },
    { text: "나는 내 인생에서 어떤 일이 왜 일어났는지를 이해할 수 없을 때 불쾌하다.", reverse: false },
    { text: "나는 어떤 문제에 관해 생각할 때 가능한 그 문제와 관련된 다른 많은 의견들도 고려한다.", reverse: true },
    { text: "나는 어떤 일을 결정하고 난 후에도, 늘 다른 대안에 대해 곰곰이 생각한다.", reverse: true },
    { text: "나는 다른 다양한 방식으로 대답할 수 있는 질문들을 싫어한다.", reverse: false },
  ],
};
