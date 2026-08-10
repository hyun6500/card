/* ================================================================
   카드 캐시백 - 설정
   배포 전 APPS_SCRIPT_URL만 채우면 됩니다.
   [배포, 배포 관리]의 복사 아이콘으로 복사하세요. /exec 로 끝나야 정상.
   ================================================================ */
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwZLoYJAXIs9azntYj2I4T7EoPpWzyK7zlE733_n6g-OdGnBG-NfBY9uvK86ymnjh98/exec",   // 예: "https://script.google.com/macros/s/XXXX/exec"
  APP_VERSION: "v1.10",
  ISSUERS: ["신한", "삼성", "KB국민", "현대", "롯데", "우리", "하나", "BC", "NH농협", "IBK기업"],
  PLATFORMS: ["토스", "네이버페이", "카카오페이", "카드고릴라", "뱅크샐러드", "페이북", "카드사 앱", "기타"],
  BRANDS: ["Visa", "Master", "Amex", "JCB", "UnionPay", "국내전용"],
  // 공고에서 조건을 못 읽었을 때 쓰는 예비값 (개월)
  DEFAULTS: { noUse: 6, benLimit: 12, quitWait: 6, hold: 12 },
  // 카드사 브랜드 컬러 (카드 비주얼 그라디언트)
  ISSUER_COLORS: {
    "신한":   ["#1428A0", "#2B4BD8"],
    "삼성":   ["#1B2B4B", "#3D5A99"],
    "KB국민": ["#5F5142", "#B3A282"],
    "현대":   ["#111111", "#3A3A3A"],
    "롯데":   ["#C21A2C", "#E8556A"],
    "우리":   ["#0067AC", "#33A0DC"],
    "하나":   ["#008485", "#2BB3A3"],
    "BC":     ["#E2231A", "#F26649"],
    "NH농협": ["#0B893B", "#F5A623"],
    "IBK기업":["#0058A3", "#5C9AD3"]
  }
};
