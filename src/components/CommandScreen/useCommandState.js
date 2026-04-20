import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { getDistance } from "../../constants";
import { applyRecallCleanup, removeDeploymentRecord } from "./recallHelpers.js";
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

  // ── 소화전 상태 ──
  const [hydrantRadius, setHydrantRadius] = useState(500);
  const [hydrantVisible, setHydrantVisible] = useState(false);
  const [hydrantCaptureLinks, setHydrantCaptureLinks] = useState([]);

  // ── Y커플링(분수기) 상태 ──
  const [yCouplingPositions, setYCouplingPositions] = useState({});

  // ── MCI 상태 ──
  const [mciPos, setMciPos] = useState(null);
  const [isMciLocked, setIsMciLocked] = useState(false);
  const [mciStats, setMciStats] = useState({ red: 0, yellow: 0, green: 0, black: 0 });
  const [hospitalStats, setHospitalStats] = useState({});
  const [mciTransports, setMciTransports] = useState([]);
  const [mciSetupStarted, setMciSetupStarted] = useState(false);
  const [mciViewMode, setMciViewMode] = useState("main");
  const [mciFromBadge, setMciFromBadge] = useState(false);
  const [mciTransportLog, setMciTransportLog] = useState([]);

  // ── 자원집결지 상태 ──
  const [stagingPos, setStagingPos] = useState(null);
  const [isStagingLocked, setIsStagingLocked] = useState(false);
  const [stagingSetupStarted, setStagingSetupStarted] = useState(false);

  // ── 연결송수구 ──
  const [siameseLinks, setSiameseLinks] = useState([]);

  // ── 사다리차 상태 ──
  const [ladderDeployments, setLadderDeployments] = useState({});
  const [basketOccupants, setBasketOccupants] = useState({});

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
    setLadderDeployments(prev => { const next = { ...prev }; delete next[showConfirm.id]; return next; });
    setBasketOccupants(prev => { const next = { ...prev }; delete next[showConfirm.id]; return next; });
    await removeDeploymentRecord(supabase, showConfirm.id, itemType);
    addLog(`${showConfirm.name} 철수 완료`, "recall");
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
