import React from "react";

/**
 * 전술 지휘 화면 하단 유틸리티 메뉴 아이템 정의
 */
export const UTILITY_MENU_ITEMS = [
  { 
    key: "staging", 
    label: "자원집결지", 
    desc: "출동 자원의 효율적 관리", 
    icon: <img src="/icons/fire-point.svg" alt="자원집결지" style={{ width: 28, height: 28 }} />, 
    color: "#8b5cf6", 
    gradient: "linear-gradient(135deg, #4c1d95, #8b5cf6)" 
  },
  { 
    key: "mci", 
    label: "다수사상자 대응 (MCI)", 
    desc: "임시의료소 설치 / 실시간 환자 관리", 
    icon: <img src="/icons/hospital.svg" alt="임시의료소" style={{ width: 28, height: 28 }} />, 
    color: "#f97316", 
    gradient: "linear-gradient(135deg, #9a3412, #f97316)" 
  },
  { 
    key: "calc", 
    label: "방수압력 계산기", 
    desc: "고층화재 층수/호스별 최적 압력", 
    icon: "🧮", 
    color: "#3b82f6", 
    gradient: "linear-gradient(135deg, #1e3a8a, #3b82f6)" 
  },
  { 
    key: "forest_fire", 
    label: "산불진화", 
    desc: "지표화/수관화 분석 및 진화 전술", 
    icon: "🌲", 
    color: "#22c55e", 
    gradient: "linear-gradient(135deg, #166534, #22c55e)" 
  },
];
