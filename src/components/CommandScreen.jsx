import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { VEHICLE_ICONS, VEHICLE_LABELS, HOSPITALS } from "../constants";
import KakaoMap from "./KakaoMap";
import StatusBar from "./CommandScreen/StatusBar.jsx";
import useTargetSnapshots from "./CommandScreen/useTargetSnapshots.js";
import useMapViewport from "./CommandScreen/useMapViewport.js";
import useDeploymentSummary from "./CommandScreen/useDeploymentSummary.js";
import useSortedCenters from "./CommandScreen/useSortedCenters.js";
import { exportLogsAsCsv } from "./CommandScreen/logExport.js";
import Sidebar from "./CommandScreen/Sidebar.jsx";
import MapControls from "./CommandScreen/MapControls.jsx";
import ModalsContainer from "./CommandScreen/ModalsContainer.jsx";
import useHydrantSystem from "./CommandScreen/useHydrantSystem";
import useIncidentMarkers from "./CommandScreen/useIncidentMarkers";
import useHoseLines from "./CommandScreen/useHoseLines";
import useDragHandler from "./CommandScreen/useDragHandler";
import useVehicleMarkers from "./CommandScreen/useVehicleMarkers";
import useCommandState from "./CommandScreen/useCommandState";

const UTILITY_MENU_ITEMS = [
  { key: "staging", label: "자원집결지", desc: "출동 자원의 효율적 관리", icon: <img src="/icons/fire-point.svg" alt="자원집결지" style={{ width: 28, height: 28 }} />, color: "#8b5cf6", gradient: "linear-gradient(135deg, #4c1d95, #8b5cf6)" },
  { key: "mci", label: "다수사상자 대응 (MCI)", desc: "임시의료소 설치 / 실시간 환자 관리", icon: <img src="/icons/hospital.svg" alt="임시의료소" style={{ width: 28, height: 28 }} />, color: "#f97316", gradient: "linear-gradient(135deg, #9a3412, #f97316)" },
  { key: "calc", label: "방수압력 계산기", desc: "고층화재 층수/호스별 최적 압력", icon: "🧮", color: "#3b82f6", gradient: "linear-gradient(135deg, #1e3a8a, #3b82f6)" },
  { key: "forest_fire", label: "산불진화", desc: "지표화/수관화 분석 및 진화 전술", icon: "🌲", color: "#22c55e", gradient: "linear-gradient(135deg, #166534, #22c55e)" },
];

export default function CommandScreen({
  centers, personnel, vehicles, selectedDistrict, onManage, onGlobalReset,
  deployed, setDeployed,
  logs, setLogs,
  accidentPos, setAccidentPos,
  accidentAddress, setAccidentAddress,
  isAccidentLocked, setIsAccidentLocked,
  hoseLinks, setHoseLinks,
  waterSprayLinks, setWaterSprayLinks,
  time, addLog,
  selected, setSelected,
  activeTab, setSideTab,
  expandedCenters, setExpandedCenters,
  isLight
}) {
  const sortedCentersFromHook = useSortedCenters({ centers, selectedDistrict });

  const s = useCommandState({
    selectedDistrict,
    accidentPos, setAccidentPos,
    setAccidentAddress,
    isAccidentLocked, setIsAccidentLocked,
    hoseLinks, setHoseLinks,
    waterSprayLinks, setWaterSprayLinks,
    deployed, setDeployed,
    setLogs,
    setSelected,
    addLog,
    sortedCentersFromHook,
    setExpandedCenters,
    applySnapshotData: (snapshot) => {},  // 임시: useTargetSnapshots 연결 후 교체
  });

  const {
    targets, setTargets,
    selectedTarget, setSelectedTarget,
    snapshots, setSnapshots,
    isSavingSnapshot, setIsSavingSnapshot,
    fetchSnapshots: loadSnapshots,
    handleSaveSnapshot: saveSnapshot,
    actualDeleteSnapshot: deleteSnapshotRecord,
    actualDeleteTarget: deleteTargetRecord,
    handleLoadSnapshot: applySnapshotData
  } = useTargetSnapshots({
    deployed, hoseLinks, waterSprayLinks, accidentPos, accidentAddress,
    hydrantVisible: s.hydrantVisible, hydrantRadius: s.hydrantRadius,
    hydrantCaptureLinks: s.hydrantCaptureLinks,
    mciPos: s.mciPos, isMciLocked: s.isMciLocked,
    stagingPos: s.stagingPos, isStagingLocked: s.isStagingLocked,
    siameseLinks: s.siameseLinks, yCouplingPositions: s.yCouplingPositions,
    setDeployed, setHoseLinks, setWaterSprayLinks, setAccidentPos, setAccidentAddress,
    setHydrantVisible: s.setHydrantVisible, setHydrantCaptureLinks: s.setHydrantCaptureLinks,
    setMciPos: s.setMciPos, setIsMciLocked: s.setIsMciLocked,
    setStagingPos: s.setStagingPos, setIsStagingLocked: s.setIsStagingLocked,
    setSiameseLinks: s.setSiameseLinks, setYCouplingPositions: s.setYCouplingPositions,
    addLog
  });

  // handleLoadSnapshot: applySnapshotData(snapshot) + 지도 포커스
  const handleLoadSnapshot = (snapshot) => {
    applySnapshotData(snapshot);
    s.handleLoadSnapshot(snapshot);  // focusAccidentOnMap 호출
  };

  useEffect(() => {
    if (s.showUtilityModal && s.utilityTab === "targets") {
      setSelectedTarget(null);
    }
  }, [s.showUtilityModal, s.utilityTab]);

  const { mapSize, mapZoom } = useMapViewport({
    kakaoMap: s.kakaoMap,
    mapRef: s.mapRef,
    windowKakao: window.kakao
  });

  const { hydrantMarkersRef, hydrantLinesRef, hydrantPreviewLineRef } = useHydrantSystem({
    kakaoMap: s.kakaoMap,
    hydrantVisible: s.hydrantVisible,
    hydrantRadius: s.hydrantRadius,
    accidentPos,
    hydrantCaptureLinks: s.hydrantCaptureLinks,
    deployed, mapZoom,
    dragPos: s.dragPos,
    mapRef: s.mapRef,
    hydrantDragSource: s.hydrantDragSource,
    mapSize
  });

  const { deployedIds, vehicleDeployedIds, vehicleDeployedIdSet, personnelDeployedCount, vehicleDeployedCount } = useDeploymentSummary({ deployed, personnel });

  const { fireMarkerRef, mciMarkerRef, stagingMarkerRef } = useIncidentMarkers({
    kakaoMap: s.kakaoMap,
    accidentPos, setAccidentPos, isAccidentLocked, setAccidentAddress,
    mciPos: s.mciPos, setMciPos: s.setMciPos,
    mciSetupStarted: s.mciSetupStarted, isMciLocked: s.isMciLocked,
    setMciFromBadge: s.setMciFromBadge,
    setShowUtilityModal: s.setShowUtilityModal, setUtilityTab: s.setUtilityTab,
    stagingPos: s.stagingPos, setStagingPos: s.setStagingPos,
    stagingSetupStarted: s.stagingSetupStarted, isStagingLocked: s.isStagingLocked,
    setSelected
  });

  const { hoseLinesRef, waterSprayRef } = useHoseLines({
    kakaoMap: s.kakaoMap, hoseLinks, deployed,
    hoseDragSource: s.hoseDragSource, dragging: s.dragging, dragPos: s.dragPos,
    mapZoom, mapSize, yCouplingPositions: s.yCouplingPositions,
    personnel, siameseLinks: s.siameseLinks,
    waterSprayLinks, accidentPos,
    setShowConfirm: s.setShowConfirm, mapRef: s.mapRef
  });

  useDragHandler({
    kakaoMap: s.kakaoMap, mapRef: s.mapRef,
    dragging: s.dragging, setDragging: s.setDragging,
    dragPos: s.dragPos, setDragPos: s.setDragPos,
    hoseDragSource: s.hoseDragSource, setHoseDragSource: s.setHoseDragSource,
    hydrantDragSource: s.hydrantDragSource, setHydrantDragSource: s.setHydrantDragSource,
    hoseDragOriginRef: s.hoseDragOriginRef,
    dragPayloadRef: s.dragPayloadRef, dragStartPosRef: s.dragStartPosRef, dragOffsetRef: s.dragOffsetRef,
    yCouplingOverlayRef: s.yCouplingOverlayRef,
    yCouplingDragPosRef: s.yCouplingDragPosRef,
    yCouplingIsDraggingRef: s.yCouplingIsDraggingRef,
    yCouplingLastClientPosRef: s.yCouplingLastClientPosRef,
    deployed, setDeployed,
    personnel, vehicles,
    accidentPos, hydrantRadius: s.hydrantRadius,
    siameseLinks: s.siameseLinks, setSiameseLinks: s.setSiameseLinks,
    hoseLinks, setHoseLinks,
    setHydrantCaptureLinks: s.setHydrantCaptureLinks,
    setWaterSprayLinks,
    setYCouplingPositions: s.setYCouplingPositions,
    setSelected, setShowConfirm: s.setShowConfirm,
    addLog, saveDeployment: s.saveDeployment, removeDeploymentRecord, supabase
  });

  useVehicleMarkers({
    kakaoMap: s.kakaoMap, deployed, selected, mapZoom, centers, personnel, vehicles,
    waterSprayLinks, hoseLinks, hydrantCaptureLinks: s.hydrantCaptureLinks,
    siameseLinks: s.siameseLinks, yCouplingPositions: s.yCouplingPositions, accidentPos,
    overlaysRef: s.overlaysRef, yCouplingOverlayRef: s.yCouplingOverlayRef,
    dragPayloadRef: s.dragPayloadRef, dragStartPosRef: s.dragStartPosRef, dragOffsetRef: s.dragOffsetRef,
    yCouplingDragPosRef: s.yCouplingDragPosRef,
    yCouplingLastClientPosRef: s.yCouplingLastClientPosRef,
    mapRef: s.mapRef,
    setSelected, setShowConfirm: s.setShowConfirm,
    setShowWaterAdjust: s.setShowWaterAdjust,
    setWaterSprayLinks, setHoseDragSource: s.setHoseDragSource,
    setHydrantDragSource: s.setHydrantDragSource,
    setDragPos: s.setDragPos, setSiameseLinks: s.setSiameseLinks, setHoseLinks,
    hoseDragOriginRef: s.hoseDragOriginRef, addLog
  });

  return (
    <div style={{ width: "100%", height: "100vh", background: "#060d18", display: "flex", flexDirection: "column", fontFamily: "'Pretendard', sans-serif", color: "#e8eef5", overflow: "hidden" }}>
      <StatusBar
        isLight={isLight}
        selectedDistrict={selectedDistrict}
        isAccidentLocked={isAccidentLocked}
        setIsAccidentLocked={setIsAccidentLocked}
        accidentPos={accidentPos}
        time={time}
        onManage={onManage}
        setShowResourceSummary={s.setShowResourceSummary}
        setShowGlobalResetInit={s.setShowGlobalResetInit}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{
          width: 250, background: "#0a1420", borderRight: "1px solid #1e3a52",
          display: "flex", flexDirection: "column", flexShrink: 0,
          filter: isLight ? "invert(1) hue-rotate(180deg)" : "none"
        }}>
          <div
            onClick={() => s.setShowResourceSummary(true)}
            style={{ padding: "16px 20px", borderBottom: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "background 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#1a2a3a"}
            onMouseLeave={e => e.currentTarget.style.background = "#0e1925"}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#7ec8e3", letterSpacing: 1 }}>🏢 현장 투입</div>
            <div style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 500 }}>
              차량: <span style={{ color: "#60a5fa" }}>{vehicleDeployedCount}대</span>, 대원: <span style={{ color: "#4ade80" }}>{personnelDeployedCount}명</span>
            </div>
          </div>
          <div onClick={() => s.setShowResourceSummary(true)} style={{ flex: 1, overflowY: "auto", padding: "12px", cursor: "pointer" }}>
            {sortedCentersFromHook.map(c => {
              const deployedUnits = Object.values(deployed).filter(d => d.center_id === c.id);
              const vCount = deployedUnits.filter(d => d.itemType === "vehicle").length;
              const pSet = new Set();
              deployedUnits.forEach(d => { if (d.itemType === "personnel") pSet.add(d.id); });
              const deployedVehicleIds = deployedUnits.filter(d => d.itemType === "vehicle").map(d => d.id);
              personnel.forEach(p => { if (deployedVehicleIds.includes(p.vehicle_id)) pSet.add(p.id); });
              const pCount = pSet.size;
              if (pCount === 0 && vCount === 0) return null;
              return (
                <div key={c.id} style={{ marginBottom: 16, background: "#0d1f30", border: `1px solid ${c.color}44`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: `${c.color}15`, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.name}{selectedDistrict?.jurisdictional === c.name && " [관할]"}</div>
                  </div>
                  <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 500 }}>
                    <div style={{ color: "#4a7a9b" }}>차량: <span style={{ color: "#60a5fa" }}>{vCount}대</span></div>
                    <div style={{ width: 1, height: 10, background: "#1e3a52" }} />
                    <div style={{ color: "#4a7a9b" }}>대원: <span style={{ color: "#4ade80" }}>{pCount}명</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "16px 20px", borderTop: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ff6030" }}>📜 활동 기록</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => s.setShowResetConfirm(true)} style={{ background: "#3a1a1a", border: "1px solid #ff450066", borderRadius: 4, color: "#ff7050", padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>초기화</button>
              <button onClick={() => exportLogsAsCsv(logs)} style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 4, color: "#7ec8e3", padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>저장</button>
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

        <div ref={s.mapRef} style={{ flex: 1, position: "relative", background: "#060d18", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {selectedDistrict && <KakaoMap key={selectedDistrict.name} center={selectedDistrict.center} onMapReady={s.setKakaoMap} />}
          </div>

          {selectedDistrict && (
            <div style={{
              position: "absolute", top: 12, right: 62, height: 44, zIndex: 10010,
              display: "flex", alignItems: "stretch",
              background: "linear-gradient(135deg, #1e3a52, #0f1a2a)",
              border: "1px solid #1e3a52", borderRadius: 12, overflow: "hidden",
              boxSizing: "border-box", boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
              filter: isLight ? "invert(1) hue-rotate(180deg)" : "none"
            }}>
              <button onClick={() => s.setMapType("ROADMAP")} style={{ padding: "0 14px", border: "none", background: s.mapTypeId === "ROADMAP" ? "#1e3a52" : "transparent", color: s.mapTypeId === "ROADMAP" ? "#fff" : "#4a7a9b", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>지도</button>
              <div style={{ width: 1, background: "#1e3a52" }} />
              <button onClick={() => s.setMapType("HYBRID")} style={{ padding: "0 14px", border: "none", background: s.mapTypeId === "HYBRID" ? "#1e3a52" : "transparent", color: s.mapTypeId === "HYBRID" ? "#fff" : "#4a7a9b", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>위성</button>
            </div>
          )}
          {selectedDistrict && (
            <MapControls
              isAccidentLocked={isAccidentLocked}
              setIsAccidentLocked={setIsAccidentLocked}
              mciSetupStarted={s.mciSetupStarted}
              isMciLocked={s.isMciLocked}
              setIsMciLocked={s.setIsMciLocked}
              addLog={addLog}
              setMciSetupStarted={s.setMciSetupStarted}
              setMciPos={s.setMciPos}
              stagingSetupStarted={s.stagingSetupStarted}
              isStagingLocked={s.isStagingLocked}
              setIsStagingLocked={s.setIsStagingLocked}
              setStagingSetupStarted={s.setStagingSetupStarted}
              setStagingPos={s.setStagingPos}
              selectedDistrict={selectedDistrict}
              mciStats={s.mciStats}
              setShowConfirm={s.setShowConfirm}
              dragging={s.dragging}
              dragPos={s.dragPos}
              dragOffsetRef={s.dragOffsetRef}
              mapRef={s.mapRef}
              setSelectedTarget={setSelectedTarget}
              setShowUtilityModal={s.setShowUtilityModal}
              setUtilityTab={s.setUtilityTab}
              setMciFromBadge={s.setMciFromBadge}
              accidentPos={accidentPos}
              siameseLinks={s.siameseLinks}
              setSiameseLinks={s.setSiameseLinks}
              moveToMyLocation={s.moveToMyLocation}
              showHydrantRadiusPicker={s.showHydrantRadiusPicker}
              setHydrantRadius={s.setHydrantRadius}
              setHydrantVisible={s.setHydrantVisible}
              setShowHydrantRadiusPicker={s.setShowHydrantRadiusPicker}
              hydrantVisible={s.hydrantVisible}
              hydrantMarkersRef={hydrantMarkersRef}
              hydrantRadius={s.hydrantRadius}
              isLight={isLight}
              HOSPITALS={HOSPITALS}
              centers={centers}
              vehicles={vehicles}
              personnel={personnel}
            />
          )}
        </div>

        <Sidebar
          isLight={isLight}
          isSidebarOpen={s.isSidebarOpen}
          setIsSidebarOpen={s.setIsSidebarOpen}
          activeTab={activeTab}
          setSideTab={setSideTab}
          sortedCenters={sortedCentersFromHook}
          personnel={personnel}
          vehicles={vehicles}
          deployedIds={deployedIds}
          expandedCenters={expandedCenters}
          setExpandedCenters={setExpandedCenters}
          dragOffsetRef={s.dragOffsetRef}
          dragPayloadRef={s.dragPayloadRef}
          dragStartPosRef={s.dragStartPosRef}
          VEHICLE_ICONS={VEHICLE_ICONS}
          VEHICLE_LABELS={VEHICLE_LABELS}
        />
      </div>

      <style>{`
        * { user-select: none; -webkit-user-drag: none; }
        input, textarea, [contenteditable="true"] { user-select: text !important; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
        @keyframes ragingFireImg { 0% { transform: scale(1.0); } 50% { transform: scale(1.1) translateY(-2px); } 100% { transform: scale(1.0); } }
        img[src*="785116.png"] { transition: all 0.3s ease; transform-origin: bottom center; position: relative; z-index: 1000 !important; border-radius: 50%; }
        body.fire-locked img[src*="785116.png"] { animation: ragingFireImg 1.5s infinite ease-in-out; }
        @keyframes mciBlink { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
        img[src*="MCI_CROSS_ICON"] { transition: all 0.3s ease; transform-origin: center; z-index: 1000 !important; }
        body:not(.mci-locked) img[src*="MCI_CROSS_ICON"] { animation: mciBlink 1.2s infinite ease-in-out; }
        @keyframes hoseFlow { from { stroke-dashoffset: 25; } to { stroke-dashoffset: 0; } }
        .hose-flow-active { animation: hoseFlow 0.5s linear infinite; }
        .hose-flow-preview { animation: hoseFlow 0.8s linear infinite reverse; }
        * { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
        input, textarea { -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text; }
      `}</style>

      <ModalsContainer
        isLight={isLight}
        supabase={supabase}
        addLog={addLog}
        showConfirm={s.showConfirm}
        setShowConfirm={s.setShowConfirm}
        hoseLinks={hoseLinks}
        setWaterSprayLinks={setWaterSprayLinks}
        setHoseLinks={setHoseLinks}
        isMciLocked={s.isMciLocked}
        setIsMciLocked={s.setIsMciLocked}
        mciSetupStarted={s.mciSetupStarted}
        setMciSetupStarted={s.setMciSetupStarted}
        mciPos={s.mciPos}
        setMciPos={s.setMciPos}
        mciStats={s.mciStats}
        setMciStats={s.setMciStats}
        hospitalStats={s.hospitalStats}
        setHospitalStats={s.setHospitalStats}
        isStagingLocked={s.isStagingLocked}
        setIsStagingLocked={s.setIsStagingLocked}
        stagingSetupStarted={s.stagingSetupStarted}
        setStagingSetupStarted={s.setStagingSetupStarted}
        stagingPos={s.stagingPos}
        setStagingPos={s.setStagingPos}
        selected={selected}
        setSelected={setSelected}
        mciTransportLog={s.mciTransportLog}
        setMciTransportLog={s.setMciTransportLog}
        deleteTargetRecord={deleteTargetRecord}
        deleteSnapshotRecord={deleteSnapshotRecord}
        confirmRecall={s.confirmRecall}
        HOSPITALS={HOSPITALS}
        showResetConfirm={s.showResetConfirm}
        setShowResetConfirm={s.setShowResetConfirm}
        handleResetLogs={s.handleResetLogs}
        showGlobalResetInit={s.showGlobalResetInit}
        setShowGlobalResetInit={s.setShowGlobalResetInit}
        onGlobalReset={onGlobalReset}
        showWaterAdjust={s.showWaterAdjust}
        setShowWaterAdjust={s.setShowWaterAdjust}
        setDeployed={setDeployed}
        showUtilityModal={s.showUtilityModal}
        setShowUtilityModal={s.setShowUtilityModal}
        utilityTab={s.utilityTab}
        setUtilityTab={s.setUtilityTab}
        mciViewMode={s.mciViewMode}
        setMciViewMode={s.setMciViewMode}
        mciFromBadge={s.mciFromBadge}
        mciTransports={s.mciTransports}
        setMciTransports={s.setMciTransports}
        vehicles={vehicles}
        targets={targets}
        selectedTarget={selectedTarget}
        setSelectedTarget={setSelectedTarget}
        snapshots={snapshots}
        isSavingSnapshot={isSavingSnapshot}
        setInputModal={s.setInputModal}
        loadSnapshots={loadSnapshots}
        handleLoadSnapshot={handleLoadSnapshot}
        saveSnapshot={saveSnapshot}
        onManage={onManage}
        centers={centers}
        pumpCalc={s.pumpCalc}
        setPumpCalc={s.setPumpCalc}
        accidentPos={accidentPos}
        UTILITY_MENU_ITEMS={UTILITY_MENU_ITEMS}
        inputModal={s.inputModal}
        showResourceSummary={s.showResourceSummary}
        setShowResourceSummary={s.setShowResourceSummary}
        deployed={deployed}
        personnel={personnel}
        selectedDistrict={selectedDistrict}
        setHydrantCaptureLinks={s.setHydrantCaptureLinks}
      />
    </div>
  );
}
