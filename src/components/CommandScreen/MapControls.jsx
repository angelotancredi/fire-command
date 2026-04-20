import React from "react";

export default function MapControls({
  isAccidentLocked,
  setIsAccidentLocked,
  mciSetupStarted,
  isMciLocked,
  setIsMciLocked,
  addLog,
  setMciSetupStarted,
  setMciPos,
  stagingSetupStarted,
  isStagingLocked,
  setIsStagingLocked,
  setStagingSetupStarted,
  setStagingPos,
  selectedDistrict,
  mciStats,
  setShowConfirm,
  dragging,
  dragPos,
  dragOffsetRef,
  mapRef,
  setSelectedTarget,
  setShowUtilityModal,
  setUtilityTab,
  setMciFromBadge,
  accidentPos,
  siameseLinks,
  setSiameseLinks,
  moveToMyLocation,
  showHydrantRadiusPicker,
  setHydrantRadius,
  setHydrantVisible,
  setShowHydrantRadiusPicker,
  hydrantVisible,
  hydrantMarkersRef,
  hydrantRadius,
  isLight,
  HOSPITALS,
  centers,
  vehicles,
  personnel
}) {
  return (
    <>
      {/* 1. Placement Confirmation Bars (Top Center) */}
      <div style={{ position: "absolute", top: 12, left: 0, right: 0, zIndex: 10005, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, pointerEvents: "none" }}>
        {!isAccidentLocked && (
          <div style={{ background: "rgba(14, 25, 37, 0.95)", border: "1px solid #ff4500", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.6)", pointerEvents: "auto" }}>
            <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>화재 지점을 드래그하여 설정하세요</span>
            <button onClick={() => { setIsAccidentLocked(true); addLog("화재 지점 위치 확정", "warning"); }} style={{ background: "linear-gradient(135deg, #ff4500, #ff8c00)", border: "none", borderRadius: 8, color: "#ffff00", padding: "6px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 10px rgba(255,69,0,0.4)" }}>화재 지점 확정</button>
          </div>
        )}

        {mciSetupStarted && !isMciLocked && (
          <div style={{ background: "rgba(14, 25, 37, 0.95)", border: "1px solid #4ade80", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,255,0,0.3)", pointerEvents: "auto" }}>
            <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>🚑 임시의료소를 설치하세요</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setIsMciLocked(true);
                  addLog("임시의료소 위치 확정", "info");
                }}
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
              >임시의료소 확정</button>
              <button
                onClick={() => {
                  setMciSetupStarted(false);
                  setMciPos(null);
                  addLog("임시의료소 설치 취소", "recall");
                }}
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid #ff4500", borderRadius: 8, color: "#ff7050", padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >설치 취소</button>
            </div>
          </div>
        )}

        {stagingSetupStarted && !isStagingLocked && (
          <div style={{ background: "rgba(14, 25, 37, 0.95)", border: "1px solid #8b5cf6", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)", pointerEvents: "auto" }}>
            <span style={{ fontSize: 15, color: "#fff", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <img src="/icons/fire-point.svg" alt="자원집결지" style={{ width: 20, height: 20 }} />
              자원집결지를 설치하세요
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setIsStagingLocked(true);
                  addLog("자원집결지 위치 확정", "info");
                }}
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
              >자원집결지 확정</button>
              <button
                onClick={() => {
                  setStagingSetupStarted(false);
                  setStagingPos(null);
                  addLog("자원집결지 설치 취소", "recall");
                }}
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid #ff4500", borderRadius: 8, color: "#ff7050", padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >설치 취소</button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Status Badges (Top Left) */}
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10006, display: "flex", flexDirection: "column", gap: 12, pointerEvents: "none" }}>
        {selectedDistrict && isMciLocked && (
          <div
            style={{ background: "linear-gradient(135deg, #1e3a52, #0f1a2a)", border: "1px solid #4ade80", borderRadius: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.4)", cursor: "default", pointerEvents: "auto" }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>MCI 대응 중</div>
              <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 500 }}>사상자: {mciStats.red + mciStats.yellow + mciStats.green + mciStats.black}명</div>
            </div>
            <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
              <div
                onClick={(e) => { e.stopPropagation(); setIsMciLocked(false); }}
                style={{ padding: "4px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 12, color: "#a0c4d8", fontWeight: 700, cursor: "pointer" }}
              >위치정정</div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm({ type: "mci-clear", name: "임시의료소" });
                }}
                style={{ padding: "4px 8px", background: "rgba(255,69,0,0.2)", border: "1px solid #ff450066", borderRadius: 6, fontSize: 12, color: "#ff7050", fontWeight: 700, cursor: "pointer" }}
              >MCI 취소</div>
            </div>
          </div>
        )}

        {selectedDistrict && isStagingLocked && (
          <div
            style={{ background: "linear-gradient(135deg, #1e3a52, #0f1a2a)", border: "1px solid #f97316", borderRadius: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.4)", cursor: "default", pointerEvents: "auto" }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>자원집결지 설정됨</div>
            </div>
            <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
              <div
                onClick={(e) => { e.stopPropagation(); setIsStagingLocked(false); }}
                style={{ padding: "4px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 12, color: "#a0c4d8", fontWeight: 700, cursor: "pointer" }}
              >위치정정</div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm({ type: "staging-clear", name: "자원집결지" });
                }}
                style={{ padding: "4px 8px", background: "rgba(255,69,0,0.2)", border: "1px solid #ff450066", borderRadius: 6, fontSize: 12, color: "#ff7050", fontWeight: 700, cursor: "pointer" }}
              >해체</div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Drag Preview */}
      {dragging && dragPos && mapRef.current && (() => {
        const rect = mapRef.current.getBoundingClientRect();
        const isOver = dragPos.x >= rect.left && dragPos.x <= rect.right && dragPos.y >= rect.top && dragPos.y <= rect.bottom;
        return isOver ? (
          <div style={{ position: "fixed", left: dragPos.x - dragOffsetRef.current.x, top: dragPos.y - dragOffsetRef.current.y, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 9999, background: dragging.itemType === "vehicle" ? "#1e2a3a" : (dragging.itemType === "personnel" ? "#2a1a1a" : "linear-gradient(135deg, #065f46, #064e3b)"), border: dragging.itemType === "siamese" ? "2px solid #10b981" : "2px dashed #ff4500", borderRadius: dragging.itemType === "vehicle" || dragging.itemType === "siamese" ? 8 : "50%", padding: dragging.itemType === "siamese" ? "6px 10px" : "6px 12px", display: "flex", alignItems: "center", boxShadow: dragging.itemType === "siamese" ? "0 4px 20px rgba(16,185,129,0.5)" : "0 4px 20px rgba(255,69,0,0.6)", opacity: 0.9 }}>
            {dragging.itemType === "siamese" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ width: 14, height: 14, background: "#f87171", border: "1.5px solid #d4af37", borderRadius: "50%", position: "relative" }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1.5, background: "#d4af37", transform: "translateY(-50%)" }}></div>
                </div>
                <div style={{ width: 14, height: 14, background: "#f87171", border: "1.5px solid #d4af37", borderRadius: "50%", position: "relative" }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1.5, background: "#d4af37", transform: "translateY(-50%)" }}></div>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{dragging.name}</span>
            )}
          </div>
        ) : null;
      })()}

      {/* 4. Top Right Controls (Target Management) */}
      {selectedDistrict && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10006 }}>
          <button
            onClick={() => { setShowUtilityModal(true); setUtilityTab("targets"); setMciFromBadge(false); setSelectedTarget(null); }}
            style={{
              width: 44, height: 44,
              background: "linear-gradient(135deg, #1e3a52, #0f1a2a)",
              border: "1px solid #8b5cf666",
              borderRadius: 12,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "auto",
              boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.borderColor = "#8b5cf6";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "#8b5cf666";
            }}
            title="진압전술관리"
          >
            <span style={{ fontSize: 20 }}>🏢</span>
          </button>
        </div>
      )}

      {/* 5. Bottom Right Controls */}
      {selectedDistrict && (
        <>
          {/* 연결송수구 배치 버튼 */}
          <div style={{ position: "absolute", bottom: 230, right: 20, zIndex: 10006 }}>
            <button
              onClick={() => {
                if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요.");
                if (siameseLinks.length > 0) return alert("이미 연결송수구가 배치되어 있습니다. 드래그하여 이동시키거나 기존 것을 제거해 주세요.");
                const newId = `siamese_${Date.now()}`;
                const newConn = {
                  id: newId,
                  lat: accidentPos.lat + (Math.random() - 0.5) * 0.0002,
                  lng: accidentPos.lng + (Math.random() - 0.5) * 0.0002,
                  name: "연결송수구"
                };
                setSiameseLinks(prev => [...prev, newConn]);
                addLog("지도상에 연결송수구 배치", "info");
              }}
              style={{
                width: 56, height: 56,
                background: "linear-gradient(135deg, #064e3b, #065f46)",
                border: "1px solid #10b98166",
                borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                pointerEvents: "auto",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.borderColor = "#10b981";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.3)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.borderColor = "#10b98166";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)";
              }}
              title="연결송수구 배치"
            >
              <svg viewBox="0 -4 64 52" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="38" width="60" height="6" rx="1" fill="#064e3b" stroke="#10b981" strokeWidth="2"/>
                <path d="M6 38V22C6 17.5817 9.5817 14 14 14H50C54.4183 14 58 17.5817 58 22V38" stroke="#10b981" strokeWidth="3"/>
                <circle cx="15" cy="18" r="11" fill="#f87171" stroke="#fbbf24" strokeWidth="2.5"/>
                <circle cx="49" cy="18" r="11" fill="#f87171" stroke="#fbbf24" strokeWidth="2.5"/>
                <path d="M6 18H15M49 18H58" stroke="#fbbf24" strokeWidth="2.5"/>
              </svg>
            </button>
          </div>

          {/* 현재 위치로 이동 버튼 */}
          <div style={{ position: "absolute", bottom: 160, right: 20, zIndex: 10006 }}>
            <button
              onClick={moveToMyLocation}
              style={{
                width: 56, height: 56,
                background: "linear-gradient(135deg, #1e3a52, #0f1a2a)",
                border: "1px solid #7ec8e366",
                borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                pointerEvents: "auto",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.borderColor = "#7ec8e3";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.borderColor = "#7ec8e366";
              }}
              title="현재 위치로 사고 지점 설정"
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#7ec8e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="22" y1="12" x2="18" y2="12" />
                <line x1="6" y1="12" x2="2" y2="12" />
                <line x1="12" y1="6" x2="12" y2="2" />
                <line x1="12" y1="22" x2="12" y2="18" />
                <circle cx="12" cy="12" r="3" fill="#7ec8e3" />
              </svg>
            </button>
          </div>

          {/* 소화전 버튼 및 반경 선택기 */}
          <div style={{ position: "absolute", bottom: 90, right: 20, zIndex: 10006 }}>
            {showHydrantRadiusPicker && (
              <div style={{ position: "absolute", bottom: 64, right: 0, background: "#0d1f30", border: "1px solid #2a6a8a", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", gap: 6, minWidth: 90, pointerEvents: "auto" }}>
                {[{ label: "200m", val: 200 }, { label: "500m", val: 500 }, { label: "1km", val: 1000 }, { label: "2km", val: 2000 }].map(r => (
                  <button key={r.val} onClick={() => {
                    setHydrantRadius(r.val);
                    setHydrantVisible(true);
                    setShowHydrantRadiusPicker(false);
                  }} style={{ padding: "8px 14px", background: hydrantRadius === r.val ? "#1e3a52" : "transparent", border: `1px solid ${hydrantRadius === r.val ? "#7ec8e3" : "#2a6a8a"}`, borderRadius: 6, color: hydrantRadius === r.val ? "#7ec8e3" : "#a0c4d8", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                if (hydrantVisible) {
                  setHydrantVisible(false);
                  setShowHydrantRadiusPicker(false);
                  hydrantMarkersRef.current.forEach(o => o.setMap(null));
                  hydrantMarkersRef.current = [];
                } else {
                  if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요.");
                  setShowHydrantRadiusPicker(v => !v);
                }
              }}
              style={{
                width: 56, height: 56,
                background: hydrantVisible ? "linear-gradient(135deg, #3a1a1a, #1a0a0a)" : "linear-gradient(135deg, #1e3a52, #0f1a2a)",
                border: `1px solid ${hydrantVisible ? "#ff4500" : "#2a6a8a"}`,
                borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                pointerEvents: "auto"
              }}
            >
              {hydrantVisible
                ? <span style={{ fontSize: 22, color: "#ff7050", fontWeight: 700 }}>✕</span>
                : <img src="/icons/hydrant.svg" alt="소화전" style={{ width: 28, height: 28, filter: "brightness(10) saturate(0)" }} />
              }
            </button>
          </div>

          {/* 유틸리티 메뉴 버튼 */}
          <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 10006 }}>
            <button
              onClick={() => { setShowUtilityModal(true); setUtilityTab("menu"); setMciFromBadge(false); }}
              style={{
                width: 56, height: 56,
                background: "linear-gradient(135deg, #1e3a52, #0f1a2a)",
                border: "1px solid #2a6a8a",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.1) rotate(90deg)";
                e.currentTarget.style.borderColor = "#ff4500";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(255,69,0,0.3)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1) rotate(0deg)";
                e.currentTarget.style.borderColor = "#2a6a8a";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)";
              }}
            >
              <img src="/icons/menu.svg" alt="menu" style={{ width: 26, height: 26, filter: "invert(1) brightness(2)" }} />
            </button>
          </div>
        </>
      )}
    </>
  );
}
