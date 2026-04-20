import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { VEHICLE_ICONS, VEHICLE_LABELS, ROLES, DISTRICTS, getDistance, HOSPITALS, SEVERITIES, TRANSPORT_STATUSES } from "../constants";
import KakaoMap from "./KakaoMap";
import StatusBar from "./CommandScreen/StatusBar.jsx";
import useTargetSnapshots from "./CommandScreen/useTargetSnapshots.js";
import useMapViewport from "./CommandScreen/useMapViewport.js";
import useDeploymentSummary from "./CommandScreen/useDeploymentSummary.js";
import useSortedCenters from "./CommandScreen/useSortedCenters.js";
import { exportLogsAsCsv } from "./CommandScreen/logExport.js";
import { focusAccidentOnMap } from "./CommandScreen/focusAccidentOnMap.js";
import { moveToMyLocation as moveToMyLocationHelper } from "./CommandScreen/moveToMyLocation.js";
import { applyRecallCleanup, removeDeploymentRecord } from "./CommandScreen/recallHelpers.js";
import { runMciDeconstruction, runStagingDeconstruction } from "./CommandScreen/deconstructionHelpers.js";
import { resetSituationLogs } from "./CommandScreen/resetSituationLogs.js";
import Sidebar from "./CommandScreen/Sidebar.jsx";
import MapControls from "./CommandScreen/MapControls.jsx";
import ModalsContainer from "./CommandScreen/ModalsContainer.jsx";
import useHydrantSystem from "./CommandScreen/useHydrantSystem";
import useIncidentMarkers from "./CommandScreen/useIncidentMarkers";
import useHoseLines from "./CommandScreen/useHoseLines";
import useDragHandler from "./CommandScreen/useDragHandler";
import useVehicleMarkers from "./CommandScreen/useVehicleMarkers";
import HYDRANT_DATA from "../data/fire_hydrants.json";

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
  const [kakaoMap, setKakaoMap] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const handleMciDeconstruction = () => {
    setMciPos(null);
    setMciSetupStarted(false);
    setIsMciLocked(false);
    setSelected(null);
    addLog("임시의료소 해체 완료", "recall");
  };

  const handleStagingDeconstruction = () => {
    setStagingPos(null);
    setStagingSetupStarted(false);
    setIsStagingLocked(false);
    setSelected(null);
    addLog("자원집결지 해체 완료", "recall");
  };

  const [showWaterAdjust, setShowWaterAdjust] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [hoseDragSource, setHoseDragSource] = useState(null);
  const [hydrantDragSource, setHydrantDragSource] = useState(null);
  const [yCouplingPositions, setYCouplingPositions] = useState({}); // { [vehicleId]: { lat, lng } }

  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const dragStartPosRef = useRef(null);
  const dragPayloadRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const suppressionCircleRef = useRef(null);
  const hoseDragOriginRef = useRef(null);
  const yCouplingDragFrameRef = useRef(null);
  const yCouplingDragPosRef = useRef(null); // { vehicleId, lat, lng }
  const yCouplingOverlayRef = useRef({});
  const yCouplingIsDraggingRef = useRef(false);
  const yCouplingLastClientPosRef = useRef(null); // 데이타 방식 드래그: 이전 프레임 터치 위치
  const [hydrantRadius, setHydrantRadius] = useState(500);
  const [hydrantVisible, setHydrantVisible] = useState(false);
  const [hydrantCaptureLinks, setHydrantCaptureLinks] = useState([]); // [{id, vehicleId, hydrantId, hydrantLat, hydrantLng}]
  const [mciPos, setMciPos] = useState(null);
  const [isMciLocked, setIsMciLocked] = useState(false);
  const [mciStats, setMciStats] = useState({ red: 0, yellow: 0, green: 0, black: 0 });
  const [hospitalStats, setHospitalStats] = useState({});
  const [mciTransports, setMciTransports] = useState([]);
  const [stagingPos, setStagingPos] = useState(null);
  const [isStagingLocked, setIsStagingLocked] = useState(false);
  const [mciSetupStarted, setMciSetupStarted] = useState(false);
  const [stagingSetupStarted, setStagingSetupStarted] = useState(false);
  const [siameseLinks, setSiameseLinks] = useState([]); // [{id, lat, lng, name}]

  useEffect(() => {
    if (selectedDistrict) {
      setHydrantRadius(selectedDistrict.hydrantRadius || 500);
    }
  }, [selectedDistrict]);

  const [mciViewMode, setMciViewMode] = useState("main");
  const [mciFromBadge, setMciFromBadge] = useState(false);
  const [mciTransportLog, setMciTransportLog] = useState([]);

  const [inputModal, setInputModal] = useState({ show: false, type: "", title: "", placeholder: "", defaultValue: "", onConfirm: null });
  const [mapTypeId, setMapType] = useState("ROADMAP");
  const [showResourceSummary, setShowResourceSummary] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGlobalResetInit, setShowGlobalResetInit] = useState(false);
  const [showHydrantRadiusPicker, setShowHydrantRadiusPicker] = useState(false);
  const [utilityTab, setUtilityTab] = useState("staging");
  const [showUtilityModal, setShowUtilityModal] = useState(false);
  const [pumpCalc, setPumpCalc] = useState({ mode: "standard", floor: 5, hose: 2, hoseSize: 40 });
  const { mapSize, mapZoom } = useMapViewport({
    kakaoMap,
    mapRef,
    windowKakao: window.kakao
  });
  const { hydrantMarkersRef, hydrantLinesRef, hydrantPreviewLineRef } = useHydrantSystem({
    kakaoMap,
    hydrantVisible,
    hydrantRadius,
    accidentPos,
    hydrantCaptureLinks,
    deployed,
    mapZoom,
    dragPos,
    mapRef,
    hydrantDragSource,
    mapSize
  });
  const {
    deployedIds,
    vehicleDeployedIds,
    vehicleDeployedIdSet,
    personnelDeployedCount,
    vehicleDeployedCount
  } = useDeploymentSummary({
    deployed,
    personnel
  });
  const { fireMarkerRef, mciMarkerRef, stagingMarkerRef } = useIncidentMarkers({
    kakaoMap,
    accidentPos, setAccidentPos, isAccidentLocked, setAccidentAddress,
    mciPos, setMciPos, mciSetupStarted, isMciLocked,
    setMciFromBadge, setShowUtilityModal, setUtilityTab,
    stagingPos, setStagingPos, stagingSetupStarted, isStagingLocked,
    setSelected
  });
  const sortedCentersFromHook = useSortedCenters({
    centers,
    selectedDistrict
  });
  const { hoseLinesRef, waterSprayRef } = useHoseLines({
    kakaoMap, hoseLinks, deployed, hoseDragSource, dragging, dragPos,
    mapZoom, mapSize, yCouplingPositions, personnel, siameseLinks,
    waterSprayLinks, accidentPos, setShowConfirm, mapRef
  });

  const {
    targets,
    setTargets,
    selectedTarget,
    setSelectedTarget,
    snapshots,
    setSnapshots,
    isSavingSnapshot,
    setIsSavingSnapshot,
    fetchSnapshots: loadSnapshots,
    handleSaveSnapshot: saveSnapshot,
    actualDeleteSnapshot: deleteSnapshotRecord,
    actualDeleteTarget: deleteTargetRecord,
    handleLoadSnapshot: applySnapshotData
  } = useTargetSnapshots({
    deployed,
    hoseLinks,
    waterSprayLinks,
    accidentPos,
    accidentAddress,
    hydrantVisible,
    hydrantRadius,
    hydrantCaptureLinks,
    mciPos,
    isMciLocked,
    stagingPos,
    isStagingLocked,
    siameseLinks,
    yCouplingPositions,
    setDeployed,
    setHoseLinks,
    setWaterSprayLinks,
    setAccidentPos,
    setAccidentAddress,
    setHydrantVisible,
    setHydrantCaptureLinks,
    setMciPos,
    setIsMciLocked,
    setStagingPos,
    setIsStagingLocked,
    setSiameseLinks,
    setYCouplingPositions,
    addLog
  });

  useEffect(() => {
    if (showUtilityModal && utilityTab === "targets") {
      setSelectedTarget(null);
    }
  }, [showUtilityModal, utilityTab]);

  const handleLoadSnapshot = (snapshot) => {
    applySnapshotData(snapshot);
    setShowUtilityModal(false);
    focusAccidentOnMap(kakaoMap, snapshot.data.accidentPos);
  };

  useEffect(() => {
    if (kakaoMap && window.kakao && window.kakao.maps) {
      const type = window.kakao.maps.MapTypeId[mapTypeId];
      if (type) {
        kakaoMap.setMapTypeId(type);
      }
    }
  }, [kakaoMap, mapTypeId]);

  const saveDeployment = async (itemId, itemType, lat, lng) => {
    try {
      await supabase.from("deployments").upsert({ item_id: itemId, item_type: itemType, lat, lng }, { onConflict: "item_id,item_type" });
    } catch (err) {
      console.error("Save deployment failed:", err);
    }
  };

  useDragHandler({
    kakaoMap, mapRef,
    dragging, setDragging,
    dragPos, setDragPos,
    hoseDragSource, setHoseDragSource,
    hydrantDragSource, setHydrantDragSource,
    hoseDragOriginRef, dragPayloadRef, dragStartPosRef, dragOffsetRef,
    yCouplingOverlayRef, yCouplingDragPosRef, yCouplingIsDraggingRef, yCouplingLastClientPosRef,
    deployed, setDeployed,
    personnel, vehicles,
    accidentPos, hydrantRadius,
    siameseLinks, setSiameseLinks,
    hoseLinks, setHoseLinks,
    setHydrantCaptureLinks,
    setWaterSprayLinks,
    setYCouplingPositions,
    setSelected, setShowConfirm,
    addLog, saveDeployment, removeDeploymentRecord, supabase
  });

  useVehicleMarkers({
    kakaoMap, deployed, selected, mapZoom, centers, personnel, vehicles,
    waterSprayLinks, hoseLinks, hydrantCaptureLinks, siameseLinks,
    yCouplingPositions, accidentPos,
    overlaysRef, yCouplingOverlayRef,
    dragPayloadRef, dragStartPosRef, dragOffsetRef,
    yCouplingDragPosRef, yCouplingLastClientPosRef,
    mapRef,
    setSelected, setShowConfirm, setShowWaterAdjust,
    setWaterSprayLinks, setHoseDragSource, setHydrantDragSource,
    setDragPos, setSiameseLinks, setHoseLinks,
    hoseDragOriginRef, addLog
  });

  useEffect(() => {
    if (kakaoMap && selectedDistrict) {
      try {
        const moveLatLon = new window.kakao.maps.LatLng(selectedDistrict.center.lat, selectedDistrict.center.lng);
        const currentCenter = kakaoMap.getCenter();
        if (getDistance(currentCenter.getLat(), currentCenter.getLng(), selectedDistrict.center.lat, selectedDistrict.center.lng) > 0.001) {
          kakaoMap.panTo(moveLatLon);
        }
        if (!accidentPos) {
          setAccidentPos(selectedDistrict.center);
          setIsAccidentLocked(false);
          addLog(`${selectedDistrict.name} 작전 구역 설정`, "info");
        }
      } catch (err) { console.error("Map panTo error:", err); }
    }
  }, [kakaoMap, selectedDistrict]);

  useEffect(() => {
    if (kakaoMap && accidentPos && isAccidentLocked) {
      try {
        kakaoMap.setLevel(2);
        kakaoMap.panTo(new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng));
      } catch (err) { console.error("Zoom to accident error:", err); }
    }
  }, [kakaoMap]);

  useEffect(() => {
    if (selectedDistrict && sortedCentersFromHook.length > 0) {
      setExpandedCenters(prev => {
        if (Object.keys(prev).length > 0) return prev;
        const initial = {};
        sortedCentersFromHook.forEach(c => { initial[c.id] = false; });
        return initial;
      });
    }
  }, [selectedDistrict, sortedCentersFromHook, setExpandedCenters]);





  const moveToMyLocation = () => moveToMyLocationHelper({
    kakaoMap,
    setAccidentPos,
    addLog
  });

  const handleResetLogs = async () => resetSituationLogs({ supabase, setLogs, setShowResetConfirm });

  const confirmRecall = async () => {
    if (!showConfirm) return;
    const itemType = showConfirm.itemType || 'vehicle';
    
    applyRecallCleanup({
      itemId: showConfirm.id,
      itemType,
      setDeployed,
      setWaterSprayLinks,
      setHoseLinks,
      setHydrantCaptureLinks,
      setYCouplingPositions
    });

    await removeDeploymentRecord(supabase, showConfirm.id, itemType);
    addLog(`${showConfirm.name} 철수 완료`, "recall");
    setShowConfirm(null);
    setSelected(null);
  };

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
        setShowResourceSummary={setShowResourceSummary}
        setShowGlobalResetInit={setShowGlobalResetInit}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ 
          width: 250, background: "#0a1420", borderRight: "1px solid #1e3a52", 
          display: "flex", flexDirection: "column", flexShrink: 0, 
          filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" 
        }}>
          <div 
            onClick={() => setShowResourceSummary(true)}
            style={{ 
              padding: "16px 20px", borderBottom: "1px solid #1e3a52", background: "#0e1925", 
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer", transition: "background 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#1a2a3a"}
            onMouseLeave={e => e.currentTarget.style.background = "#0e1925"}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#7ec8e3", letterSpacing: 1 }}>🏢 현장 투입</div>
            <div style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 500 }}>
              차량: <span style={{ color: "#60a5fa" }}>{vehicleDeployedCount}대</span>, 대원: <span style={{ color: "#4ade80" }}>{personnelDeployedCount}명</span>
            </div>
          </div>
          <div 
            onClick={() => setShowResourceSummary(true)}
            style={{ flex: 1, overflowY: "auto", padding: "12px", cursor: "pointer" }}
          >
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
                    <div style={{ color: "#4a7a9b" }}>
                      차량: <span style={{ color: "#60a5fa" }}>{vCount}대</span>
                    </div>
                    <div style={{ width: 1, height: 10, background: "#1e3a52" }} />
                    <div style={{ color: "#4a7a9b" }}>
                      대원: <span style={{ color: "#4ade80" }}>{pCount}명</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "16px 20px", borderTop: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ff6030" }}>📜 활동 기록</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowResetConfirm(true)} style={{ background: "#3a1a1a", border: "1px solid #ff450066", borderRadius: 4, color: "#ff7050", padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>초기화</button>
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

        <div ref={mapRef} style={{ flex: 1, position: "relative", background: "#060d18", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {selectedDistrict && <KakaoMap key={selectedDistrict.name} center={selectedDistrict.center} onMapReady={setKakaoMap} />}
          </div>
          
          {selectedDistrict && (
            <div style={{ 
              position: "absolute", top: 12, right: 62, 
              height: 44, 
              zIndex: 10010, 
              display: "flex", 
              alignItems: "stretch", 
              background: "linear-gradient(135deg, #1e3a52, #0f1a2a)", 
              border: "1px solid #1e3a52", 
              borderRadius: 12, 
              overflow: "hidden", 
              boxSizing: "border-box",
              boxShadow: "0 6px 20px rgba(0,0,0,0.4)", 
              filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" 
            }}>
              <button 
                onClick={() => setMapType("ROADMAP")}
                style={{ padding: "0 14px", border: "none", background: mapTypeId === "ROADMAP" ? "#1e3a52" : "transparent", color: mapTypeId === "ROADMAP" ? "#fff" : "#4a7a9b", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
              >지도</button>
              <div style={{ width: 1, background: "#1e3a52" }} />
              <button 
                onClick={() => setMapType("HYBRID")}
                style={{ padding: "0 14px", border: "none", background: mapTypeId === "HYBRID" ? "#1e3a52" : "transparent", color: mapTypeId === "HYBRID" ? "#fff" : "#4a7a9b", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
              >위성</button>
            </div>
          )}
          {selectedDistrict && (
              <MapControls
                isAccidentLocked={isAccidentLocked}
                setIsAccidentLocked={setIsAccidentLocked}
                mciSetupStarted={mciSetupStarted}
                isMciLocked={isMciLocked}
                setIsMciLocked={setIsMciLocked}
                addLog={addLog}
                setMciSetupStarted={setMciSetupStarted}
                setMciPos={setMciPos}
                stagingSetupStarted={stagingSetupStarted}
                isStagingLocked={isStagingLocked}
                setIsStagingLocked={setIsStagingLocked}
                setStagingSetupStarted={setStagingSetupStarted}
                setStagingPos={setStagingPos}
                selectedDistrict={selectedDistrict}
                mciStats={mciStats}
                setShowConfirm={setShowConfirm}
                dragging={dragging}
                dragPos={dragPos}
                dragOffsetRef={dragOffsetRef}
                mapRef={mapRef}
                setSelectedTarget={setSelectedTarget}
                setShowUtilityModal={setShowUtilityModal}
                setUtilityTab={setUtilityTab}
                setMciFromBadge={setMciFromBadge}
                accidentPos={accidentPos}
                siameseLinks={siameseLinks}
                setSiameseLinks={setSiameseLinks}
                moveToMyLocation={moveToMyLocation}
                showHydrantRadiusPicker={showHydrantRadiusPicker}
                setHydrantRadius={setHydrantRadius}
                setHydrantVisible={setHydrantVisible}
                setShowHydrantRadiusPicker={setShowHydrantRadiusPicker}
                hydrantVisible={hydrantVisible}
                hydrantMarkersRef={hydrantMarkersRef}
                hydrantRadius={hydrantRadius}
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
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          activeTab={activeTab}
          setSideTab={setSideTab}
          sortedCenters={sortedCentersFromHook}
          personnel={personnel}
          vehicles={vehicles}
          deployedIds={deployedIds}
          expandedCenters={expandedCenters}
          setExpandedCenters={setExpandedCenters}
          dragOffsetRef={dragOffsetRef}
          dragPayloadRef={dragPayloadRef}
          dragStartPosRef={dragStartPosRef}
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
        showConfirm={showConfirm}
        setShowConfirm={setShowConfirm}
        hoseLinks={hoseLinks}
        setWaterSprayLinks={setWaterSprayLinks}
        setHoseLinks={setHoseLinks}
        isMciLocked={isMciLocked}
        setIsMciLocked={setIsMciLocked}
        mciSetupStarted={mciSetupStarted}
        setMciSetupStarted={setMciSetupStarted}
        mciPos={mciPos}
        setMciPos={setMciPos}
        mciStats={mciStats}
        setMciStats={setMciStats}
        hospitalStats={hospitalStats}
        setHospitalStats={setHospitalStats}
        isStagingLocked={isStagingLocked}
        setIsStagingLocked={setIsStagingLocked}
        stagingSetupStarted={stagingSetupStarted}
        setStagingSetupStarted={setStagingSetupStarted}
        stagingPos={stagingPos}
        setStagingPos={setStagingPos}
        selected={selected}
        setSelected={setSelected}
        mciTransportLog={mciTransportLog}
        setMciTransportLog={setMciTransportLog}
        deleteTargetRecord={deleteTargetRecord}
        deleteSnapshotRecord={deleteSnapshotRecord}
        confirmRecall={confirmRecall}
        HOSPITALS={HOSPITALS}
        showResetConfirm={showResetConfirm}
        setShowResetConfirm={setShowResetConfirm}
        handleResetLogs={handleResetLogs}
        showGlobalResetInit={showGlobalResetInit}
        setShowGlobalResetInit={setShowGlobalResetInit}
        onGlobalReset={onGlobalReset}
        showWaterAdjust={showWaterAdjust}
        setShowWaterAdjust={setShowWaterAdjust}
        setDeployed={setDeployed}
        showUtilityModal={showUtilityModal}
        setShowUtilityModal={setShowUtilityModal}
        utilityTab={utilityTab}
        setUtilityTab={setUtilityTab}
        mciViewMode={mciViewMode}
        setMciViewMode={setMciViewMode}
        mciFromBadge={mciFromBadge}
        mciTransports={mciTransports}
        setMciTransports={setMciTransports}
        vehicles={vehicles}
        targets={targets}
        selectedTarget={selectedTarget}
        setSelectedTarget={setSelectedTarget}
        snapshots={snapshots}
        isSavingSnapshot={isSavingSnapshot}
        setInputModal={setInputModal}
        loadSnapshots={loadSnapshots}
        handleLoadSnapshot={handleLoadSnapshot}
        saveSnapshot={saveSnapshot}
        onManage={onManage}
        centers={centers}
        pumpCalc={pumpCalc}
        setPumpCalc={setPumpCalc}
        accidentPos={accidentPos}
        UTILITY_MENU_ITEMS={UTILITY_MENU_ITEMS}
        inputModal={inputModal}
        showResourceSummary={showResourceSummary}
        setShowResourceSummary={setShowResourceSummary}
        deployed={deployed}
        personnel={personnel}
        selectedDistrict={selectedDistrict}
        setHydrantCaptureLinks={setHydrantCaptureLinks}
      />
    </div >
  );
}
