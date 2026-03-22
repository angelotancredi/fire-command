import React from 'react';
import { HOSPITALS, SEVERITIES, TRANSPORT_STATUSES, getDistance } from '../../constants';

export default function MciModule({
  mciStats, setMciStats,
  mciPos,
  mciViewMode, setMciViewMode,
  hospitalStats, setHospitalStats,
  mciTransports, setMciTransports,
  mciTransportLog, setMciTransportLog,
  vehicles,
  addLog,
  setShowConfirm
}) {
  return (
    <div style={{ position: "relative", width: "100%", overflow: "hidden", minHeight: 460 }}>
      <div style={{
        display: "flex",
        width: "100%",
        gap: 0,
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        {/* (1) 왼쪽: 현장 환자 현황 (300px) */}
        <div style={{ width: 300, paddingRight: 16, display: "flex", flexDirection: "column", gap: 10, borderRight: mciViewMode === "hospital" ? "1px solid #1e3a52" : "none", flexShrink: 0 }}>
          {/* 타이틀 행 — 다른 패널과 높이 맞춤 */}
          <div style={{ fontSize: 13, color: "#7ec8e3", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", height: 28 }}>
            <span>🏷️ 중증도별 환자 현황</span>
            <button
              onClick={() => setMciViewMode("hospital")}
              style={{
                background: "linear-gradient(135deg, #ff4500, #ff8c00)",
                border: "none", borderRadius: 8, color: "#fff",
                padding: "6px 12px", fontSize: 12, fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(255,69,0,0.3)",
                visibility: mciViewMode === "main" ? "visible" : "hidden",
                pointerEvents: mciViewMode === "main" ? "auto" : "none"
              }}
            >이송 현황판 열기 ➔</button>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: 16, border: "1px solid #1e3a52" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SEVERITIES.map(item => (
                <div key={item.key} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "10px", border: `1px solid ${item.color}44` }}>
                  <div style={{ fontSize: 12, color: item.color, fontWeight: 600, marginBottom: 6 }}>{item.label}({item.key.charAt(0).toUpperCase() + item.key.slice(1)})</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button onClick={() => setMciStats(prev => ({ ...prev, [item.key]: Math.max(0, prev[item.key] - 1) }))} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "#1a2a3a", color: "#fff", cursor: "pointer" }}>-</button>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{mciStats[item.key]}</span>
                    <button onClick={() => setMciStats(prev => ({ ...prev, [item.key]: prev[item.key] + 1 }))} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "#1a2a3a", color: "#fff", cursor: "pointer" }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 총 사상자 — 버튼 없애고 크게 */}
          <div style={{ background: "linear-gradient(135deg, #ff450018, #ff700010)", border: "1px solid #ff450044", borderRadius: 16, padding: "20px 16px", textAlign: "center", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 18, color: "#ff7050", fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>총 사상자</div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 64, fontWeight: 900, color: "#fff", lineHeight: 1, textShadow: "0 0 24px rgba(255,100,50,0.5)" }}>
                {mciStats.red + mciStats.yellow + mciStats.green + mciStats.black}
              </span>
              <span style={{ fontSize: 24, color: "#ff9070", fontWeight: 700 }}>명</span>
            </div>
          </div>
        </div>

        {/* (2) 중앙: 병원별 이송 현황 (330px) */}
        <div style={{ width: 330, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto", opacity: mciViewMode === "hospital" ? 1 : 0, transition: "opacity 0.3s", flexShrink: 0, visibility: mciViewMode === "hospital" ? "visible" : "hidden", borderRight: "1px solid #1e3a52", paddingRight: 14 }}>
          <div style={{ fontSize: 13, color: "#7ec8e3", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🏥 병원별 이송 현황 (거리순)</span>
            <button
              onClick={() => setMciViewMode("main")}
              style={{ background: "#1a2a3a", border: "1px solid #1e3a52", borderRadius: 6, color: "#7ec8e3", cursor: "pointer", fontSize: 11, padding: "4px 8px" }}
            >닫기 ✕</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {HOSPITALS
              .map(h => ({
                ...h,
                dist: mciPos ? getDistance(mciPos.lat, mciPos.lng, h.lat, h.lng) : 0
              }))
              .sort((a, b) => a.dist - b.dist)
              .map(h => (
                <div key={h.name} style={{ background: "#0d1f30", border: "1px solid #1e3a52", borderRadius: 12, padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, color: "#fff" }}>{h.name}</span>
                    <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 600 }}>{h.dist.toFixed(1)}km</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {SEVERITIES.map(s => {
                      const type = s.key;
                      return (
                        <div key={type} style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 4px" }}>
                          <div style={{ fontSize: 12, color: s.color, marginBottom: 6, fontWeight: 700 }}>{s.label}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                            <button
                              onClick={() => setHospitalStats(prev => ({
                                ...prev,
                                [h.name]: { ...prev[h.name], [type]: prev[h.name][type] + 1 }
                              }))}
                              style={{ width: "100%", height: 32, background: "#1a2a3a", border: "1px solid #1e3a52", borderRadius: 6, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
                            >+</button>
                            <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: "4px 0" }}>{hospitalStats[h.name][type]}</span>
                            <button
                              onClick={() => setHospitalStats(prev => ({
                                ...prev,
                                [h.name]: { ...prev[h.name], [type]: Math.max(0, prev[h.name][type] - 1) }
                              }))}
                              style={{ width: "100%", height: 32, background: "#1a2a3a", border: "1px solid #1e3a52", borderRadius: 6, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
                            >-</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* (3) 구급차 이동 현황 (280px) */}
        <div style={{ width: 280, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto", overflowX: "visible", opacity: mciViewMode === "hospital" ? 1 : 0, transition: "opacity 0.3s", flexShrink: 0, visibility: mciViewMode === "hospital" ? "visible" : "hidden", borderRight: "1px solid #1e3a52", paddingRight: 14 }}>
          <div style={{ fontSize: 13, color: "#7ec8e3", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", height: 28 }}>
            <span>🚑 구급차 이동 현황</span>
            <button
              onClick={() => setMciTransports(prev => [...prev, { id: Date.now(), amb: "", hosp: "", sev: "", cnt: 1, stat: "이동 현황", pop: null }])}
              style={{ background: "#4a7a9b33", border: "1px solid #4a7a9b88", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, padding: "4px 8px", fontWeight: 600 }}
            >+ 이송 추가</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7, overflow: "visible" }}>
            {mciTransports.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#4a7a9b88", fontSize: 12 }}>등록된 이송 현황이 없습니다.</div>
            )}
            {mciTransports.map((t) => {
              const openPop = (type) => setMciTransports(pts => pts.map(pt => pt.id === t.id ? { ...pt, pop: pt.pop === type ? null : type } : { ...pt, pop: null }));
              const updateT = (data) => {
                const next = { ...t, ...data };
                setMciTransports(pts => pts.map(pt => pt.id === t.id ? { ...pt, ...data, pop: null } : pt));
                if (data.stat === "병원 도착" && next.hosp && next.sev) {
                  setHospitalStats(prev => ({
                    ...prev,
                    [next.hosp]: { ...prev[next.hosp], [next.sev]: (prev[next.hosp]?.[next.sev] ?? 0) + (next.cnt ?? 1) }
                  }));
                }
                if (data.stat) {
                  const sevInfo2 = SEVERITIES.find(s => s.key === next.sev);
                  setMciTransportLog(prev => [{
                    id: Date.now(),
                    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                    amb: next.amb || "미지정", hosp: next.hosp || "미지정",
                    sev: sevInfo2?.label || "-", sevColor: sevInfo2?.color || "#888",
                    cnt: next.cnt ?? 1, stat: data.stat
                  }, ...prev]);
                  addLog(`${next.amb || '구급차'} → ${next.hosp || '병원'} (${sevInfo2?.label || '-'} ${next.cnt ?? 1}명) ${data.stat}`, "info");
                }
              };
              const sevInfo = SEVERITIES.find(s => s.key === t.sev);
              const cell = { padding: "6px 5px", borderRadius: 7, border: "1px solid #2a6a8a", background: "#1a2a3a", fontSize: 11, fontWeight: 500, cursor: "pointer", textAlign: "center", color: "#4a7a9b", userSelect: "none" };

              return (
                <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a52", borderRadius: 12, padding: "10px", position: "relative", overflow: "visible" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", alignItems: "center", gap: 6, marginBottom: 7 }}>
                    <div onClick={() => openPop('amb')} style={{ ...cell, color: t.amb ? "#fff" : "#4a7a9b" }}>{t.amb || "구급차 선택"}</div>
                    <span style={{ color: "#4a7a9b", fontSize: 10 }}>➔</span>
                    <div onClick={() => openPop('hosp')} style={{ ...cell, color: t.hosp ? "#fff" : "#4a7a9b" }}>{t.hosp || "병원 선택"}</div>
                    <button onClick={() => setMciTransports(pts => pts.filter(pt => pt.id !== t.id))} style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontSize: 16, padding: "0 2px" }}>×</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6 }}>
                    <div onClick={() => openPop('sev')} style={{ ...cell, background: sevInfo ? `${sevInfo.color}22` : "#1a2a3a", border: `1px solid ${sevInfo ? sevInfo.color : '#2a6a8a'}`, color: sevInfo ? sevInfo.color : "#4a7a9b" }}>
                      {sevInfo ? sevInfo.label : "중증도 선택"}
                    </div>
                    <div onClick={() => openPop('cnt')} style={{ ...cell, border: "1px solid #2a6a8a", color: "#fff", fontWeight: 600, minWidth: 42 }}>
                      {t.cnt ?? 1}명
                    </div>
                    <div onClick={() => openPop('stat')} style={{ ...cell, background: "linear-gradient(135deg,#1e3a52,#112233)", border: "1px solid #009dff55", color: "#7ec8e3" }}>
                      {t.stat}
                    </div>
                  </div>
                  {t.pop && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", width: "90%", zIndex: 200, background: "rgba(8,18,28,0.98)", backdropFilter: "blur(10px)", borderRadius: 10, padding: "10px 8px", border: "1px solid #009dff", boxShadow: "0 12px 32px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ fontSize: 11, color: "#009dff", fontWeight: 500, textAlign: "center", marginBottom: 4 }}>
                        {t.pop === 'amb' ? "🚑 구급차 선택" : t.pop === 'hosp' ? "🏥 이송 병원" : t.pop === 'sev' ? "🏷️ 중증도" : t.pop === 'cnt' ? "👤 이송 인원" : "⚙️ 이송 상태"}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                        {t.pop === 'amb' && vehicles.filter(v => v.type === 'ambulance' && !mciTransports.some(pt => pt.id !== t.id && pt.amb === v.name)).map(v => (
                          <button key={v.id} onClick={() => updateT({ amb: v.name })} style={{ padding: "9px 8px", background: "#1a2a3a", border: "1px solid #1e3a52", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>{v.name}</button>
                        ))}
                        {t.pop === 'hosp' && HOSPITALS.map(h => (
                          <button key={h.name} onClick={() => updateT({ hosp: h.name })} style={{ padding: "9px 8px", background: "#1a2a3a", border: "1px solid #1e3a52", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>{h.name}</button>
                        ))}
                        {t.pop === 'sev' && SEVERITIES.map(s => (
                          <button key={s.key} onClick={() => updateT({ sev: s.key })} style={{ padding: "9px 8px", background: `${s.color}15`, border: `1px solid ${s.color}44`, borderRadius: 7, color: s.color, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{s.label}</button>
                        ))}
                        {t.pop === 'cnt' && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <button key={n} onClick={() => updateT({ cnt: n })} style={{ padding: "9px 8px", background: (t.cnt ?? 1) === n ? "#1e3a52" : "#1a2a3a", border: `1px solid ${(t.cnt ?? 1) === n ? '#009dff' : '#1e3a52'}`, borderRadius: 7, color: (t.cnt ?? 1) === n ? "#009dff" : "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{n}명</button>
                        ))}
                        {t.pop === 'stat' && TRANSPORT_STATUSES.map(st => (
                          <button key={st} onClick={() => updateT({ stat: st })} style={{ padding: "9px 8px", background: "#1a2a3a", border: "1px solid #1e3a52", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{st}</button>
                        ))}
                      </div>
                      <button onClick={() => openPop(null)} style={{ marginTop: 4, padding: "5px", background: "#009dff15", border: "1px solid #009dff44", borderRadius: 7, color: "#009dff", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>닫기</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* (4) 이동 로그 (270px) */}
        <div style={{ width: 270, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 10, opacity: mciViewMode === "hospital" ? 1 : 0, transition: "opacity 0.3s", flexShrink: 0, visibility: mciViewMode === "hospital" ? "visible" : "hidden" }}>
          <div style={{ fontSize: 13, color: "#7ec8e3", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", height: 28 }}>
            <span>📋 이동 로그</span>
            <div style={{ display: "flex", gap: 5 }}>
              <button
                onClick={() => {
                  const lines = mciTransportLog.map(l => `[${l.time}] ${l.amb} → ${l.hosp} | ${l.sev} ${l.cnt}명 | ${l.stat}`).join("\n");
                  const blob = new Blob([`이동 로그 (${new Date().toLocaleDateString("ko-KR")})\n${"─".repeat(40)}\n` + lines], { type: "text/plain;charset=utf-8" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                  a.download = `이동로그_${new Date().toLocaleDateString("ko-KR").replace(/\.\s*/g, "")}.txt`;
                  a.click();
                  addLog("이동 로그 저장 완료", "info");
                }}
                style={{ background: "#009dff22", border: "1px solid #009dff55", borderRadius: 6, color: "#009dff", cursor: "pointer", fontSize: 11, padding: "4px 8px", fontWeight: 600 }}
              >💾 저장</button>
              <button
                onClick={() => setShowConfirm({ type: "log-clear", name: "이동 로그" })}
                style={{ background: "#ff450018", border: "1px solid #ff450055", borderRadius: 6, color: "#ff7050", cursor: "pointer", fontSize: 11, padding: "4px 8px", fontWeight: 600 }}
              >🗑️ 초기화</button>
            </div>
          </div>

          <div style={{ flex: 1, maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
            {mciTransportLog.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: "#4a7a9b44", fontSize: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📋</div>
                이동 기록이 없습니다
              </div>
            ) : mciTransportLog.map(l => (
              <div key={l.id} style={{ background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${l.stat === "병원 도착" ? "#4ade80" : l.stat === "복귀 중" ? "#7ec8e3" : "#ffcc00"}`, border: `1px solid ${l.stat === "병원 도착" ? "#4ade8033" : l.stat === "복귀 중" ? "#7ec8e333" : "#ffcc0033"}`, borderRadius: "0 10px 10px 0", padding: "8px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#4a7a9b88", fontFamily: "monospace" }}>{l.time}</span>
                  <span style={{ fontSize: 10, color: l.stat === "병원 도착" ? "#4ade80" : l.stat === "복귀 중" ? "#7ec8e3" : "#ffcc00", fontWeight: 600 }}>{l.stat}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{l.amb}</span>
                  <span style={{ fontSize: 9, color: "#4a7a9b" }}>➔</span>
                  <span style={{ fontSize: 12, color: "#7ec8e3" }}>{l.hosp}</span>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <span style={{ fontSize: 10, color: l.sevColor, background: `${l.sevColor}18`, border: `1px solid ${l.sevColor}44`, borderRadius: 5, padding: "2px 6px", fontWeight: 600 }}>{l.sev}</span>
                  <span style={{ fontSize: 10, color: "#ccc", background: "#1a2a3a", border: "1px solid #2a6a8a", borderRadius: 5, padding: "2px 6px" }}>{l.cnt}명</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
