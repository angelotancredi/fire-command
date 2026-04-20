import React from "react";
import WeatherWidget from "../WeatherWidget";

export default function StatusBar({
  isLight,
  selectedDistrict,
  isAccidentLocked,
  setIsAccidentLocked,
  accidentPos,
  time,
  onManage,
  setShowResourceSummary,
  setShowGlobalResetInit
}) {
  return (
    <div style={{ 
      height: 60, 
      background: "linear-gradient(90deg, #0e1925, #091420)", 
      borderBottom: "1px solid #1e3a52", 
      display: "flex", 
      alignItems: "center", 
      padding: "0 16px", 
      gap: 16, 
      flexShrink: 0, 
      boxShadow: "0 4px 20px #000000aa", 
      zIndex: 100, 
      userSelect: "none", 
      filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" 
    }}>
      <div 
        onClick={() => setShowGlobalResetInit(true)}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 8px", borderRadius: 8, transition: "background 0.2s", marginLeft: -4, width: 218, flexShrink: 0 }}
        onMouseEnter={e => e.currentTarget.style.background = "#ffffff08"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ fontSize: 32, filter: "drop-shadow(0 0 10px #ff450088)" }}>🔥</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "#ff6030" }}>FIRE COMMAND</div>
          <div style={{ fontSize: 10, color: "#4a7a9b", letterSpacing: 1, fontWeight: 500 }}>TABLET DISPATCHER PRO</div>
        </div>
      </div>
      
      <div style={{ 
        background: "#ff450015", border: "1px solid #ff450040", 
        borderRadius: 8, padding: "6px 14px", 
        display: "flex", alignItems: "center", gap: 8, 
        whiteSpace: "nowrap", flexShrink: 0 
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4500", animation: "pulse 1.5s infinite" }} />
        <span style={{ fontSize: 13, color: "#ff7050", fontWeight: 700 }}>LIVE</span>
        <span style={{ fontSize: 15, color: "#a0c4d8", marginLeft: 2 }}>{selectedDistrict?.name || "알 수 없는 지역"} 화재 출동</span>
        {isAccidentLocked && (
          <button 
            onClick={() => setIsAccidentLocked(false)} 
            style={{ marginLeft: 8, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4, color: "#ff7050", padding: "2px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >위치정정</button>
        )}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
        {/* 현장 투입 자원 현황판을 열 수 있는 미니 통계 버튼 (선택 사항 - 기획 대비 추가 가능) */}
        <button 
          onClick={() => setShowResourceSummary(true)}
          style={{ background: "rgba(0,170,255,0.1)", border: "1px solid #00aaff44", borderRadius: 8, padding: "6px 12px", color: "#00aaff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}
        >
          📊 현황
        </button>

        {accidentPos && <WeatherWidget lat={accidentPos.lat} lng={accidentPos.lng} locationName={selectedDistrict?.name} />}
        
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.7, letterSpacing: 0.5 }}>{time.split(' ')[0]}</span>
          <span style={{ width: 1, height: 14, background: "#ffffff", opacity: 0.2 }}></span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{time.split(' ')[1]}</span>
        </div>
        
        <button 
          onClick={onManage} 
          style={{ 
            background: "linear-gradient(135deg, #1e3a52, #112233)", 
            border: "1px solid #2a6a8a", borderRadius: 8, 
            color: "#7ec8e3", padding: "10px 20px", 
            cursor: "pointer", fontSize: 16, fontWeight: 700, 
            display: "flex", alignItems: "center", gap: 8 
          }}><span>⚙</span> 설정</button>
      </div>
    </div>
  );
}
