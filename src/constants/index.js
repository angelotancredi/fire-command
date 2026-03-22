export const VEHICLE_ICONS = {
  pump: "🚒", ladder: "/icons/ladder.svg", rescue: "/icons/rescue.svg", chemical: "☢️",
  ambulance: "/icons/ambulance.svg", tanker: "/icons/water.svg", command: "📡", investigation: "🔍", smoke: "🔦", forest: "🌲", bus: "🚌"
};

export const VEHICLE_LABELS = {
  pump: "펌프차", ladder: "사다리차", rescue: "구조차", chemical: "화학차",
  ambulance: "구급차", tanker: "물탱크차", command: "지휘차", investigation: "조사차", smoke: "조연차", forest: "산불진화차", bus: "버스"
};

export const RANKS = ["소방사", "소방교", "소방장", "소방위", "소방경", "소방령", "소방정"];
export const ROLES = ["팀장", "경방", "기관", "구급", "구조대"];

export const DISTRICTS = [
  { name: "삼정동", center: { lat: 35.2312, lng: 128.8924 }, jurisdictional: "삼정119안전센터", zoneCode: "4825034000" },
  { name: "어방동", center: { lat: 35.2442, lng: 128.9056 }, jurisdictional: "삼정119안전센터", zoneCode: "4825034000" },
  { name: "삼방동", center: { lat: 35.2415, lng: 128.9142 }, jurisdictional: "삼정119안전센터", zoneCode: "4825034000" },
  { name: "안동", center: { lat: 35.2355, lng: 128.9188 }, jurisdictional: "삼정119안전센터", zoneCode: "4825034000" },
  { name: "지내동", center: { lat: 35.2288, lng: 128.9255 }, jurisdictional: "삼정119안전센터", zoneCode: "4825034000" },
  { name: "불암동", center: { lat: 35.2244, lng: 128.9288 }, jurisdictional: "삼정119안전센터", zoneCode: "4825040000" },
  { name: "부원동", center: { lat: 35.2288, lng: 128.8855 }, jurisdictional: "동상119안전센터", zoneCode: "4825031000" },
  { name: "봉황동", center: { lat: 35.2305, lng: 128.8788 }, jurisdictional: "동상119안전센터", zoneCode: "4825033000" },
  { name: "서상동", center: { lat: 35.2333, lng: 128.8805 }, jurisdictional: "동상119안전센터", zoneCode: "4825032000" },
  { name: "동상동", center: { lat: 35.2366, lng: 128.8844 }, jurisdictional: "동상119안전센터", zoneCode: "4825032000" },
  { name: "대성동", center: { lat: 35.2411, lng: 128.8788 }, jurisdictional: "북부119안전센터", zoneCode: "4825037000" },
  { name: "내외동", center: { lat: 35.2345, lng: 128.8654 }, jurisdictional: "내외119안전센터", zoneCode: "4825036000" },
  { name: "칠산서부동", center: { lat: 35.2155, lng: 128.8588 }, jurisdictional: "내외119안전센터", zoneCode: "4825035000" },
  { name: "구산동", center: { lat: 35.2512, lng: 128.8744 }, jurisdictional: "북부119안전센터", zoneCode: "4825037000" },
  { name: "삼계동", center: { lat: 35.2712, lng: 128.8712 }, jurisdictional: "북부119안전센터", zoneCode: "4825037000" },
  {
    name: "상동면", center: { lat: 35.3120, lng: 128.9379 }, jurisdictional: "상동119안전센터", zoneCode: "4825042000",
    subDistricts: [
      { name: "매리", lat: 35.2975, lng: 128.9812 },
      { name: "대감리", lat: 35.3120, lng: 128.9379 },
      { name: "감노리", lat: 35.3055, lng: 128.9288 },
      { name: "여차리", lat: 35.3312, lng: 128.9644 },
      { name: "우계리", lat: 35.3211, lng: 128.9805 },
      { name: "묵방리", lat: 35.3422, lng: 128.9988 }
    ]
  },
  {
    name: "생림면", center: { lat: 35.3412, lng: 128.8543 }, jurisdictional: "생림119안전센터", zoneCode: "4825043000",
    subDistricts: [
      { name: "나전리", lat: 35.3344, lng: 128.8677 },
      { name: "도요리", lat: 35.3512, lng: 128.8812 },
      { name: "마사리", lat: 35.3612, lng: 128.8412 },
      { name: "봉림리", lat: 35.3455, lng: 128.8343 },
      { name: "사촌리", lat: 35.3312, lng: 128.8443 },
      { name: "생림리", lat: 35.3412, lng: 128.8543 },
      { name: "생철리", lat: 35.3488, lng: 128.8512 },
      { name: "안양리", lat: 35.3588, lng: 128.8612 }
    ]
  },
  {
    name: "대동면", center: { lat: 35.2444, lng: 128.9602 }, jurisdictional: "대동119안전센터", zoneCode: "4825044000",
    subDistricts: [
      { name: "괴정리", lat: 35.2555, lng: 128.9588 },
      { name: "대감리", lat: 35.2676, lng: 128.9806 },
      { name: "덕산리", lat: 35.2755, lng: 128.9688 },
      { name: "수안리", lat: 35.2455, lng: 128.9788 },
      { name: "예안리", lat: 35.2855, lng: 128.9488 },
      { name: "월촌리", lat: 35.2655, lng: 128.9655 },
      { name: "조눌리", lat: 35.2788, lng: 128.9611 },
      { name: "주동리", lat: 35.2855, lng: 128.9788 },
      { name: "주중리", lat: 35.2822, lng: 128.9722 },
      { name: "초정리", lat: 35.2444, lng: 128.9602 }
    ]
  },
];

export const HOSPITALS = [
  { name: "김해복음병원", lat: 35.2443, lng: 128.8785 },
  { name: "강일병원", lat: 35.2285, lng: 128.8546 },
  { name: "조은금강병원", lat: 35.2536, lng: 128.8722 },
  { name: "김해삼승병원", lat: 35.2721, lng: 128.8715 },
  { name: "갑을장유병원", lat: 35.1843, lng: 128.8145 },
  { name: "창원경상대병원", lat: 35.2152, lng: 128.6945 },
  { name: "양산부산대병원", lat: 35.3285, lng: 129.0062 },
];

export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const SEVERITIES = [
  { key: "red", label: "긴급", color: "#ff4d4d" },
  { key: "yellow", label: "응급", color: "#ffcc00" },
  { key: "green", label: "비응급", color: "#4ade80" },
  { key: "black", label: "지연", color: "#666" }
];
export const TRANSPORT_STATUSES = ["환자 이송 중", "병원 도착", "복귀 중"];
