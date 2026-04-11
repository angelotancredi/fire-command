import React, { useMemo, useState, useEffect } from 'react';
import { VEHICLE_ICONS, VEHICLE_LABELS } from '../../constants';

export default function ResourceSummaryPopup({ 
  isOpen, onClose, 
  deployed, vehicles, personnel, centers, selectedDistrict 
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('ko-KR', { 
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });

  // 통계 계산
  const stats = useMemo(() => {
    if (!isOpen) return null;
    const deployedUnits = Object.values(deployed);
    const deployedVehicles = deployedUnits.filter(d => d.itemType === "vehicle");
    
    // 센터별 데이터 집계
    const centerMap = {};
    centers.forEach(c => {
      centerMap[c.id] = { 
        ...c, 
        vList: [], 
        pCount: 0,
        isJurisdiction: selectedDistrict?.jurisdictional === c.name
      };
    });

    // 차량 매핑 및 인원 합산
    deployedVehicles.forEach(dv => {
      const vInfo = vehicles.find(v => v.id === dv.id);
      if (vInfo && centerMap[vInfo.center_id]) {
        centerMap[vInfo.center_id].vList.push(vInfo);
        // 해당 차량의 대원 수 합산
        const pInVehicle = personnel.filter(p => p.vehicle_id === vInfo.id).length;
        centerMap[vInfo.center_id].pCount += pInVehicle;
      }
    });

    // 개별적으로 투입된 대원(도보 등) 합산
    deployedUnits.filter(d => d.itemType === "personnel").forEach(dp => {
      const pInfo = personnel.find(p => p.id === dp.id);
      if (pInfo && centerMap[pInfo.center_id]) {
        centerMap[pInfo.center_id].pCount += 1;
      }
    });

    // 결과 정렬 (관할 우선, 그다음 가나다)
    const activeCenters = Object.values(centerMap)
      .filter(c => c.vList.length > 0 || c.pCount > 0)
      .sort((a, b) => {
        if (a.isJurisdiction) return -1;
        if (b.isJurisdiction) return 1;
        return a.name.localeCompare(b.name);
      });

    // 차량 종류별 통계 및 정렬
    const typeStatsMap = {};
    deployedVehicles.forEach(dv => {
      const v = vehicles.find(v => v.id === dv.id);
      if (v) {
        typeStatsMap[v.type] = (typeStatsMap[v.type] || 0) + 1;
      }
    });

    // 우선순위 정렬 (펌프차 > 물탱크차 > 구급차 > 기타)
    const typeOrder = { pump: 1, tanker: 2, ambulance: 3 };
    const typeStats = Object.entries(typeStatsMap).sort((a, b) => {
      const orderA = typeOrder[a[0]] || 99;
      const orderB = typeOrder[b[0]] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return b[1] - a[1]; // 우선순위가 같으면 대수 기준 내림차순
    });

    return {
      activeCenters,
      totalVehicles: deployedVehicles.length,
      totalPersonnel: activeCenters.reduce((sum, c) => sum + c.pCount, 0),
      typeStats
    };
  }, [deployed, vehicles, personnel, centers, selectedDistrict, isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(15px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000, padding: "20px"
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: "800px", height: "650px", background: "linear-gradient(145deg, #0f172a, #162238)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, display: "flex", flexDirection: "column",
          overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
          filter: "drop-shadow(0 0 20px rgba(96, 165, 250, 0.2))"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 - 여백 조정 */}
        <div style={{ padding: "24px 30px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "center", position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
          
          {/* 실시간 시계 - 좌측 절대 위치 배치 */}
          <div style={{ 
            position: "absolute", left: 30, display: "flex", alignItems: "center", gap: 10,
            background: "rgba(56, 189, 248, 0.03)", padding: "6px 14px", borderRadius: 12,
            border: "1px solid rgba(56, 189, 248, 0.15)", boxSizing: "border-box"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ 
                width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", 
                boxShadow: "0 0 8px #38bdf8", display: "inline-block"
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: 0.5 }}>Live</span>
            </div>
            <div style={{ width: "1px", height: 12, background: "rgba(255,255,255,0.1)" }} />
            <div style={{ 
              fontSize: 19, fontWeight: 700, color: "#fff", fontFamily: "'Roboto Mono', monospace", 
              letterSpacing: "0.5px", display: "flex", alignItems: "center", textShadow: "0 0 12px rgba(56, 189, 248, 0.4)"
            }}>
              {timeString}
            </div>
          </div>

          {/* 중앙 제목 섹션 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: "#fff", margin: 0, letterSpacing: -0.5 }}>현장 자원 총괄 현황</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 500, textTransform: "uppercase" }}>Overall Situational Dashboard</p>
          </div>
          <button 
            onClick={onClose}
            style={{ position: "absolute", top: 20, right: 30, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >✕</button>
        </div>

        {/* 상단 통합 요약 바 - 여백 축소 */}
        <div style={{ padding: "12px 40px 8px", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "center", gap: 60, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>센터 수</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#38bdf8" }}>{stats.activeCenters.length}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>총 차량</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fbbf24" }}>{stats.totalVehicles}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>총 인원</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#4ade80" }}>{stats.totalPersonnel}</div>
          </div>
        </div>

        {/* 메인 콘텐츠 영역 - 상단 여백 축소(v 표시 대응) */}
        <div style={{ flex: 1, padding: "8px 30px 30px", overflowY: "auto", display: "grid", gridTemplateColumns: "250px 1fr", gap: 30 }}>
          
          {/* 차종별 통계 */}
          <div style={{ borderRight: "1px solid rgba(255,255,255,0.05)", paddingRight: 30 }}>
            <h2 style={{ fontSize: 16, color: "#fff", marginBottom: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              📊 차종별 통계
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {stats.typeStats.map(([type, count]) => (
                <div key={type} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 22, display: "flex", alignItems: "center" }}>
                      {typeof VEHICLE_ICONS[type] === 'string' && VEHICLE_ICONS[type].startsWith("/") ? (
                        <img src={VEHICLE_ICONS[type]} alt={type} style={{ width: 26, height: 26 }} />
                      ) : (
                        VEHICLE_ICONS[type] || "🚒"
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{VEHICLE_LABELS[type]}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>{count}</div>
                </div>
              ))}
              {stats.typeStats.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 13 }}>투입된 차량이 없습니다.</div>
              )}
            </div>
          </div>

          {/* 센터별 상세 투입 현황 */}
          <div>
            <h2 style={{ fontSize: 16, color: "#fff", marginBottom: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              🏢 센터별 투입 현황
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {stats.activeCenters.map(center => (
                <div 
                  key={center.id} 
                  style={{ 
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${center.color}44`, borderRadius: 18, padding: "16px",
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: center.color, boxShadow: `0 0 8px ${center.color}` }} />
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{center.name}</div>
                    {center.isJurisdiction && <span style={{ fontSize: 9, color: center.color, border: `1px solid ${center.color}`, padding: "1px 4px", borderRadius: 4, fontWeight: 800 }}>관할</span>}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {center.vList.map(v => (
                        <div key={v.id} style={{ background: "rgba(255,255,255,0.05)", padding: "3px 6px", borderRadius: 4, fontSize: 10, color: "#94a3b8" }}>
                          {v.name}
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                      차량 <span style={{ color: "#38bdf8" }}>{center.vList.length}</span> / 인원 <span style={{ color: "#4ade80" }}>{center.pCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
