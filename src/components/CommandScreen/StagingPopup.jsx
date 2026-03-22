import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

// ─── 터치+마우스 드래그 공통 훅 ─────────────────────────────────────
function useDragContext() {
  const [draggingId, setDraggingId] = useState(null);
  const [ghostPos, setGhostPos] = useState(null);
  const [ghostLabel, setGhostLabel] = useState("");
  const dragRef = useRef({ vehicle: null, from: null, _dropZones: [] });

  const startDrag = (vehicle, from, clientX, clientY) => {
    dragRef.current.vehicle = vehicle;
    dragRef.current.from = from;
    setDraggingId(vehicle.id);
    setGhostPos({ x: clientX, y: clientY });
    setGhostLabel(vehicle.name);
  };

  const moveDrag = (clientX, clientY) => {
    setGhostPos({ x: clientX, y: clientY });
  };

  const dropAt = (clientX, clientY) => {
    const zones = dragRef.current._dropZones || [];
    for (const z of zones) {
      if (!z.ref.current) continue;
      const rect = z.ref.current.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        if (z.zoneId !== dragRef.current.from) {
          z.onDrop(dragRef.current.vehicle?.id, dragRef.current.from);
        }
        break;
      }
    }
    dragRef.current.vehicle = null;
    dragRef.current.from = null;
    setDraggingId(null);
    setGhostPos(null);
    setGhostLabel("");
  };

  return { draggingId, ghostPos, ghostLabel, dragRef, startDrag, moveDrag, dropAt };
}

// ─── 차량 배지 컴포넌트 ──────────────────────────────────────────────
function VehicleBadge({ vehicle, isDragging, zone, drag, small }) {
  const handleMouseDown = (e) => {
    e.preventDefault();
    drag.startDrag(vehicle, zone, e.clientX, e.clientY);
    const onMove = (ev) => drag.moveDrag(ev.clientX, ev.clientY);
    const onUp = (ev) => {
      drag.dropAt(ev.clientX, ev.clientY);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    drag.startDrag(vehicle, zone, t.clientX, t.clientY);
    const onMove = (ev) => {
      ev.preventDefault();
      const touch = ev.touches[0];
      drag.moveDrag(touch.clientX, touch.clientY);
    };
    const onEnd = (ev) => {
      const t2 = ev.changedTouches[0];
      drag.dropAt(t2.clientX, t2.clientY);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  const getTextColor = () => {
    if (zone === "staging") return "#4ade80";
    if (zone === "hydrant") return "#3b82f6";
    return "#e0e8f0";
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: small ? "4px 10px" : "6px 14px",
        background: isDragging ? "rgba(74, 222, 128, 0.15)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isDragging ? "#4ade80" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 20, cursor: isDragging ? "grabbing" : "grab",
        fontSize: small ? 12 : 13, color: getTextColor(), fontWeight: 600,
        transition: "all 0.15s", userSelect: "none", whiteSpace: "nowrap",
        opacity: isDragging ? 0.4 : 1, touchAction: "none",
      }}
    >
      <span style={{ pointerEvents: "none" }}>{vehicle.name}</span>
    </div>
  );
}

// ─── 드롭 영역 컴포넌트 ──────────────────────────────────────────────
const DropZone = ({ zoneId, label, vehicles, drag, onDrop, color, icon, flex, minHeight, emptyText, hideHeader }) => {
  const [dragOver, setDragOver] = useState(false);
  const zoneRef = useRef(null);

  // 고스트가 이 존 위에 있는지 실시간 감지
  useEffect(() => {
    if (!drag.ghostPos || !zoneRef.current) { setDragOver(false); return; }
    const rect = zoneRef.current.getBoundingClientRect();
    const over = drag.ghostPos.x >= rect.left && drag.ghostPos.x <= rect.right
               && drag.ghostPos.y >= rect.top && drag.ghostPos.y <= rect.bottom;
    setDragOver(over);
  }, [drag.ghostPos]);

  // 드롭존 등록
  useEffect(() => {
    const entry = { zoneId, ref: zoneRef, onDrop };
    drag.dragRef.current._dropZones.push(entry);
    return () => {
      drag.dragRef.current._dropZones = drag.dragRef.current._dropZones.filter(z => z !== entry);
    };
  }, [zoneId, onDrop]);

  const accentColor = color || "#4ade80";

  return (
    <div
      ref={zoneRef}
      style={{
        flex: flex || 1, minHeight: minHeight || (hideHeader ? 80 : 100),
        background: dragOver ? `${accentColor}12` : "rgba(255,255,255,0.015)",
        border: `1.5px ${dragOver ? "solid" : "dashed"} ${dragOver ? accentColor : "rgba(255,255,255,0.08)"}`,
        borderRadius: 16, padding: "10px 14px", transition: "all 0.15s",
        display: "flex", flexDirection: "column",
      }}
    >
      {!hideHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#fff", letterSpacing: 0.5 }}>{label}</span>
          <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: accentColor, background: `${accentColor}15`, padding: "2px 10px", borderRadius: 10 }}>
            {vehicles.length}대
          </span>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 0, flex: 1, alignContent: "flex-start", overflowY: "auto", overflowX: "hidden" }}>
        {vehicles.length === 0 ? (
          <div style={{ width: "100%", textAlign: "center", padding: "10px 0", color: "#4a7a9b22", fontSize: 12 }}>
            {emptyText || ""}
          </div>
        ) : (
          (zoneId === "pool" || zoneId === "staging") ? (
            // 그룹화 표시 (센터별) - ID 비교를 더 견고하게 (String 변환)
            Array.from(new Set(vehicles.map(v => String(v.center_id || "unclassified")))).map(cid => {
              const centerVehicles = vehicles.filter(v => String(v.center_id || "unclassified") === cid);
              const center = drag.centers?.find(c => String(c.id) === cid);
              return (
                <div key={cid} style={{ width: "100%", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, paddingLeft: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: center?.color || "#7dd3fc" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: center?.color || "#7dd3fc", opacity: 0.8 }}>
                      {center?.name || "미소집 차량"}
</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {centerVehicles.map(v => (
                      <VehicleBadge
                        key={v.id} vehicle={v} zone={zoneId} drag={drag}
                        isDragging={drag.draggingId === v.id} small
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 0" }}>
              {vehicles.map(v => (
                <VehicleBadge
                  key={v.id} vehicle={v} zone={zoneId} drag={drag}
                  isDragging={drag.draggingId === v.id} small
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── 인원 현황 카드 ──────────────────────────────────────────────────
function PersonnelCard({ center, onIncrement, onDecrement }) {
  const arrived = center.count > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      background: arrived ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)",
      border: `1px solid ${arrived ? center.color + "30" : "rgba(255,255,255,0.05)"}`,
      borderRadius: 12, transition: "all 0.2s",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{center.name}</div>
        <div style={{ fontSize: 11, color: "#4a7a9b", marginTop: 2 }}>{arrived ? "집결 완료" : "미도착"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => onDecrement(center.id)} style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 24, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
        <div style={{ width: 40, textAlign: "center", fontSize: 28, fontWeight: 800, color: arrived ? "#60a5fa" : "#4a7a9b44" }}>{center.count || 0}</div>
        <button onClick={() => onIncrement(center.id)} style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 24, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        <span style={{ fontSize: 12, color: "#4a7a9b", marginLeft: 2 }}>명</span>
      </div>
    </div>
  );
}

// ─── 모듈 레벨 저장소 (컴포넌트가 언마운트되어도 앱이 실행되는 동안 유지) ────────────────
let persistentStagingData = null;

export default function StagingPopup({ isOpen, onClose, centers: dbCenters = [], vehicles: dbVehicles = [] }) {
  const [phase, setPhase] = useState("closed");
  const [pool, setPool] = useState(persistentStagingData?.pool || []);
  const [staging, setStaging] = useState(persistentStagingData?.staging || []);
  const [hydrant, setHydrant] = useState(persistentStagingData?.hydrant || []);
  const [centers, setCenters] = useState(persistentStagingData?.centers || []);
  const drag = { ...useDragContext(), centers };
  const hasInitialized = useRef(!!persistentStagingData);

  // 항상 최신 props를 ref에 저장
  const dbCentersRef = useRef(dbCenters);
  const dbVehiclesRef = useRef(dbVehicles);
  useEffect(() => { dbCentersRef.current = dbCenters; }, [dbCenters]);
  useEffect(() => { dbVehiclesRef.current = dbVehicles; }, [dbVehicles]);

  const initializeData = () => {
    const currentCenters = dbCentersRef.current;
    const currentVehicles = dbVehiclesRef.current;

    if (currentCenters.length > 0) {
      setCenters(currentCenters
        .filter(c => !c.name.includes("지휘") && !c.name.includes("소방본부") && !c.name.includes("조사") && !c.name.includes("삼랑진"))
        .map(c => ({ id: c.id, name: c.name.replace("119안전", ""), count: 0, color: c.color_code || "#4ade80" }))
        .sort((a, b) => {
          if (a.name.includes("구조대")) return -1;
          if (b.name.includes("구조대")) return 1;
          if (a.name.includes("삼정")) return -1;
          if (b.name.includes("삼정")) return 1;
          return a.name.localeCompare(b.name);
        }));
    }
    if (currentVehicles.length > 0) {
      setPool(currentVehicles
        .filter(v => {
          const name = v.name || "";
          const type = v.type_name || v.type || "";
          return !name.includes("지휘") && !name.includes("조사") && !type.includes("지휘") && !type.includes("조사");
        })
        .map(v => ({ id: v.id, name: v.name, type: v.type_name || v.type, center_id: v.center_id })));
    }
    setStaging([]);
    setHydrant([]);
  };

  const clearPersistence = () => {
    persistentStagingData = null;
    localStorage.removeItem("staging_data_v2"); // 기존 스토리지도 청소
  };

  // 상태 변경 시 모듈 변수 및 localStorage 업데이트
  useEffect(() => {
    const data = { pool, staging, hydrant, centers };
    persistentStagingData = data;
    
    // 빈 데이터일 때는 저장하지 않음 (초기화 방지)
    if (pool.length > 0 || staging.length > 0 || hydrant.length > 0) {
      localStorage.setItem("staging_data_v2", JSON.stringify(data));
    }
  }, [pool, staging, hydrant, centers]);

  // 자동 데이터 동기화 (기존 배치 유지하며 새로운 센터/차량만 추가)
  useEffect(() => {
    if (!isOpen) return;
    
    // 1. 센터 동기화
    if (dbCenters.length > 0) {
      const filteredCenters = dbCenters
        .filter(c => !c.name.includes("지휘") && !c.name.includes("소방본부") && !c.name.includes("조사") && !c.name.includes("삼랑진"))
        .map(c => ({ id: c.id, name: c.name.replace("119안전", ""), count: 0, color: c.color_code || "#4ade80" }));
      
      setCenters(prev => {
        const newCenters = filteredCenters.filter(nc => !prev.some(pc => pc.id === nc.id));
        if (newCenters.length === 0) return prev;
        const merged = [...prev, ...newCenters];
        return merged.sort((a, b) => {
          if (a.name.includes("구조대")) return -1;
          if (b.name.includes("구조대")) return 1;
          if (a.name.includes("삼정")) return -1;
          if (b.name.includes("삼정")) return 1;
          return a.name.localeCompare(b.name);
        });
      });
    }

    // 2. 차량 동기화
    if (dbVehicles.length > 0) {
      const filteredVehicles = dbVehicles
        .filter(v => {
          const name = v.name || "";
          const type = v.type_name || v.type || "";
          return !name.includes("지휘") && !name.includes("조사") && !type.includes("지휘") && !type.includes("조사");
        })
        .map(v => ({ id: v.id, name: v.name, type: v.type_name || v.type, center_id: v.center_id }));

      setPool(prev => {
        // 이미 어딘가에 배치된 차량인지 확인
        const allCurrentIds = [
          ...prev.map(v => String(v.id)),
          ...staging.map(v => String(v.id)),
          ...hydrant.map(v => String(v.id))
        ];
        const newVehicles = filteredVehicles.filter(nv => !allCurrentIds.includes(String(nv.id)));
        if (newVehicles.length === 0) return prev;
        return [...prev, ...newVehicles];
      });
    }
  }, [dbCenters, dbVehicles, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setPhase("line-up");
      
      // 로딩 시 로컬스토리지에서 복구 시도 (모듈 변수가 비어있을 때만)
      if (!persistentStagingData) {
        const saved = localStorage.getItem("staging_data_v2");
        if (saved) {
          const parsed = JSON.parse(saved);
          setPool(parsed.pool || []);
          setStaging(parsed.staging || []);
          setHydrant(parsed.hydrant || []);
          setCenters(parsed.centers || []);
          persistentStagingData = parsed;
          hasInitialized.current = true;
        }
      }

      // 여전히 데이터가 없으면 초기화 실행
      if (!hasInitialized.current && pool.length === 0 && staging.length === 0 && hydrant.length === 0) {
        initializeData();
        hasInitialized.current = true;
      }
      // 애니메이션 생략: 즉시 보이도록 설정
      setPhase("visible");
    } else {
      setPhase("closed");
    }
  }, [isOpen]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = (e) => {
    if (e) e.stopPropagation();
    setShowResetConfirm(true);
  };

  const moveVehicle = (vehicleId, from, to) => {
    if (!vehicleId || from === to) return;
    const zones = { pool, staging, hydrant };
    const setters = { pool: setPool, staging: setStaging, hydrant: setHydrant };
    const vehicle = zones[from]?.find(v => String(v.id) === String(vehicleId));
    if (!vehicle) return;
    setters[from](prev => prev.filter(v => String(v.id) !== String(vehicleId)));
    setters[to](prev => [...prev, vehicle]);
  };

  const incrementCenter = (id) => setCenters(prev => prev.map(c => c.id === id ? { ...c, count: c.count + 1 } : c));
  const decrementCenter = (id) => setCenters(prev => prev.map(c => c.id === id ? { ...c, count: Math.max(0, c.count - 1) } : c));
  const totalPersonnel = centers.reduce((s, c) => s + c.count, 0);

  if (phase === "closed") return null;
  const s = getStyles(phase);

  return ReactDOM.createPortal(
    <div style={s.overlay} onClick={phase === "visible" ? onClose : undefined}>
      <div style={s.verticalLine} />
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>
        <div style={s.glowBorder} />

        {/* 초기화 확인 팝업 */}
        {showResetConfirm && (
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10000, borderRadius: "inherit"
          }}>
            <div style={{ background: "#0e1925", border: "1px solid #4ade80", borderRadius: 16, padding: "28px 36px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>초기화 하시겠습니까?</div>
              <div style={{ fontSize: 13, color: "#7dd3fc", marginBottom: 24 }}>모든 배치 현황이 초기화됩니다.</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: "10px 0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#7dd3fc", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>취소</button>
                <button onClick={() => { clearPersistence(); initializeData(); setShowResetConfirm(false); }} style={{ flex: 1, padding: "10px 0", background: "rgba(74,222,128,0.1)", border: "1px solid #4ade80", borderRadius: 8, color: "#4ade80", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>초기화</button>
              </div>
            </div>
          </div>
        )}

        {/* 드래그 고스트 */}
        {drag.ghostPos && drag.draggingId && (
          <div style={{
            position: "fixed",
            left: drag.ghostPos.x - 40, top: drag.ghostPos.y - 16,
            background: "rgba(74,222,128,0.2)", border: "1px solid #4ade80",
            borderRadius: 20, padding: "4px 12px",
            fontSize: 12, color: "#4ade80", fontWeight: 700,
            pointerEvents: "none", zIndex: 9999999, whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}>
            {drag.ghostLabel}
          </div>
        )}

        {phase === "visible" && (
          <button onClick={onClose} style={{
            position: "absolute", top: 24, right: 24,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#4ade80", borderRadius: "50%", width: 32, height: 32,
            fontSize: 18, cursor: "pointer", zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        )}

        <div style={s.contentWrap}>
          {/* 헤더 */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
                자원집결지 전술 배치
              </h2>
              <button 
                onClick={(e) => { e.stopPropagation(); handleReset(e); }}
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#4ade80", borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.2s", zIndex: 200, position: "relative",
                }}
                onMouseOver={e => e.currentTarget.style.background = "rgba(74, 222, 128, 0.1)"}
                onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              >
                <span style={{ fontSize: 14 }}>🔄</span> 초기화
              </button>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 12, paddingRight: 64 }}>
              <div style={{ padding: "8px 18px", borderRadius: 12, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", fontSize: 18, fontWeight: 700, color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 130 }}>
                차량 {staging.length + hydrant.length}대
              </div>
              <div style={{ padding: "8px 18px", borderRadius: 12, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)", fontSize: 18, fontWeight: 700, color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 110 }}>
                인원 {totalPersonnel}명
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0, overflow: "hidden" }}>

            {/* 좌측: 미소집 차량 풀 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#7dd3fc", marginBottom: 12 }}>미소집 차량</h3>
              <DropZone
                zoneId="pool" vehicles={pool} drag={drag} hideHeader
                onDrop={(vid, from) => moveVehicle(vid, from, "pool")}
                color="#7ec8e3" emptyText="배치 완료 ✓"
              />
            </div>

            {/* 중앙: 자원집결지 / 소화전 충수 */}
            <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
              <DropZone
                zoneId="staging"
                label="자원집결지"
                vehicles={staging}
                drag={drag}
                onDrop={(vid, from) => moveVehicle(vid, from, "staging")}
                color="#4ade80"
                icon="🚩"
                flex={1.6}
                minHeight={80}
              />
              <DropZone
                label="소화전 충수 중" icon="💧" zoneId="hydrant" vehicles={hydrant} drag={drag}
                onDrop={(vid, from) => moveVehicle(vid, from, "hydrant")} color="#3b82f6"
                flex={0.4} minHeight={100}
              />
            </div>

            {/* 우측: 인원 현황 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#7dd3fc", marginBottom: 12 }}>센터별 인원 현황</h3>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: 10, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, overflowY: "auto" }}>
                {centers.map(c => (
                  <PersonnelCard key={c.id} center={c} onIncrement={() => incrementCenter(c.id)} onDecrement={() => decrementCenter(c.id)} />
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function getStyles(phase) {
  const boxReady = ["expand", "content", "visible"].includes(phase);
  const showContent = ["content", "visible"].includes(phase);
  const isLineUp = phase === "line-up";
  return {
    overlay: {
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 999999,
      background: boxReady ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.4)",
      backdropFilter: boxReady ? "blur(20px)" : "blur(4px)",
      transition: "background 0.3s, backdrop-filter 0.3s",
    },
    verticalLine: {
      position: "absolute", left: "50%", top: "50%",
      transform: "translate(-50%, -50%)",
      width: 2, height: isLineUp ? "min(500px, 80vh)" : 0,
      background: "linear-gradient(to top, transparent, #4ade80, #fff)",
      boxShadow: "0 0 20px #4ade80, 0 0 40px #4ade8088",
      opacity: boxReady ? 0 : 1,
      transition: isLineUp ? "height 0.25s cubic-bezier(0.16, 1, 0.3, 1)" : "opacity 0.2s ease-out, height 0.2s ease-out",
    },
    modalBox: {
      position: "relative",
      width: boxReady ? "min(1100px, 95vw)" : 2,
      height: boxReady ? "min(550px, 90vh)" : 2, minHeight: boxReady ? "min(550px, 85vh)" : 2, maxHeight: "90vh",
      overflow: "hidden",
      background: boxReady ? "#060b13" : "transparent",
      borderRadius: boxReady ? 24 : 0,
      transition: boxReady ? "width 0.4s cubic-bezier(0.16, 1, 0.3, 1), min-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.3s ease" : "none",
      boxShadow: boxReady ? "0 40px 100px rgba(0,0,0,0.9)" : "none",
    },
    glowBorder: {
      position: "absolute", inset: 0, borderRadius: "inherit",
      border: boxReady ? "1px solid rgba(74,222,128,0.2)" : "1px solid #4ade80",
      boxShadow: boxReady ? "inset 0 0 40px rgba(74,222,128,0.02)" : "0 0 30px #4ade80, inset 0 0 30px #4ade80",
      opacity: isLineUp ? 0 : 1,
      transition: "border-color 0.4s, box-shadow 0.6s, opacity 0.3s",
      pointerEvents: "none",
    },
    contentWrap: {
      padding: 18, opacity: showContent ? 1 : 0,
      transform: showContent ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s",
      height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box",
    },
  };
}
