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
import { removeDeploymentRecord } from "./CommandScreen/recallHelpers.js";
import Sidebar from "./CommandScreen/Sidebar.jsx";
import MapControls from "./CommandScreen/MapControls.jsx";
import ModalsContainer from "./CommandScreen/ModalsContainer.jsx";
import useHydrantSystem from "./CommandScreen/useHydrantSystem";
import useIncidentMarkers from "./CommandScreen/useIncidentMarkers";
import useHoseLines from "./CommandScreen/useHoseLines";
import useDragHandler from "./CommandScreen/useDragHandler";
import useVehicleMarkers from "./CommandScreen/useVehicleMarkers";
import useCommandState from "./CommandScreen/useCommandState";

// 8단계: 스타일 및 상수 분리 적용
import "./CommandScreen/CommandScreen.css";
import { UTILITY_MENU_ITEMS } from "./CommandScreen/constants";

import ResourceDashboard from "./CommandScreen/ResourceDashboard.jsx";

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
    applySnapshotData: (snapshot) => {}, // 초기화 시점 차이 해결을 위해 handleLoadSnapshot에서 처리
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

  const handleLoadSnapshot = (snapshot) => {
    applySnapshotData(snapshot);
    s.handleLoadSnapshot(snapshot);
  };

  useEffect(() => {
    if (s.showUtilityModal && s.utilityTab === "targets") {
      setSelectedTarget(null);
    }
  }, [s.showUtilityModal, s.utilityTab, setSelectedTarget]);

  const { mapSize, mapZoom } = useMapViewport({
    kakaoMap: s.kakaoMap,
    mapRef: s.mapRef,
    windowKakao: window.kakao
  });

  const { hydrantMarkersRef } = useHydrantSystem({
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

  const { deployedIds, personnelDeployedCount, vehicleDeployedCount } = useDeploymentSummary({ deployed, personnel });

  useIncidentMarkers({
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

  useHoseLines({
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
    <div className="command-screen-container no-select">
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

      <div className="command-screen-main">
        <ResourceDashboard
          isLight={isLight}
          setShowResourceSummary={s.setShowResourceSummary}
          vehicleDeployedCount={vehicleDeployedCount}
          personnelDeployedCount={personnelDeployedCount}
          sortedCenters={sortedCentersFromHook}
          deployed={deployed}
          personnel={personnel}
          selectedDistrict={selectedDistrict}
          setShowResetConfirm={s.setShowResetConfirm}
          exportLogsAsCsv={exportLogsAsCsv}
          logs={logs}
        />

        {/* 지도 및 컨트롤 구역 */}
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
        setIsStagingLocked={setIsStagingLocked}
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
