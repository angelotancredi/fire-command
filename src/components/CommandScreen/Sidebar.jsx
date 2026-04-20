import React from "react";

export default function Sidebar({
  isLight,
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  setSideTab,
  sortedCenters,
  personnel,
  vehicles,
  deployedIds,
  expandedCenters,
  setExpandedCenters,
  dragOffsetRef,
  dragPayloadRef,
  dragStartPosRef,
  VEHICLE_ICONS,
  VEHICLE_LABELS
}) {
  return (
    <div style={{ 
      width: 250, background: "#080f1a", borderLeft: "1px solid #1e3a52", 
      display: "flex", flexDirection: "column", position: "relative", zIndex: 100, 
      filter: isLight ? "invert(1) hue-rotate(180deg)" : "none",
      marginRight: isSidebarOpen ? 0 : -250,
      transition: "margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
    }}>
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{
          position: "absolute",
          left: -32,
          top: "50%",
          transform: "translateY(-50%)",
          width: 32,
          height: 64,
          background: "#080f1a",
          border: "1px solid #1e3a52",
          borderRight: "none",
          borderRadius: "8px 0 0 8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#4a7a9b",
          zIndex: 101,
          boxShadow: "-4px 0 15px rgba(0,0,0,0.5)",
          transition: "all 0.2s"
        }}
        onMouseEnter={e => { e.currentTarget.style.color = "#ff4500"; e.currentTarget.style.background = "#112233"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#4a7a9b"; e.currentTarget.style.background = "#080f1a"; }}
      >
        <span style={{ fontSize: 16 }}>{isSidebarOpen ? "▶" : "◀"}</span>
      </button>
      <div style={{ display: "flex", background: "#0e1925" }}>
        {[
          { k: "vehicle", icon: "🚒", label: "차량" }, 
          { k: "personnel", icon: <img src="/icons/fireman.svg" alt="대원" style={{ width: 20, height: 20 }} />, label: "대원" }
        ].map(t => (
          <button 
            key={t.k} 
            onClick={() => setSideTab(t.k)} 
            style={{ 
              flex: 1, padding: "12px 0", 
              background: activeTab === t.k ? "#1a3a52" : "transparent", 
              border: "none", 
              borderBottom: `2px solid ${activeTab === t.k ? "#ff4500" : "transparent"}`, 
              color: activeTab === t.k ? "#fff" : "#4a7a9b", 
              fontSize: 18, fontWeight: 700, 
              display: "flex", alignItems: "center", justifyContent: "center" 
            }}
          >
            <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, fontSize: 18 }}>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
        {sortedCenters.map(c => {
          const list = (activeTab === "personnel" ? personnel : vehicles).filter(x => x.center_id === c.id && !deployedIds.has(`${activeTab}_${x.id}`));
          if (!list.length) return null;
          const isExpanded = expandedCenters[c.id];
          return (
            <div key={c.id} style={{ marginBottom: 16 }}>
              <div
                onClick={() => setExpandedCenters(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                style={{ 
                  width: "100%", background: "rgba(255,255,255,0.03)", 
                  border: "1px solid #1e3a52", borderRadius: 8, 
                  fontSize: 15, color: c.color, fontWeight: 700, 
                  marginBottom: 8, display: "flex", justifyContent: "space-between", 
                  alignItems: "center", cursor: "pointer", padding: "12px 16px", 
                  boxSizing: "border-box" 
                }}
              >
                <span>{c.name}</span>
                <span style={{ fontSize: 12, color: "#a0c4d8" }}>{isExpanded ? "▲ 접기" : "▼ 펼치기"}</span>
              </div>
              {isExpanded && list.map(x => (
                <div key={x.id}
                  onMouseDown={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    dragOffsetRef.current = {
                      x: e.clientX - (rect.left + rect.width / 2),
                      y: e.clientY - (rect.top + rect.height / 2)
                    };
                    dragPayloadRef.current = { ...x, itemType: activeTab };
                    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onTouchStart={e => {
                    const touch = e.touches[0];
                    const rect = e.currentTarget.getBoundingClientRect();
                    dragOffsetRef.current = {
                      x: touch.clientX - (rect.left + rect.width / 2),
                      y: touch.clientY - (rect.top + rect.height / 2)
                    };
                    dragPayloadRef.current = { ...x, itemType: activeTab };
                    dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                  }}
                  style={{ 
                    background: "#112233", border: "1px solid #1e3a52", 
                    borderRadius: 8, padding: "8px 12px", marginBottom: 6, 
                    cursor: "grab", display: "flex", alignItems: "center", gap: 10, 
                    userSelect: "none", touchAction: "pan-y" 
                  }}
                >
                  <span style={{ fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                    {activeTab === "personnel" ? (
                      <img src="/icons/fireman.svg" alt="대원" style={{ width: "100%", height: "100%" }} />
                    ) : (
                      VEHICLE_ICONS[x.type]?.startsWith("/") ? (
                        <img src={VEHICLE_ICONS[x.type]} alt={x.type} style={{ width: "100%", height: "100%" }} />
                      ) : (
                        VEHICLE_ICONS[x.type]
                      )
                    )}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{x.name}</div>
                    <div style={{ fontSize: 11, color: "#4a7a9b" }}>{x.role || VEHICLE_LABELS[x.type]}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
