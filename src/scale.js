// 사전 척도 (과제 안내·연습 시행 전에 한 페이지로 제시). items가 비어 있으면 이 단계는 건너뜁니다.
//
// 채우는 법:
//   title        화면 제목
//   instruction  응답 안내문
//   points       리커트 점수 개수 (6점 척도 = 6)
//   low / high   1점·마지막 점수의 설명 (예: "전혀 그렇지 않다" / "매우 그렇다")
//   labels       (선택) 모든 점수의 설명을 직접 지정할 때 points개짜리 배열. 있으면 low/high 대신 사용
//   items        { text: "문항 내용", reverse: true/false } 15개. reverse: true면 역채점 (점수 = points + 1 − 응답)
//
// 저장되는 값: scale_1 … scale_N (원점수, 역채점 전), scale_total (역채점 반영 합계), scale_n_items
const SCALE = {
  title: "",
  instruction: "",
  points: 6,
  low: "",
  high: "",
  labels: null,
  items: [
    // { text: "예) 나는 …", reverse: false },
  ],
};
