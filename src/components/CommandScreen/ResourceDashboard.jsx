import React from "react";

/**
 * ResourceDashboard: 왼쪽 사이드바에 표시되는 현장 투입 현황 및 활동 기록 섹션
 */
export default function ResourceDashboard({
  isLight,
  setShowResourceSummary,
  vehicleDeployedCount,
  personnelDeployedCount,
  sortedCenters,
  deployed,
  personnel,
  selectedDistrict,
  setShowResetConfirm,
  exportLogsAsCsv,
  logs
}) {
  return (
    <div style={{
      width: 250, background: "#0a1420", borderRight: "1px solid #1e3a52",
      display: "flex", flexDirection: "column", flexShrink: 0,
      filter: isLight ? "invert(1) hue-rotate(180deg)" : "none"
    }}>
      {/* 요약 헤더 */}
      <div
        onClick={() => setShowResourceSummary(true)}
        className="no-select"
        style={{ padding: "16px 20px", borderBottom: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "background 0.2s" }}
        onMouseEnter={e => e.currentTarget.style.background = "#1a2a3a"}
        onMouseLeave={e => e.currentTarget.style.background = "#0e1925"}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "#7ec8e3", letterSpacing: 1 }}>🏢 현장 투입</div>
        <div style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 500 }}>
          차량: <span style={{ color: "#60a5fa" }}>{vehicleDeployedCount}대</span>, 대원: <span style={{ color: "#4ade80" }}>{personnelDeployedCount}명</span>
        </div>
      </div>

      {/* 센터별 투입 현황 리스트 */}
      <div onClick={() => setShowResourceSummary(true)} style={{ flex: 1, overflowY: "auto", padding: "12px", cursor: "pointer" }}>
        {sortedCenters.map(c => {
          const deployedUnits = Object.values(deployed).filter(d => d.center_id === c.id);
          const vCount = deployedUnits.filter(d => d.itemType === "vehicle").length;
          
          // 대원 수 계산 (직접 투입 대원 + 차량에 탑승한 채 투입된 대원)
          const pSet = new Set();
          deployedUnits.forEach(d => { if (d.itemType === "personnel") pSet.add(d.id); });
          const deployedVehicleIds = deployedUnits.filter(d => d.itemType === "vehicle").map(d => d.id);
          personnel.forEach(p => { if (deployedVehicleIds.includes(p.vehicle_id)) pSet.add(p.id); });
          
          if (pSet.size === 0 && vCount === 0) return null;
          
          return (
            <div key={c.id} style={{ marginBottom: 16, background: "#0d1f30", border: `1px solid ${c.color}44`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: `${c.color}15`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.name}{selectedDistrict?.jurisdictional === c.name && " [관할]"}</div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 500 }}>
                <div style={{ color: "#4a7a9b" }}>차량: <span style={{ color: "#60a5fa" }}>{vCount}대</span></div>
                <div style={{ width: 1, height: 10, background: "#1e3a52" }} />
                <div style={{ color: "#4a7a9b" }}>대원: <span style={{ color: "#4ade80" }}>{pSet.size}명</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 활동 기록 섹션 */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#ff6030" }}>📜 활동 기록</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); setShowResetConfirm(true); }} style={{ background: "#3a1a1a", border: "1px solid #ff450066", borderRadius: 4, color: "#ff7050", padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>초기화</button>
          <button onClick={(e) => { e.stopPropagation(); exportLogsAsCsv(logs); }} style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 4, color: "#7ec8e3", padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>저장</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: "#060d18", padding: "8px 0" }}>
        {logs.map(log => (
          <div key={log.id} style={{ padding: "8px 16px", borderBottom: "1px solid #1e3a5222", fontSize: 11 }}>
            <span style={{ color: "#4a7a9b", marginRight: 8 }}>{log.timestamp}</span>
            <span style={{ color: log.type === "recall" ? "#ff7050" : "#7ec8e3" }}>{log.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
