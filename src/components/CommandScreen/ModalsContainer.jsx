import React from "react";
import MciModule from "./MciModule.jsx";
import TargetModule from "./TargetModule.jsx";
import StagingPopup from "./StagingPopup.jsx";
import ResourceSummaryPopup from "./ResourceSummaryPopup.jsx";

export default function ModalsContainer({
  // Global/UI
  isLight,
  supabase,
  addLog,
  
  // Confirm Modal
  showConfirm,
  setShowConfirm,
  hoseLinks,
  setWaterSprayLinks,
  setHoseLinks,
  isMciLocked,
  setIsMciLocked,
  mciSetupStarted,
  setMciSetupStarted,
  mciPos,
  setMciPos,
  mciStats,
  setMciStats,
  hospitalStats,
  setHospitalStats,
  isStagingLocked,
  setIsStagingLocked,
  stagingSetupStarted,
  setStagingSetupStarted,
  stagingPos,
  setStagingPos,
  selected,
  setSelected,
  mciTransportLog,
  setMciTransportLog,
  deleteTargetRecord,
  deleteSnapshotRecord,
  confirmRecall,
  HOSPITALS,

  // Reset Modals
  showResetConfirm,
  setShowResetConfirm,
  handleResetLogs,
  showGlobalResetInit,
  setShowGlobalResetInit,
  onGlobalReset,

  // Water Adjust
  showWaterAdjust,
  setShowWaterAdjust,
  setDeployed,

  // Utility Modal
  showUtilityModal,
  setShowUtilityModal,
  utilityTab,
  setUtilityTab,
  mciViewMode,
  setMciViewMode,
  mciFromBadge,
  mciTransports,
  setMciTransports,
  vehicles,
  targets,
  selectedTarget,
  setSelectedTarget,
  snapshots,
  isSavingSnapshot,
  setInputModal,
  loadSnapshots,
  handleLoadSnapshot,
  saveSnapshot,
  onManage,
  centers,
  pumpCalc,
  setPumpCalc,
  accidentPos,
  UTILITY_MENU_ITEMS,

  // Input Modal
  inputModal,

  // Resource Summary
  showResourceSummary,
  setShowResourceSummary,
  deployed,
  personnel,
  selectedDistrict,
  setHydrantCaptureLinks
}) {
  return (
    <>
      {/* 1. Confirmation Modal */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000, backdropFilter: "blur(4px)" }} onClick={() => setShowConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1925", border: `1px solid ${showConfirm.type === 'recall' ? '#ff4500' : '#4ade80'}`, borderRadius: 20, padding: 32, maxWidth: 360, width: "100%", textAlign: "center", filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
              {showConfirm.type === "hose" ? `${showConfirm.fromName} 수관을 회수하시겠습니까?`
                : showConfirm.type === "hydrant-release" ? `${showConfirm.vehicleName}의 소화전 점령을 해제하시겠습니까?`
                  : showConfirm.type === "mci-clear" ? "임시의료소를 해체하고 모든 통계를 초기화하시겠습니까?"
                    : showConfirm.type === "staging-clear" ? "자원집결지를 해체하시겠습니까?"
                      : showConfirm.type === "log-clear" ? "이동 로그를 전체 초기화하시겠습니까?"
                        : showConfirm.type === "target-delete" ? `대상물 "${showConfirm.name}"을(를) 삭제하시겠습니까?\n모든 관련 전술 스냅샷도 함께 삭제됩니다.`
                          : showConfirm.type === "snapshot-delete" ? `전술 스냅샷 "${showConfirm.name}"을(를) 삭제하시겠습니까?`
                            : `${showConfirm.name} 철수하시겠습니까?`}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(null)} style={{ flex: 1, padding: "8px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#fff" }}>취소</button>
              <button onClick={() => {
                if (showConfirm.type === "hose") {
                  const linkToRemove = hoseLinks.find(l => l.id === showConfirm.linkId);
                  addLog(`수관 회수: ${showConfirm.fromName} ↔ ${showConfirm.toName}`, "info");
                  if (linkToRemove && (linkToRemove.toType === "personnel" || !linkToRemove.toType)) {
                    setWaterSprayLinks(prev => prev.filter(s => String(s.personnelId) !== String(linkToRemove.toId)));
                  }
                  setHoseLinks(prev => prev.filter(l => l.id !== showConfirm.linkId));
                  setShowConfirm(null);
                  setSelected(null);
                } else if (showConfirm.type === "hydrant-release") {
                  addLog(`${showConfirm.vehicleName} 소화전 점령 해제`, "info");
                  // Note: setHydrantCaptureLinks should be passed
                  setHydrantCaptureLinks(prev => prev.filter(l => l.vehicleId !== showConfirm.vehicleId));
                  setShowConfirm(null);
                  setSelected(null);
                } else if (showConfirm.type === "mci-clear") {
                  setIsMciLocked(false);
                  setMciSetupStarted(false);
                  setMciPos(null);
                  setMciStats({ red: 0, yellow: 0, green: 0, black: 0 });
                  setHospitalStats(HOSPITALS.reduce((acc, h) => ({ ...acc, [h.name]: { red: 0, yellow: 0, green: 0, black: 0 } }), {}));
                  addLog("임시의료소 전체 해체 및 초기화", "recall");
                  setShowConfirm(null);
                } else if (showConfirm.type === "staging-clear") {
                  setIsStagingLocked(false);
                  setStagingSetupStarted(false);
                  setStagingPos(null);
                  if (selected === "staging-site") setSelected(null);
                  addLog("자원집결지 해체 완료", "recall");
                  setShowConfirm(null);
                } else if (showConfirm.type === "log-clear") {
                  setMciTransportLog([]);
                  addLog("이동 로그 초기화", "info");
                  setShowConfirm(null);
                } else if (showConfirm.type === "target-delete") {
                  deleteTargetRecord(showConfirm.id, showConfirm.name);
                  setShowConfirm(null);
                } else if (showConfirm.type === "snapshot-delete") {
                  deleteSnapshotRecord(showConfirm.id, showConfirm.name, showConfirm.targetId);
                  setShowConfirm(null);
                } else { confirmRecall(); }
              }} style={{ flex: 1, padding: "8px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 6, color: "#ff7050" }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Reset Log Modal */}
      {showResetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000, backdropFilter: "blur(4px)" }} onClick={() => setShowResetConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1925", border: "1px solid #ff4500", borderRadius: 20, padding: 32, maxWidth: 360, width: "100%", textAlign: "center", filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>기록을 초기화하시겠습니까?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: "8px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#fff" }}>취소</button>
              <button onClick={handleResetLogs} style={{ flex: 1, padding: "8px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 6, color: "#ff7050" }}>초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Global Reset Modal */}
      {showGlobalResetInit && (
        <div style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000, backdropFilter: "blur(8px)" }} onClick={() => setShowGlobalResetInit(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1925", border: "1px solid #ff4500", borderRadius: 20, padding: 32, maxWidth: 360, width: "100%", textAlign: "center", filter: isLight ? "invert(1) hue-rotate(180deg)" : "none", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>시작 화면으로 돌아갈까요?</div>
            <div style={{ fontSize: 13, color: "#a0c4d8", lineHeight: 1.6, marginBottom: 24 }}>현재 진행 중인 모든 배치 정보와<br />활동 기록이 삭제되고 초기화됩니다.</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowGlobalResetInit(false)} style={{ flex: 1, padding: "12px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer" }}>취소</button>
              <button onClick={() => { onGlobalReset(); setShowGlobalResetInit(false); }} style={{ flex: 1, padding: "12px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 8, color: "#ff7050", fontWeight: 700, cursor: "pointer" }}>전체 초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Water Capacity Adjustment Modal */}
      {showWaterAdjust && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000, backdropFilter: "blur(10px)" }} onClick={() => setShowWaterAdjust(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(145deg, #101a2a, #0a121e)", border: "1px solid #009dff66", borderRadius: 20, padding: "20px", minWidth: 240, textAlign: "center", boxShadow: "0 15px 40px rgba(0,0,0,0.8)", filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
            <div style={{ fontSize: 12, color: "#7ec8e3", marginBottom: 4, fontWeight: 600 }}>{showWaterAdjust.name}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 20 }}>잔여 수량 설정</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 15, marginBottom: 24 }}>
              <button
                onClick={() => setShowWaterAdjust(prev => ({ ...prev, current: Math.max(0, prev.current - 100) }))}
                style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #1e3a52", background: "#1a2a3a", color: "#60a5fa", fontSize: 20, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
              >－</button>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "tabular-nums", textShadow: "0 0 10px #009dff44" }}>
                  {showWaterAdjust.current}
                </div>
                <div style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 600 }}>LITERS</div>
              </div>

              <button
                onClick={() => setShowWaterAdjust(prev => ({ ...prev, current: prev.current + 100 }))}
                style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #1e3a52", background: "#1a2a3a", color: "#60a5fa", fontSize: 20, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
              >＋</button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowWaterAdjust(null)} style={{ flex: 1, padding: "12px 0", background: "transparent", border: "1px solid #1e3a52", borderRadius: 10, color: "#4a7a9b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>취소</button>
              <button
                onClick={async () => {
                  const targetId = showWaterAdjust.id;
                  const newVal = showWaterAdjust.current;
                  const compositeKey = `vehicle_${targetId}`;
                  setDeployed(prev => ({
                    ...prev,
                    [compositeKey]: { ...prev[compositeKey], water_capacity: newVal }
                  }));
                  try {
                    await supabase.from("deployments").update({ water_capacity: newVal }).eq("item_id", targetId);
                  } catch (err) { console.error("Water update fail:", err); }
                  addLog(`${showWaterAdjust.name} 수량 ${newVal}L로 조정`, "info");
                  setShowWaterAdjust(null);
                }}
                style={{ flex: 1.5, padding: "12px 0", background: "linear-gradient(135deg, #007bff, #0056b3)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(0,123,255,0.3)" }}
              >저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Giant Utility Modal */}
      {showUtilityModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 20000, backdropFilter: "blur(12px)", padding: "11vh 20px 20px 20px" }} onClick={() => setShowUtilityModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "linear-gradient(145deg, #0f1a2a, #070d14)",
            border: "1px solid #ff450066",
            borderRadius: 24, padding: "22px 24px",
            width: utilityTab === "mci" ? (mciViewMode === "hospital" ? "min(1380px, 96vw)" : "min(320px, 96vw)") : "min(462px, 96vw)",
            maxWidth: "96vw",
            minHeight: utilityTab === "mci" ? 520 : "auto",
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            filter: isLight ? "invert(1) hue-rotate(180deg)" : "none",
            msOverflowStyle: "none", scrollbarWidth: "none"
          }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                {utilityTab !== "menu" && utilityTab !== "targets" && !mciFromBadge && (
                  <button onClick={() => setUtilityTab("menu")} style={{ background: "transparent", border: "none", color: "#7ec8e3", fontSize: 18, cursor: "pointer", padding: "4px" }}>←</button>
                )}
                <span style={{ fontSize: 24 }}>{utilityTab === "menu" ? "🛠️" : utilityTab === "calc" ? "🧮" : utilityTab === "targets" ? "🏢" : utilityTab === "forest_fire" ? "🌲" : "🚑"}</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: -0.5, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {utilityTab === "menu" ? "현장 지휘 유틸리티" : (utilityTab === "calc" ? "고층건물화재 방수압력 계산기" : utilityTab === "targets" ? "진압전술관리" : utilityTab === "forest_fire" ? "산불진화 대응" : "다수사상자 대응 (MCI)")}
                </span>
              </div>
              <button onClick={() => setShowUtilityModal(false)} style={{ background: "transparent", border: "none", color: "#4a7a9b", fontSize: 32, lineHeight: 1, cursor: "pointer", padding: "0 4px", marginLeft: 10 }}>×</button>
            </div>

            {/* Menu Tab */}
            {utilityTab === "menu" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {UTILITY_MENU_ITEMS.map(m => (
                  <button
                    key={m.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (m.key === "staging") {
                        if (!isStagingLocked) {
                          setStagingSetupStarted(true);
                          if (!stagingPos && accidentPos) {
                            setStagingPos({ lat: accidentPos.lat - 0.0005, lng: accidentPos.lng - 0.0005 });
                          }
                        } else {
                          setSelected("staging-site");
                        }
                        setShowUtilityModal(false);
                        return;
                      }
                      if (m.key === "mci" && !isMciLocked) {
                        setMciSetupStarted(true);
                        if (!mciPos && accidentPos) {
                          setMciPos({ lat: accidentPos.lat - 0.0003, lng: accidentPos.lng + 0.0003 });
                        }
                        setShowUtilityModal(false);
                      }
                      setUtilityTab(m.key);
                    }}
                    style={{
                      width: "100%", padding: "14px 16px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 20,
                      display: "flex", alignItems: "center", gap: 14,
                      cursor: "pointer", textAlign: "left",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      position: "relative",
                      overflow: "hidden"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.borderColor = m.color + "66";
                      e.currentTarget.style.boxShadow = `0 10px 20px ${m.color}15`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: m.gradient }} />
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: `1px solid ${m.color}33` }}>
                      {m.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#fff", marginBottom: 3 }}>{m.label}</div>
                      <div style={{ fontSize: 13, color: "#7ec8e3", opacity: 0.8, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: m.desc }} />
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: m.color, fontSize: 14 }}>➔</div>
                  </button>
                ))}
                <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "#4a7a9b", fontWeight: 500, opacity: 0.6, letterSpacing: 1 }}>CONNECTED TO HEADQUARTER</div>
              </div>
            )}

            {/* Calculator Tab */}
            {utilityTab === "calc" && (
              <>
                <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
                  <button onClick={() => setPumpCalc(p => ({ ...p, mode: "standard" }))} style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 8, background: pumpCalc.mode === "standard" ? "#1e3a52" : "transparent", color: pumpCalc.mode === "standard" ? "#fff" : "#4a7a9b", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "0.2s" }}>💦 일반 관창</button>
                  <button onClick={() => setPumpCalc(p => ({ ...p, mode: "monitor" }))} style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 8, background: pumpCalc.mode === "monitor" ? "#ff4500" : "transparent", color: pumpCalc.mode === "monitor" ? "#fff" : "#4a7a9b", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "0.2s" }}>🚒 방수포</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 16, border: "1px solid #1e3a52" }}>
                    <div style={{ fontSize: 13, color: "#cfedf8ff", marginBottom: 12, fontWeight: 500 }}>화재 발생 층수</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button onClick={() => setPumpCalc(p => ({ ...p, floor: Math.max(1, p.floor - 1) }))} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #1e3a52", background: "#1a2a3a", color: "#fff", cursor: "pointer" }}>－</button>
                      <div style={{ flex: 1, textAlign: "center", fontSize: 20, fontWeight: 800, color: "#fff" }}>{pumpCalc.floor}<span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4, color: "#4a7a9b" }}>층</span></div>
                      <button onClick={() => setPumpCalc(p => ({ ...p, floor: p.floor + 1 }))} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #1e3a52", background: "#1a2a3a", color: "#fff", cursor: "pointer" }}>＋</button>
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 16, border: "1px solid #1e3a52", opacity: pumpCalc.mode === "monitor" ? 0.35 : 1, pointerEvents: pumpCalc.mode === "monitor" ? "none" : "auto", transition: "0.3s" }}>
                    <div style={{ fontSize: 13, color: "#cfedf8ff", marginBottom: 12, fontWeight: 500 }}>수관 연장 본수 (15m 기준)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <button onClick={() => setPumpCalc(p => ({ ...p, hose: Math.max(1, p.hose - 1) }))} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #1e3a52", background: "#1a2a3a", color: "#fff", cursor: "pointer" }}>－</button>
                      <div style={{ flex: 1, textAlign: "center", fontSize: 20, fontWeight: 800, color: "#fff" }}>{pumpCalc.mode === "monitor" ? 0 : pumpCalc.hose}<span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4, color: "#4a7a9b" }}>본</span></div>
                      <button onClick={() => setPumpCalc(p => ({ ...p, hose: p.hose + 1 }))} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #1e3a52", background: "#1a2a3a", color: "#fff", cursor: "pointer" }}>＋</button>
                    </div>
                    <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 3, border: "1px solid rgba(255,255,255,0.05)" }}>
                      {[40, 65].map(size => (
                        <button key={size} onClick={() => setPumpCalc(p => ({ ...p, hoseSize: size }))} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 8, background: pumpCalc.hoseSize === size ? "linear-gradient(135deg, #3b82f6, #1e3a8a)" : "transparent", color: pumpCalc.hoseSize === size ? "#fff" : "#7ec8e3", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", opacity: pumpCalc.hoseSize === size ? 1 : 0.6 }}>
                          {size}mm
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: 20, background: "linear-gradient(135deg, #1e3a52, #0d1f30)", borderRadius: 20, border: `1px solid ${pumpCalc.mode === 'monitor' ? '#ff450088' : '#ff450044'}`, textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#a0c4d8", marginBottom: 8, fontWeight: 600 }}>적정 송수 압력 (추정치)</div>
                    <div style={(() => {
                      const base = pumpCalc.mode === "monitor" ? 0.70 : 0.35;
                      const hoseFactor = pumpCalc.hoseSize === 40 ? 0.05 : 0.015;
                      const valKg = (((pumpCalc.floor - 1) * 0.03) + (pumpCalc.hose * hoseFactor) + base) * 10.2;
                      const hue = Math.max(0, Math.min(45, 45 - (valKg - 3.5) * 3));
                      const color = `hsl(${hue}, 100%, 55%)`;
                      return { fontSize: 32, fontWeight: 900, color: color, textShadow: `0 0 10px ${color}66`, transition: "0.4s" };
                    })()}>
                      {(() => {
                        const base = pumpCalc.mode === "monitor" ? 0.70 : 0.35;
                        const hoseFactor = pumpCalc.hoseSize === 40 ? 0.05 : 0.015;
                        const valKg = (((pumpCalc.floor - 1) * 0.03) + (pumpCalc.hose * hoseFactor) + base) * 10.2;
                        return valKg.toFixed(1);
                      })()}
                      <span style={{ fontSize: 16, fontWeight: 700, marginLeft: 5 }}>kgf/cm²</span>
                    </div>
                    <div style={{ fontSize: 14, color: "#4a7a9b", marginTop: 4 }}> 약 {(() => {
                      const base = pumpCalc.mode === "monitor" ? 0.70 : 0.35;
                      const hoseFactor = pumpCalc.hoseSize === 40 ? 0.05 : 0.015;
                      const val = ((pumpCalc.floor - 1) * 0.03) + (pumpCalc.hose * hoseFactor) + base;
                      return val.toFixed(2);
                    })()} MPa
                    </div>
                  </div>
                  <p style={{ fontSize: 10, color: "#e7f4fc88", lineHeight: 1.6, margin: 0, textAlign: "center" }}> ※ 기준: 층고 3m (0.03MPa/층) <br /> P(압력) = 0.03(H-1) + NL + B <br /> <span style={{ fontSize: 9 }}>(H:층수, N:호스수, L:마찰손실, B:관창압)</span> </p>
                </div>
              </>
            )}

            {/* Targets Tab */}
            {utilityTab === "targets" && (
              <TargetModule
                targets={targets}
                selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget}
                snapshots={snapshots}
                isSavingSnapshot={isSavingSnapshot}
                setInputModal={setInputModal}
                fetchSnapshots={loadSnapshots}
                setShowConfirm={setShowConfirm}
                handleLoadSnapshot={handleLoadSnapshot}
                handleSaveSnapshot={saveSnapshot}
                onManage={onManage}
                centers={centers}
              />
            )}

            {/* Forest Fire Tab */}
            {utilityTab === "forest_fire" && (
              <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 24, border: "1px dashed #22c55e44", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: 64, filter: "drop-shadow(0 0 15px #22c55e66)", animation: "pulse 2s infinite" }}>🌲</div>
                  <div style={{ position: "absolute", bottom: -5, right: -5, fontSize: 24 }}>🚧</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: -0.5 }}>산불진화 전술 모듈</div>
                  <div style={{ fontSize: 14, color: "#22c55e", fontWeight: 700, background: "#22c55e15", padding: "6px 16px", borderRadius: 20, display: "inline-block" }}>준비중입니다.</div>
                </div>
                <p style={{ fontSize: 13, color: "#4a7a9b", lineHeight: 1.6, margin: 0, maxWidth: 240 }}> 지표화/수관화 분석 및 <br /> 실시간 산불 진화 전술 최적화 모듈을 <br /> 개발하고 있습니다. </p>
              </div>
            )}

            {/* MCI Tab */}
            {utilityTab === "mci" && (
              <MciModule
                mciStats={mciStats} setMciStats={setMciStats}
                mciPos={mciPos}
                mciViewMode={mciViewMode} setMciViewMode={setMciViewMode}
                hospitalStats={hospitalStats} setHospitalStats={setHospitalStats}
                mciTransports={mciTransports} setMciTransports={setMciTransports}
                mciTransportLog={mciTransportLog} setMciTransportLog={setMciTransportLog} 
                vehicles={vehicles}
                addLog={addLog}
                setShowConfirm={setShowConfirm}
              />
            )}
          </div>
        </div>
      )}

      {/* 6. Input Modal */}
      {inputModal.show && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000 }}>
          <div style={{ background: "linear-gradient(135deg, #16222e, #0d1f30)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "24px", width: "90%", maxWidth: 360, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8, textAlign: "center" }}>{inputModal.title}</div>
            <div style={{ fontSize: 13, color: "#4a7a9b", marginBottom: 20, textAlign: "center" }}>원하시는 이름을 입력하고 저장해 주세요.</div>
            <input
              autoFocus
              type="text"
              value={inputModal.defaultValue}
              onChange={(e) => setInputModal(p => ({ ...p, defaultValue: e.target.value }))}
              placeholder={inputModal.placeholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  inputModal.onConfirm(inputModal.defaultValue);
                  setInputModal(p => ({ ...p, show: false }));
                }
                if (e.key === 'Escape') setInputModal(p => ({ ...p, show: false }));
              }}
              style={{ width: "100%", background: "#0d1f30", border: "1px solid #1e3a52", borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", marginBottom: 20, boxSizing: "border-box", fontFamily: "'Pretendard', sans-serif" }}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setInputModal(p => ({ ...p, show: false }))} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 12, color: "#7ec8e3", padding: "14px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>취소</button>
              <button onClick={() => { inputModal.onConfirm(inputModal.defaultValue); setInputModal(p => ({ ...p, show: false })); }} style={{ flex: 1, background: `linear-gradient(135deg, ${inputModal.type === 'target' ? '#3b82f6, #1e3a8a' : '#8b5cf6, #4c1d95'})`, border: "none", borderRadius: 12, color: "#fff", padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(59,130,246,0.2)" }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Staging Popup */}
      <StagingPopup
        isOpen={selected === "staging-site"}
        onClose={() => setSelected(null)}
        centers={centers}
        vehicles={vehicles}
      />

      {/* 8. Resource Summary Popup */}
      <ResourceSummaryPopup
        isOpen={showResourceSummary}
        onClose={() => setShowResourceSummary(false)}
        deployed={deployed}
        vehicles={vehicles}
        personnel={personnel}
        centers={centers}
        selectedDistrict={selectedDistrict}
      />
    </>
  );
}
