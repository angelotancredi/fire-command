import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function TargetModule({
  targets, setTargets,
  selectedTarget, setSelectedTarget,
  snapshots, setSnapshots,
  isSavingSnapshot, setIsSavingSnapshot,
  inputModal, setInputModal,
  accidentAddress, accidentPos,
  addLog,
  handleDeleteTarget,
  setShowConfirm,
  handleLoadSnapshot,
  handleSaveSnapshot
}) {
  const fetchSnapshots = async (targetId) => {
    const { data } = await supabase.from("tactical_snapshots").select("*").eq("target_id", targetId).order("created_at", { ascending: false });
    if (data) setSnapshots(data);
  };

  // Re-evaluating: Saving/Loading snapshots depends on almost ALL states in CommandScreen.
  // So it's better to keep the handlers in CommandScreen and pass them as props.

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!selectedTarget ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#7ec8e3", fontWeight: 600 }}>🏷️ 저장된 대상물 목록</div>
            <button 
              onClick={async () => {
                const dName = accidentAddress ? accidentAddress.split(' ').slice(-2).join(' ') : "";
                setInputModal({
                  show: true, type: "target", title: "신규 대상물 등록", placeholder: "대상물 이름을 입력하세요", defaultValue: dName,
                  onConfirm: async (name) => {
                    if (name && accidentPos) {
                      const { data } = await supabase.from("target_objects").insert([{
                        name, address: accidentAddress, lat: accidentPos.lat, lng: accidentPos.lng,
                        info: { characteristics: "정보 없음", vulnerabilities: "정보 없음" }
                      }]).select();
                      if (data) {
                        setTargets(prev => [...prev, data[0]]);
                        addLog(`대상물 신규 등록: ${name}`, "info");
                      }
                    }
                  }
                });
              }}
              style={{ background: "#1e3a52", border: "1px solid #2a6a8a", borderRadius: 8, color: "#fff", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
            >+ 신규 등록</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
            {targets.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#4a7a9b" }}>저장된 대상물이 없습니다.</div>}
            {targets.map(t => (
              <div key={t.id} 
                onClick={() => { setSelectedTarget(t); fetchSnapshots(t.id); }}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a52", borderRadius: 12, padding: 14, cursor: "pointer", transition: "0.2s", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "#7ec8e3" }}>{t.address}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteTarget(t.id, t.name); }}
                  style={{ background: "transparent", border: "none", color: "#ff4d4d", fontSize: 18, padding: 8, cursor: "pointer", opacity: 0.6, transition: "0.2s" }}
                  onMouseEnter={el => el.currentTarget.style.opacity = 1}
                  onMouseLeave={el => el.currentTarget.style.opacity = 0.6}
                >🗑️</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <button onClick={() => setSelectedTarget(null)} style={{ background: "transparent", border: "none", color: "#7ec8e3", fontSize: 14, cursor: "pointer", textAlign: "left", paddingLeft: 0 }}>← 목록으로</button>
          
          <div style={{ background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 16, border: "1px solid #8b5cf644" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{selectedTarget.name}</div>
            <div style={{ fontSize: 13, color: "#a0c4d8", marginBottom: 16 }}>{selectedTarget.address}</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#7ec8e3", fontWeight: 600, marginBottom: 4 }}>🏢 대상물 특성</div>
                <div style={{ fontSize: 13, color: "#fff", background: "rgba(0,0,0,0.2)", padding: 10, borderRadius: 8 }}>{selectedTarget.info?.characteristics || "정보 없음"}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#ff7050", fontWeight: 600, marginBottom: 4 }}>⚠️ 취약점 및 위험요소</div>
                <div style={{ fontSize: 13, color: "#fff", background: "rgba(0,0,0,0.2)", padding: 10, borderRadius: 8 }}>{selectedTarget.info?.vulnerabilities || "정보 없음"}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>📸 전술 스냅샷</div>
              <button 
                disabled={isSavingSnapshot}
                onClick={() => {
                  setInputModal({
                    show: true, type: "snapshot", title: "전술 스냅샷 저장", placeholder: "스냅샷 이름을 입력하세요 (예: 초기 출동 배치)", defaultValue: "",
                    onConfirm: (name) => { if (name) handleSaveSnapshot(selectedTarget.id, name); }
                  });
                }}
                style={{ background: "linear-gradient(135deg, #8b5cf6, #4c1d95)", border: "none", borderRadius: 8, color: "#fff", padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >+ 현재 배치 저장</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
              {snapshots.length === 0 && <div style={{ textAlign: "center", padding: 10, color: "#4a7a9b", fontSize: 12 }}>저장된 스냅샷이 없습니다.</div>}
              {snapshots.map(s => (
                <div key={s.id} style={{ background: "#0d1f30", border: "1px solid #1e3a52", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#4a7a9b" }}>{new Date(s.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button 
                      onClick={() => handleLoadSnapshot(s)}
                      style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#7ec8e3", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >불러오기</button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowConfirm({ type: "snapshot-delete", id: s.id, name: s.name, targetId: selectedTarget.id }); }}
                      style={{ background: "rgba(255,69,0,0.1)", border: "1px solid #ff450033", borderRadius: 6, color: "#ff7050", padding: "6px 10px", fontSize: 12, cursor: "pointer", transition: "0.2s" }}
                      onMouseEnter={el => { el.currentTarget.style.background = "rgba(255,69,0,0.2)"; el.currentTarget.style.borderColor = "#ff450066"; }}
                      onMouseLeave={el => { el.currentTarget.style.background = "rgba(255,69,0,0.1)"; el.currentTarget.style.borderColor = "#ff450033"; }}
                      title="삭제"
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
