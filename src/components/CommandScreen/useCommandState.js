import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { getDistance } from "../../constants";
import { applyRecallCleanup, removeDeploymentRecord, removeMultipleDeploymentRecords } from "./recallHelpers.js";
import { resetSituationLogs } from "./resetSituationLogs.js";
import { moveToMyLocation as moveToMyLocationHelper } from "./moveToMyLocation.js";
import { focusAccidentOnMap } from "./focusAccidentOnMap.js";

export default function useCommandState({
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
  applySnapshotData,

  // 전역 상태 props 추가
  ladderDeployments, setLadderDeployments,
  basketOccupants, setBasketOccupants,
  ladderPositions, setLadderPositions,
  yCouplingPositions, setYCouplingPositions,
  hydrantCaptureLinks, setHydrantCaptureLinks,
  siameseLinks, setSiameseLinks,
  mciPos, setMciPos,
  isMciLocked, setIsMciLocked,
  mciStats, setMciStats,
  hospitalStats, setHospitalStats,
  mciTransports, setMciTransports,
  mciSetupStarted, setMciSetupStarted,
  mciViewMode, setMciViewMode,
  mciFromBadge, setMciFromBadge,
  mciTransportLog, setMciTransportLog,
  stagingPos, setStagingPos,
  isStagingLocked, setIsStagingLocked,
  stagingSetupStarted, setStagingSetupStarted,
  hydrantRadius, setHydrantRadius,
  hydrantVisible, setHydrantVisible
}) {
  // ── 지도 상태 ──
  const [kakaoMap, setKakaoMap] = useState(null);
  const [mapTypeId, setMapType] = useState("ROADMAP");

  // ── UI 상태 ──
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showResourceSummary, setShowResourceSummary] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGlobalResetInit, setShowGlobalResetInit] = useState(false);
  const [showWaterAdjust, setShowWaterAdjust] = useState(null);
  const [showHydrantRadiusPicker, setShowHydrantRadiusPicker] = useState(false);
  const [showUtilityModal, setShowUtilityModal] = useState(false);
  const [utilityTab, setUtilityTab] = useState("staging");
  const [inputModal, setInputModal] = useState({ show: false, type: "", title: "", placeholder: "", defaultValue: "", onConfirm: null });
  const [pumpCalc, setPumpCalc] = useState({ mode: "standard", floor: 5, hose: 2, hoseSize: 40 });
  const [showConfirm, setShowConfirm] = useState(null);

  // ── 드래그 상태 ──
  const [dragging, setDragging] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [hoseDragSource, setHoseDragSource] = useState(null);
  const [hydrantDragSource, setHydrantDragSource] = useState(null);

  // ── Refs ──
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const dragStartPosRef = useRef(null);
  const dragPayloadRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const suppressionCircleRef = useRef(null);
  const hoseDragOriginRef = useRef(null);
  const yCouplingDragFrameRef = useRef(null);
  const yCouplingDragPosRef = useRef(null);
  const yCouplingOverlayRef = useRef({});
  const yCouplingIsDraggingRef = useRef(false);
  const yCouplingLastClientPosRef = useRef(null);

  // (로컬 상태 제거 완료 - App.jsx에서 관리됨)

  // ── Effects ──
  useEffect(() => {
    if (selectedDistrict) {
      setHydrantRadius(selectedDistrict.hydrantRadius || 500);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (kakaoMap && window.kakao && window.kakao.maps) {
      const type = window.kakao.maps.MapTypeId[mapTypeId];
      if (type) kakaoMap.setMapTypeId(type);
    }
  }, [kakaoMap, mapTypeId]);

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

  useEffect(() => {
    if (showUtilityModal && utilityTab === "targets") {
      // 타겟 탭 진입 시 선택 초기화 (useTargetSnapshots의 setSelectedTarget 필요 시 외부에서 처리)
    }
  }, [showUtilityModal, utilityTab]);

  // ── 핸들러 ──
  const saveDeployment = async (itemId, itemType, lat, lng) => {
    try {
      await supabase.from("deployments").upsert(
        { item_id: itemId, item_type: itemType, lat, lng },
        { onConflict: "item_id,item_type" }
      );
    } catch (err) { console.error("Save deployment failed:", err); }
  };

  const handleResetLogs = async () => resetSituationLogs({ supabase, setLogs, setShowResetConfirm });

  const confirmRecall = async () => {
    if (!showConfirm) return;
    const itemId = showConfirm.id;
    const itemType = showConfirm.itemType || 'vehicle';
    
    // 연쇄 철수 대상 대원 식별 (차량 철수 시 방수 중인 대원)
    let relatedPersonnel = [];
    if (itemType === "vehicle") {
      const removedHoseTargets = hoseLinks
        .filter(link => String(link.fromId) === String(itemId))
        .map(link => String(link.toId));
      relatedPersonnel = waterSprayLinks
        .filter(s => removedHoseTargets.includes(String(s.personnelId)))
        .map(s => ({ id: s.personnelId, type: "personnel" }));
    }

    applyRecallCleanup({
      itemId,
      itemType,
      setDeployed,
      setWaterSprayLinks,
      setHoseLinks,
      setHydrantCaptureLinks,
      setYCouplingPositions,
      hoseLinks,
      waterSprayLinks
    });

    setLadderDeployments(prev => { const next = { ...prev }; delete next[itemId]; return next; });
    setBasketOccupants(prev => { const next = { ...prev }; delete next[itemId]; return next; });
    setLadderPositions(prev => { const next = { ...prev }; delete next[itemId]; return next; });

    // DB 삭제 (본인)
    await removeDeploymentRecord(supabase, itemId, itemType);
    
    // 연쇄 철수 대원들 DB 삭제 및 로그
    if (relatedPersonnel.length > 0) {
      await removeMultipleDeploymentRecords(supabase, relatedPersonnel);
      addLog(`${showConfirm.name} 철수 (방수 대원 ${relatedPersonnel.length}명 포함)`, "recall");
    } else {
      addLog(`${showConfirm.name} 철수 완료`, "recall");
    }

    setShowConfirm(null);
    setSelected(null);
  };

  const moveToMyLocation = () => moveToMyLocationHelper({ kakaoMap, setAccidentPos, addLog });

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

  const handleLoadSnapshot = (snapshot) => {
    applySnapshotData(snapshot);
    setShowUtilityModal(false);
    focusAccidentOnMap(kakaoMap, snapshot.data.accidentPos);
  };

  return {
    // 지도
    kakaoMap, setKakaoMap,
    mapTypeId, setMapType,
    mapRef, overlaysRef, suppressionCircleRef,

    // UI
    isSidebarOpen, setIsSidebarOpen,
    showResourceSummary, setShowResourceSummary,
    showResetConfirm, setShowResetConfirm,
    showGlobalResetInit, setShowGlobalResetInit,
    showWaterAdjust, setShowWaterAdjust,
    showHydrantRadiusPicker, setShowHydrantRadiusPicker,
    showUtilityModal, setShowUtilityModal,
    utilityTab, setUtilityTab,
    inputModal, setInputModal,
    pumpCalc, setPumpCalc,
    showConfirm, setShowConfirm,

    // 드래그
    dragging, setDragging,
    dragPos, setDragPos,
    hoseDragSource, setHoseDragSource,
    hydrantDragSource, setHydrantDragSource,
    dragStartPosRef, dragPayloadRef, dragOffsetRef,
    hoseDragOriginRef, yCouplingDragFrameRef, yCouplingDragPosRef,
    yCouplingOverlayRef, yCouplingIsDraggingRef, yCouplingLastClientPosRef,

    // 소화전
    hydrantRadius, setHydrantRadius,
    hydrantVisible, setHydrantVisible,
    hydrantCaptureLinks, setHydrantCaptureLinks,

    // Y커플링
    yCouplingPositions, setYCouplingPositions,

    // MCI
    mciPos, setMciPos,
    isMciLocked, setIsMciLocked,
    mciStats, setMciStats,
    hospitalStats, setHospitalStats,
    mciTransports, setMciTransports,
    mciSetupStarted, setMciSetupStarted,
    mciViewMode, setMciViewMode,
    mciFromBadge, setMciFromBadge,
    mciTransportLog, setMciTransportLog,

    // 자원집결지
    stagingPos, setStagingPos,
    isStagingLocked, setIsStagingLocked,
    stagingSetupStarted, setStagingSetupStarted,

    // 연결송수구
    siameseLinks, setSiameseLinks,

    // 사다리차
    ladderDeployments, setLadderDeployments,
    basketOccupants, setBasketOccupants,
    ladderPositions, setLadderPositions,

    // 핸들러
    saveDeployment,
    handleResetLogs,
    confirmRecall,
    moveToMyLocation,
    handleMciDeconstruction,
    handleStagingDeconstruction,
    handleLoadSnapshot,
  };
}
