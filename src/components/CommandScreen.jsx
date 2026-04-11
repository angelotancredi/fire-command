import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { VEHICLE_ICONS, VEHICLE_LABELS, ROLES, DISTRICTS, getDistance, HOSPITALS, SEVERITIES, TRANSPORT_STATUSES } from "../constants";
import KakaoMap from "./KakaoMap";
import WeatherWidget from "./WeatherWidget";
import MciModule from "./CommandScreen/MciModule";
import TargetModule from "./CommandScreen/TargetModule";
import StagingPopup from "./CommandScreen/StagingPopup";
import ResourceSummaryPopup from "./CommandScreen/ResourceSummaryPopup";
import HYDRANT_DATA from "../data/fire_hydrants.json";

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
  const [mapZoom, setMapZoom] = useState(3);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
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
  const fireMarkerRef = useRef(null);
  const mciMarkerRef = useRef(null);
  const stagingMarkerRef = useRef(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGlobalResetInit, setShowGlobalResetInit] = useState(false);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const dragPayloadRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef(null);
  const hoseLinesRef = useRef([]);
  const waterSprayRef = useRef([]);
  const hydrantMarkersRef = useRef([]);
  const hydrantLinesRef = useRef([]);
  const [hydrantVisible, setHydrantVisible] = useState(false);
  const [hydrantRadius, setHydrantRadius] = useState(null);
  const [showHydrantRadiusPicker, setShowHydrantRadiusPicker] = useState(false);
  const [hydrantCaptureLinks, setHydrantCaptureLinks] = useState([]); // { id, vehicleId, hydrantId }
  const [hydrantDragSource, setHydrantDragSource] = useState(null); // vehicleId
  const [dragPos, setDragPos] = useState(null);
  const [hoseDragSource, setHoseDragSource] = useState(null);
  const [showWaterAdjust, setShowWaterAdjust] = useState(null); // { id, name, current }
  const [showUtilityModal, setShowUtilityModal] = useState(false);
  const [utilityTab, setUtilityTab] = useState("menu"); // menu, calc, mci
  const [pumpCalc, setPumpCalc] = useState({ floor: 10, hose: 1, mode: "standard", hoseSize: 40 });
  const [mciStats, setMciStats] = useState({ red: 0, yellow: 0, green: 0, black: 0 });
  const [mciPos, setMciPos] = useState(null);
  const [isMciLocked, setIsMciLocked] = useState(false);
  const [mciSetupStarted, setMciSetupStarted] = useState(false);
  const isMciLockedRef = useRef(isMciLocked);
  useEffect(() => { isMciLockedRef.current = isMciLocked; }, [isMciLocked]);

  const [stagingPos, setStagingPos] = useState(null);
  const [isStagingLocked, setIsStagingLocked] = useState(false);
  const [stagingSetupStarted, setStagingSetupStarted] = useState(false);
  const isStagingLockedRef = useRef(isStagingLocked);
  useEffect(() => { isStagingLockedRef.current = isStagingLocked; }, [isStagingLocked]);

  // MCI 병원 이송 관련 상태
  const [mciViewMode, setMciViewMode] = useState("main"); // "main" or "hospital"
  const [mciFromBadge, setMciFromBadge] = useState(false);
  const [hospitalStats, setHospitalStats] = useState(
    HOSPITALS.reduce((acc, h) => ({
      ...acc,
      [h.name]: { red: 0, yellow: 0, green: 0, black: 0 }
    }), {})
  );

  // 구급차 이송 현황 상태 (id, amb, hosp, sev, stat, showPop)
  const [mciTransports, setMciTransports] = useState([]);
  const [mciTransportLog, setMciTransportLog] = useState([]);

  // 대상물 및 전술 스냅샷 상태
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [inputModal, setInputModal] = useState({ show: false, type: "", title: "", placeholder: "", defaultValue: "", onConfirm: null });
  const [mapTypeId, setMapType] = useState("ROADMAP"); // ROADMAP, HYBRID
  const [showResourceSummary, setShowResourceSummary] = useState(false);

  useEffect(() => {
    const fetchTargets = async () => {
      const { data } = await supabase.from("target_objects").select("*").order("name");
      if (data) setTargets(data);
    };
    fetchTargets();
  }, []);

  const fetchSnapshots = async (targetId) => {
    const { data } = await supabase.from("tactical_snapshots").select("*").eq("target_id", targetId).order("created_at", { ascending: false });
    if (data) setSnapshots(data);
  };

  const handleSaveSnapshot = async (targetId, name) => {
    setIsSavingSnapshot(true);
    const snapshotData = {
      deployed,
      hoseLinks,
      waterSprayLinks,
      accidentPos,
      accidentAddress,
      // 추가 전술 상태 저장
      hydrantVisible,
      hydrantRadius,
      hydrantCaptureLinks,
      mciPos,
      isMciLocked,
      stagingPos,
      isStagingLocked
    };
    const { data, error } = await supabase.from("tactical_snapshots").insert([{
      target_id: targetId,
      name: name || `${new Date().toLocaleString()} 배치`,
      data: snapshotData
    }]);
    if (!error) {
      addLog(`전술 스냅샷 저장 완료: ${name}`, "info");
      fetchSnapshots(targetId);
    }
    setIsSavingSnapshot(false);
  };

  const handleDeleteSnapshot = (snapshotId, name, targetId) => {
    setShowConfirm({ type: "snapshot-delete", id: snapshotId, name, targetId });
  };

  // 대상물 관리 진입 시 항상 목록(초기화면)이 나오도록 처리
  useEffect(() => {
    if (showUtilityModal && utilityTab === "targets") {
      setSelectedTarget(null);
    }
  }, [showUtilityModal, utilityTab]);

  const actualDeleteSnapshot = async (snapshotId, name, targetId) => {
    try {
      const { error } = await supabase.from("tactical_snapshots").delete().eq("id", snapshotId);
      if (!error) {
        addLog(`스냅샷 삭제 완료: ${name}`, "info");
        setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
      }
    } catch (err) {
      console.error("Delete snapshot failed:", err);
    }
  };

  const handleDeleteTarget = (targetId, name) => {
    setShowConfirm({ type: "target-delete", id: targetId, name });
  };

  const actualDeleteTarget = async (targetId, name) => {
    try {
      await supabase.from("tactical_snapshots").delete().eq("target_id", targetId);
      const { error } = await supabase.from("target_objects").delete().eq("id", targetId);
      if (!error) {
        addLog(`대상물 삭제 완료: ${name}`, "info");
        setTargets(prev => prev.filter(t => t.id !== targetId));
        if (selectedTarget?.id === targetId) setSelectedTarget(null);
      }
    } catch (err) {
      console.error("Delete target failed:", err);
    }
  };


  const handleLoadSnapshot = (snapshot) => {
    const { data } = snapshot;
    setDeployed(data.deployed || {});
    setHoseLinks(data.hoseLinks || []);
    setWaterSprayLinks(data.waterSprayLinks || []);
    setAccidentPos(data.accidentPos);
    setAccidentAddress(data.accidentAddress);
    
    // 추가 전술 상태 복구 (기존 스냅샷 호환 처리)
    setHydrantVisible(data.hydrantVisible || false);
    setHydrantRadius(data.hydrantRadius || null);
    setHydrantCaptureLinks(data.hydrantCaptureLinks || []);
    setMciPos(data.mciPos || null);
    setIsMciLocked(data.isMciLocked || false);
    setStagingPos(data.stagingPos || null);
    setIsStagingLocked(data.isStagingLocked || false);

    addLog(`전술 스냅샷 불러오기 완료: ${snapshot.name}`, "info");
    setShowUtilityModal(false);

    if (kakaoMap && data.accidentPos) {
      kakaoMap.panTo(new window.kakao.maps.LatLng(data.accidentPos.lat, data.accidentPos.lng));
      kakaoMap.setLevel(2);
    }
  };

  const UTILITY_MENU_ITEMS = [
    { key: "staging", label: "자원집결지", desc: "출동 자원의 효율적 관리", icon: <img src="/icons/fire-point.svg" alt="자원집결지" style={{ width: 28, height: 28 }} />, color: "#f97316", gradient: "linear-gradient(135deg, #ea580c, #f97316)" },
    { key: "mci", label: "다수사상자 대응 (MCI)", desc: "임시의료소 설치 / 실시간 환자 관리", icon: "🚑", color: "#f97316", gradient: "linear-gradient(135deg, #9a3412, #f97316)" },
    { key: "calc", label: "방수압력 계산기", desc: "고층화재 층수/호스별 최적 압력", icon: "🧮", color: "#3b82f6", gradient: "linear-gradient(135deg, #1e3a8a, #3b82f6)" },
    { key: "forest_fire", label: "산불진화", desc: "지표화/수관화 분석 및 진화 전술", icon: "🌲", color: "#22c55e", gradient: "linear-gradient(135deg, #166534, #22c55e)" },
  ];

  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    const handleZoomChanged = () => setMapZoom(kakaoMap.getLevel());
    window.kakao.maps.event.addListener(kakaoMap, 'zoom_changed', handleZoomChanged);
    return () => window.kakao.maps.event.removeListener(kakaoMap, 'zoom_changed', handleZoomChanged);
  }, [kakaoMap]);

  // 지도 컨테이너 리사이즈 감지 (사이드바 슬라이드 대응)
  useEffect(() => {
    if (!mapRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setMapSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (kakaoMap) {
      kakaoMap.relayout();
    }
  }, [mapSize, kakaoMap]);

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

  const sortedCenters = useMemo(() => {
    if (!selectedDistrict) return centers;
    return [...centers].sort((a, b) => {
      // 우선순위 정의 (숫자가 낮을수록 상단)
      const getPriority = (center) => {
        if (center.name === selectedDistrict.jurisdictional) return 0;
        if (center.name === "구조대") return 1;
        if (["삼랑진119안전센터", "경남소방본부"].includes(center.name)) return 3;
        if (center.name === "현장대응단") return 2;
        return 2;
      };

      const prioA = getPriority(a);
      const prioB = getPriority(b);

      if (prioA !== prioB) return prioA - prioB;

      // 동일 우선순위(일반 센터군 또는 하단 센터군 내)일 경우 거리순 정렬
      const distA = getDistance(selectedDistrict.center.lat, selectedDistrict.center.lng, a.lat, a.lng);
      const distB = getDistance(selectedDistrict.center.lat, selectedDistrict.center.lng, b.lat, b.lng);
      return distA - distB;
    });
  }, [centers, selectedDistrict]);

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

  // ManageScreen 복귀 시 화점으로 줌 이동 (레벨 2 ≈ 30m)
  useEffect(() => {
    if (kakaoMap && accidentPos && isAccidentLocked) {
      try {
        kakaoMap.setLevel(2);
        kakaoMap.panTo(new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng));
      } catch (err) { console.error("Zoom to accident error:", err); }
    }
  }, [kakaoMap]);

  useEffect(() => {
    if (selectedDistrict && sortedCenters.length > 0) {
      setExpandedCenters(prev => {
        if (Object.keys(prev).length > 0) return prev;
        const initial = {};
        sortedCenters.forEach(c => { initial[c.id] = false; });
        return initial;
      });
    }
  }, [selectedDistrict, sortedCenters, setExpandedCenters]);

  // 마커 오버레이 동기화
  useEffect(() => {
    if (!kakaoMap || !window.kakao || !window.kakao.maps) return;
    try {
      overlaysRef.current.forEach(o => { if (o) o.setMap(null); });
      overlaysRef.current = [];

      Object.values(deployed).forEach(item => {
        if (!item.lat || !item.lng || isNaN(item.lat) || isNaN(item.lng)) return;
        const c = centers.find(center => center.id === item.center_id);
        const color = c?.color || "#ff4500";
        const compositeKey = `${item.itemType}_${item.id}`;
        const isSelected = selected === compositeKey;
        const content = document.createElement("div");
        content.style.cursor = "pointer";
        content.style.position = "relative";
        content.style.zIndex = isSelected ? "1000" : "10";

        const isDotMode = mapZoom >= 4;
        const markerHtml = isDotMode ? `
          <div style="width: 14px; height: 14px; background: ${color}; 
                      border: 2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.7)'}; 
                      border-radius: 50%; 
                      box-shadow: ${isSelected ? '0 0 15px ' + color : '0 2px 6px rgba(0,0,0,0.5)'}; 
                      transition: all 0.2s;" 
               title="${item.name}">
          </div>
        ` : `
          <div style="background: ${item.itemType === 'vehicle' ? '#1e2a3a' : '#2a1a1a'}; 
                      border: 2px solid ${isSelected ? '#fff' : color}; 
                      border-radius: ${item.itemType === 'vehicle' ? '8px' : '50%'}; 
                      padding: 6px 10px; display: flex; align-items: center; 
                      box-shadow: ${isSelected ? '0 0 20px ' + color : '0 4px 12px rgba(0,0,0,0.5)'}; 
                      white-space: nowrap; pointer-events: auto; user-select: none;
                      transition: all 0.2s;">
            <span style="font-size: 12px; font-weight: 600; color: #fff;">${item.name}</span>
          </div>
        `;
        content.innerHTML = markerHtml;

        const startDrag = (e) => {
          if (e.type === 'touchstart') e.preventDefault(); // 터치 시 스크롤 방지
          e.stopPropagation();
          const touch = e.touches ? e.touches[0] : e;
          const pos = { x: touch.clientX, y: touch.clientY };
          dragStartPosRef.current = pos;
          if (mapRef.current && kakaoMap) {
            const rect = mapRef.current.getBoundingClientRect();
            const cp = kakaoMap.getProjection().containerPointFromCoords(
              new window.kakao.maps.LatLng(item.lat, item.lng)
            );
            dragOffsetRef.current = {
              x: touch.clientX - (rect.left + cp.x),
              y: touch.clientY - (rect.top + cp.y)
            };
          } else {
            dragOffsetRef.current = { x: 0, y: 0 };
          }
          dragPayloadRef.current = { ...item, isMoving: true, fromMap: true };
        };
        content.addEventListener('mousedown', startDrag);
        content.addEventListener('touchstart', startDrag, { passive: false });

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(item.lat, item.lng),
          content: content,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: isSelected ? 2000 : 1000,
          clickable: true
        });
        overlay.setMap(kakaoMap);
        overlaysRef.current.push(overlay);
      });

      // 선택된 유닛 팝업
      if (selected && deployed[selected]) {
        const item = deployed[selected];
        const popupDiv = document.createElement("div");

        if (item.itemType === "vehicle") {
          popupDiv.style.cssText = `
            background: linear-gradient(145deg, #0e1e2e, #16263a);
            border: 1px solid #ff4500; border-radius: 14px; padding: 0;
            min-width: 220px; box-shadow: 0 20px 50px rgba(0,0,0,0.9);
            position: relative; color: #fff; margin-bottom: 25px;
            overflow: hidden; font-family: 'Pretendard', sans-serif;
          `;
          const header = document.createElement("div");
          header.style.cssText = "background: #1a2a3a; padding: 12px 16px; border-bottom: 1px solid #ff450033; display: flex; align-items: center; gap: 8px;";
          const iconHtml = VEHICLE_ICONS[item.type]?.startsWith("/")
            ? `<img src="${VEHICLE_ICONS[item.type]}" alt="${item.type}" style="width: 24px; height: 24px;" />`
            : VEHICLE_ICONS[item.type];
          header.innerHTML = `<span style="font-size: 20px; display: flex; align-items: center;">${iconHtml}</span> <span style="font-weight: 700; font-size: 15px; margin-left: 8px;">${item.name}</span>`;
          popupDiv.appendChild(header);

          const crewList = document.createElement("div");
          crewList.style.cssText = "padding: 12px; max-height: 180px; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y;";
          const vehicleCrew = personnel.filter(p => p.vehicle_id === item.id && !deployed[`personnel_${p.id}`]);
          if (vehicleCrew.length > 0) {
            const crewTitle = document.createElement("div");
            crewTitle.style.cssText = "font-size: 11px; color: #7ec8e3; margin-bottom: 8px; font-weight: 600;";
            crewTitle.innerText = `탑승 대원 (${vehicleCrew.length}명)`;
            crewList.appendChild(crewTitle);
            vehicleCrew.forEach(p => {
              const crewItem = document.createElement("div");
              crewItem.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: #0a1828; border-radius: 6px; margin-bottom: 4px; border: 1px solid #1e3a52; cursor: grab; touch-action: pan-y;";
              crewItem.innerHTML = `<span style="font-size: 14px; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px;"><img src="/icons/fireman.svg" alt="대원" style="width: 100%; height: 100%;" /></span> <span style="font-size: 13px;">${p.name}</span> <span style="font-size: 10px; color: #4a7a9b; border: 1px solid #1e3a52; padding: 1px 4px; border-radius: 4px;">${p.role}</span>`;
              const handleCrewDragStart = (e) => {
                // 터치 시 즉시 preventDefault 하지 않음 (스크롤을 위해)
                const isTouch = e.type === 'touchstart';
                const touch = isTouch ? e.touches[0] : e;

                const rect = e.currentTarget.getBoundingClientRect();
                dragOffsetRef.current = {
                  x: touch.clientX - (rect.left + rect.width / 2),
                  y: touch.clientY - (rect.top + rect.height / 2)
                };

                dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                const vehicle = vehicles.find(v => v.id === p.vehicle_id);
                dragPayloadRef.current = { ...p, itemType: "personnel", isMoving: false, center_id: vehicle?.center_id, fromPopup: true };
              };
              crewItem.onmousedown = handleCrewDragStart;
              crewItem.ontouchstart = handleCrewDragStart;
              crewList.appendChild(crewItem);
            });
          } else {
            crewList.innerHTML = `<div style="font-size: 12px; color: #4a7a9b; text-align: center; padding: 10px;">탑승 대원 없음</div>`;
          }
          popupDiv.appendChild(crewList);

          const actions = document.createElement("div");
          actions.style.cssText = "padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 6px; background: rgba(0,0,0,0.2);";
          const canExtendHose = ["pump", "tanker", "chemical", "forest"].includes(item.type) || item.name?.includes("동상사다리");
          if (canExtendHose) {
            // 행 1: 방수 | 수관연장
            const row1 = document.createElement("div");
            row1.style.cssText = "display: flex; gap: 6px; width: 100%;";

            // 방수 버튼
            const sprayBtn = document.createElement("button");
            const isSprayActive = waterSprayLinks.find(s => s.vehicleId === item.id);
            if (isSprayActive) {
              sprayBtn.innerText = "💧 방수 중단";
              sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #004a7c; border: 1px solid #009dff; color: #00ccff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              sprayBtn.onclick = (e) => {
                e.stopPropagation();
                setWaterSprayLinks(prev => prev.filter(s => s.vehicleId !== item.id));
                setSelected(null);
                addLog(`${item.name} 방수 중단`, "info");
              };
            } else {
              sprayBtn.innerText = "💧 방수";
              sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #002a4a; border: 1px solid #009dff55; color: #7ec8e3; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              sprayBtn.onclick = (e) => {
                e.stopPropagation();
                if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요.");
                setWaterSprayLinks(prev => [
                  ...prev.filter(s => s.vehicleId !== item.id),
                  { id: Date.now(), vehicleId: item.id }
                ]);
                setSelected(null);
                addLog(`${item.name} 방수 시작`, "info");
              };
            }
            row1.appendChild(sprayBtn);

            // 수관연장 버튼
            const hoseBtn = document.createElement("button");
            const existingLink = hoseLinks.find(l => l.fromId === item.id);
            if (existingLink) {
              hoseBtn.innerText = "수관 철수";
              hoseBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              hoseBtn.onclick = (e) => {
                e.stopPropagation();
                const toKey = Object.keys(deployed).find(k => deployed[k].id === existingLink.toId);
                const toName = toKey ? deployed[toKey].name : "차량";
                setShowConfirm({ type: "hose", linkId: existingLink.id, fromName: item.name, toName });
              };
            } else {
              hoseBtn.innerText = "수관 연장";
              hoseBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: crosshair;";
              const startHoseDrag = (e) => {
                e.preventDefault(); e.stopPropagation();
                const touch = e.touches ? e.touches[0] : e;
                setHoseDragSource(item.id);
                setDragPos({ x: touch.clientX, y: touch.clientY });
                setSelected(null);
              };
              hoseBtn.onpointerdown = startHoseDrag;
              hoseBtn.onmousedown = startHoseDrag;
              hoseBtn.ontouchstart = startHoseDrag;
            }
            row1.appendChild(hoseBtn);
            actions.appendChild(row1);

            // 행 2: 소화전점령 | 수량
            const row2 = document.createElement("div");
            row2.style.cssText = "display: flex; gap: 6px; width: 100%;";

            // 소화전 점령 버튼
            const captureBtn = document.createElement("button");
            const existingCapture = hydrantCaptureLinks.find(l => l.vehicleId === item.id);
            if (existingCapture) {
              captureBtn.innerText = "🔥 점령 해제";
              captureBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              captureBtn.onclick = (e) => {
                e.stopPropagation();
                setShowConfirm({ type: "hydrant-release", vehicleId: item.id, vehicleName: item.name });
              };
            } else {
              captureBtn.innerText = "🔥 소화전 점령";
              captureBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: crosshair;";
              const startCaptureDrag = (e) => {
                e.preventDefault(); e.stopPropagation();
                const touch = e.touches ? e.touches[0] : e;
                setHydrantDragSource(item.id);
                setDragPos({ x: touch.clientX, y: touch.clientY });
                setSelected(null);
              };
              captureBtn.onpointerdown = startCaptureDrag;
              captureBtn.onmousedown = startCaptureDrag;
              captureBtn.ontouchstart = startCaptureDrag;
            }
            row2.appendChild(captureBtn);

            // 수량 버튼
            if (item.water_capacity > 0 || item.name?.includes("동상사다리")) {
              const waterInfo = document.createElement("div");
              waterInfo.innerText = `수량: ${item.water_capacity || 0}L`;
              waterInfo.style.cssText = "flex: 1; background: #004a7c; border: 1px solid #009dff; border-radius: 6px; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; cursor: pointer;";
              waterInfo.onclick = (e) => {
                e.stopPropagation();
                setShowWaterAdjust({ id: item.id, name: item.name, current: item.water_capacity });
              };
              row2.appendChild(waterInfo);
            }
            actions.appendChild(row2);

            // 행 3: 현장 철수 (전체 너비)
            const recallBtn = document.createElement("button");
            recallBtn.innerText = "🚨 현장 철수";
            recallBtn.style.cssText = "width: 100%; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
            recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name }); };
            actions.appendChild(recallBtn);
          } else {
            // 수관 없는 차량: 현장 철수만 전체 너비
            const recallBtn = document.createElement("button");
            recallBtn.innerText = "🚨 현장 철수";
            recallBtn.style.cssText = "width: 100%; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
            recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name, itemType: item.itemType }); };
            actions.appendChild(recallBtn);
          }
          popupDiv.appendChild(actions);
        } else {
          popupDiv.style.cssText = `
            background: linear-gradient(135deg, #0e1e2e, #16263a);
            border: 1px solid #ff4500; border-radius: 12px; padding: 16px;
            min-width: 180px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            position: relative; color: #fff; text-align: center; margin-bottom: 20px;
          `;
          const title = document.createElement("div");
          title.style.cssText = "font-size: 16px; font-weight: 700; margin-bottom: 4px;";
          title.innerText = item.name;
          popupDiv.appendChild(title);
          const sub = document.createElement("div");
          sub.style.cssText = "font-size: 11px; color: #7ec8e3; margin-bottom: 12px;";
          sub.innerText = item.itemType === "vehicle" ? VEHICLE_LABELS[item.type] : item.role;
          popupDiv.appendChild(sub);
          const recallBtn = document.createElement("button");
          recallBtn.innerText = "🚨 현장 철수";
          recallBtn.style.cssText = "width: 100%; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff4500; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
          recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name, itemType: item.itemType }); };
          popupDiv.appendChild(recallBtn);
        }

        const closeBtn = document.createElement("div");
        closeBtn.innerText = "✕";
        closeBtn.style.cssText = "position: absolute; top: 6px; right: 10px; color: #4a7a9b; cursor: pointer; font-size: 24px; z-index: 10; line-height: 1;";
        closeBtn.onclick = (e) => { e.stopPropagation(); setSelected(null); };
        popupDiv.appendChild(closeBtn);

        const arrow = document.createElement("div");
        arrow.style.cssText = "position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #ff4500;";
        popupDiv.appendChild(arrow);

        const popupOverlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(item.lat, item.lng),
          content: popupDiv,
          yAnchor: 1.05,
          zIndex: 10000,
          clickable: true
        });
        popupOverlay.setMap(kakaoMap);
        overlaysRef.current.push(popupOverlay);
      }
    } catch (err) {
      console.error("Overlay sync error:", err);
    }
  }, [kakaoMap, deployed, selected, mapZoom, centers, personnel, waterSprayLinks, hoseLinks, hydrantCaptureLinks]);

  // document 레벨 마우스/터치 핸들러
  useEffect(() => {
    const onMove = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      if (hoseDragSource || hydrantDragSource) {
        if (e.cancelable) e.preventDefault();
        setDragPos({ x: touch.clientX, y: touch.clientY });
        return;
      }
      if (dragging) {
        if (e.cancelable) e.preventDefault();
        setDragPos({ x: touch.clientX, y: touch.clientY });
        return;
      }
      if (!dragPayloadRef.current || !dragStartPosRef.current) return;

      const dx = touch.clientX - dragStartPosRef.current.x;
      const dy = touch.clientY - dragStartPosRef.current.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // 모바일 최적화: 방향 무관 10px 이상 이동 시 드래그 시작
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        // 우측 리스트에서만 세로 스크롤 허용 (지도 유닛·팝업 대원 드래그는 모든 방향 허용)
        const isListDrag = !dragPayloadRef.current?.fromPopup && !dragPayloadRef.current?.fromMap;
        if (absY > absX * 1.5 && isListDrag) {
          dragPayloadRef.current = null;
          dragStartPosRef.current = null;
          return;
        }
        setDragging(dragPayloadRef.current);
        if (!dragPayloadRef.current?.fromPopup) setSelected(null);
        if (e.cancelable) e.preventDefault();
      }
    };

    const onUp = async (e) => {
      const touch = e.changedTouches ? e.changedTouches[0] : e;

      // 소화전 점령 드래그 드랍
      if (hydrantDragSource && mapRef.current && kakaoMap) {
        const rect = mapRef.current.getBoundingClientRect();
        const dropX = touch.clientX - rect.left;
        const dropY = touch.clientY - rect.top;
        // 가장 가까운 소화전 마커 찾기 (40px 이내)
        let targetHydrant = null;
        let minDist = 40;
        // 현재 표시 중인 소화전만 검색
        if (accidentPos && hydrantRadius) {
          const nearby = HYDRANT_DATA.filter(h => getDistance(accidentPos.lat, accidentPos.lng, h.lat, h.lng) <= hydrantRadius / 1000);
          nearby.forEach(h => {
            const hp = kakaoMap.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(h.lat, h.lng));
            const d = Math.sqrt((hp.x - dropX) ** 2 + (hp.y - dropY) ** 2);
            if (d < minDist) { minDist = d; targetHydrant = h; }
          });
        }
        if (targetHydrant) {
          setHydrantCaptureLinks(prev => [
            ...prev.filter(l => l.vehicleId !== hydrantDragSource && l.hydrantId !== targetHydrant.id),
            { id: Date.now(), vehicleId: hydrantDragSource, hydrantId: targetHydrant.id, hydrantLat: targetHydrant.lat, hydrantLng: targetHydrant.lng }
          ]);
          const vName = deployed[`vehicle_${hydrantDragSource}`]?.name || "차량";
          addLog(`${vName} → 소화전 ${targetHydrant.code} 점령`, "info");
        }
        setHydrantDragSource(null);
        setDragPos(null);
        dragPayloadRef.current = null;
        dragStartPosRef.current = null;
        return;
      }

      if (hoseDragSource && mapRef.current && kakaoMap) {
        const rect = mapRef.current.getBoundingClientRect();
        const point = new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top);
        const latlng = kakaoMap.getProjection().coordsFromContainerPoint(point);
        // 픽셀 기반 정밀 타겟 매칭
        let targetVehicleId = null;
        let minPixelDist = 40; // 최대 40px 반경 이내만 허용

        Object.keys(deployed).forEach(compositeKey => {
          const d = deployed[compositeKey];
          if (d.itemType !== 'vehicle' || d.id === hoseDragSource) return;

          // 지도상의 위경도를 화면 픽셀 좌표로 변환
          const vehiclePos = kakaoMap.getProjection().containerPointFromCoords(
            new window.kakao.maps.LatLng(d.lat, d.lng)
          );
          const dropPos = new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top);

          const dx = vehiclePos.x - dropPos.x;
          const dy = vehiclePos.y - dropPos.y;
          const pixelDist = Math.sqrt(dx * dx + dy * dy);

          if (pixelDist < minPixelDist) {
            minPixelDist = pixelDist;
            targetVehicleId = d.id;
          }
        });

        if (targetVehicleId) {
          setHoseLinks(prev => [
            ...prev.filter(l => !(l.fromId === hoseDragSource && l.toId === targetVehicleId)),
            { id: Date.now(), fromId: hoseDragSource, toId: targetVehicleId }
          ]);
          const fromName = deployed[`vehicle_${hoseDragSource}`]?.name || "차량";
          const toName = deployed[`vehicle_${targetVehicleId}`]?.name || "차량";
          addLog(`${fromName} → ${toName} 수관 연장됨`, "info");
        }
      } else if (dragPayloadRef.current) {
        const data = dragPayloadRef.current;
        if (!dragging) {
          const compositeKey = `${data.itemType}_${data.id}`;
          setSelected(prev => (prev === compositeKey) ? null : compositeKey);
        } else if (mapRef.current && kakaoMap) {
          // 실제 드래그 시에만 선택 해제
          setSelected(null);
          const rect = mapRef.current.getBoundingClientRect();
          const isOverMap = touch.clientX >= rect.left && touch.clientX <= rect.right
            && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
          if (isOverMap) {
            try {
              const adjustedX = touch.clientX - dragOffsetRef.current.x - rect.left;
              const adjustedY = touch.clientY - dragOffsetRef.current.y - rect.top;
              const latlng = kakaoMap.getProjection().coordsFromContainerPoint(new window.kakao.maps.Point(adjustedX, adjustedY));
              if (latlng) {
                const lat = latlng.getLat(), lng = latlng.getLng();
                if (!isNaN(lat) && !isNaN(lng)) {
                  const compositeKey = `${data.itemType}_${data.id}`;
                  setDeployed(prev => ({ ...prev, [compositeKey]: { ...(prev[compositeKey] || data), lat, lng, itemType: data.itemType } }));
                  await saveDeployment(data.id, data.itemType, lat, lng);
                  addLog(`${data.name} ${data.isMoving ? "위치 이동" : "현장 배치"}`, data.isMoving ? "move" : "deploy");
                }
              }
            } catch (err) { console.error(err); }
          } else {
            // 지도 밖으로 드롭 시 철수 (Recall)
            if (data.itemType === "personnel") {
              // 대원은 즉시 철수
              const comboKey = `personnel_${data.id}`;
              setDeployed(prev => {
                const next = { ...prev };
                delete next[comboKey];
                return next;
              });
              await removeDeployment(data.id, "personnel");
              addLog(`${data.name} 철수 완료`, "recall");
            } else if (data.itemType === "vehicle") {
              // 차량은 확인 모달 후 철수
              setShowConfirm({ type: "recall", id: data.id, name: data.name, itemType: "vehicle" });
            }
          }
        }
      }

      setHoseDragSource(null);
      setHydrantDragSource(null);
      setDragPos(null);
      setDragging(null);
      dragPayloadRef.current = null;
      dragStartPosRef.current = null;
      dragOffsetRef.current = { x: 0, y: 0 };
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [kakaoMap, dragging, hoseDragSource, hydrantDragSource, deployed]);

  // 화점 마커
  useEffect(() => {
    if (!kakaoMap || !accidentPos || !window.kakao || !window.kakao.maps) return;
    if (isNaN(accidentPos.lat) || isNaN(accidentPos.lng)) return;
    try {
      const pos = new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng);
      if (!fireMarkerRef.current) {
        const marker = new window.kakao.maps.Marker({
          position: pos, draggable: !isAccidentLocked, zIndex: 1500,
          image: new window.kakao.maps.MarkerImage(
            'https://cdn-icons-png.flaticon.com/512/785/785116.png',
            new window.kakao.maps.Size(45, 45),
            { offset: new window.kakao.maps.Point(22, 22) }
          )
        });
        window.kakao.maps.event.addListener(marker, 'dragend', () => {
          const latlng = marker.getPosition();
          const nextPos = { lat: latlng.getLat(), lng: latlng.getLng() };
          if (!isNaN(nextPos.lat) && !isNaN(nextPos.lng)) setAccidentPos(nextPos);
        });
        marker.setMap(kakaoMap);
        fireMarkerRef.current = marker;
      } else {
        fireMarkerRef.current.setPosition(pos);
        fireMarkerRef.current.setDraggable(!isAccidentLocked);
        fireMarkerRef.current.setMap(kakaoMap);
      }
      if (isAccidentLocked) document.body.classList.add('fire-locked');
      else document.body.classList.remove('fire-locked');

      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(accidentPos.lng, accidentPos.lat, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const addr = result[0].road_address ? result[0].road_address.address_name : result[0].address.address_name;
          setAccidentAddress(addr);
        } else {
          setAccidentAddress(`주소 미확인지 지역 (${accidentPos.lat.toFixed(4)}, ${accidentPos.lng.toFixed(4)})`);
        }
      });
    } catch (err) {
      console.error("Fire marker sync error:", err);
    }
  }, [kakaoMap, accidentPos, isAccidentLocked]);

  // MCI 마커 (Native Marker 적용)
  useEffect(() => {
    if (!kakaoMap || !mciPos || !window.kakao || !mciSetupStarted) {
      if (mciMarkerRef.current) mciMarkerRef.current.setMap(null);
      mciMarkerRef.current = null;
      return;
    }
    try {
      const pos = new window.kakao.maps.LatLng(mciPos.lat, mciPos.lng);
      if (!mciMarkerRef.current) {
        const marker = new window.kakao.maps.Marker({
          position: pos,
          draggable: !isMciLocked,
          zIndex: 1600,
          image: new window.kakao.maps.MarkerImage(
            '/icons/hospital.svg',
            new window.kakao.maps.Size(48, 48),
            { offset: new window.kakao.maps.Point(24, 24) }
          )
        });
        window.kakao.maps.event.addListener(marker, 'dragend', () => {
          const latlng = marker.getPosition();
          setMciPos({ lat: latlng.getLat(), lng: latlng.getLng() });
        });
        window.kakao.maps.event.addListener(marker, 'click', () => {
          if (isMciLockedRef.current) {
            setUtilityTab("mci");
            setShowUtilityModal(true);
            setMciFromBadge(true);
          }
        });
        marker.setMap(kakaoMap);
        mciMarkerRef.current = marker;
      } else {
        mciMarkerRef.current.setPosition(pos);
        mciMarkerRef.current.setDraggable(!isMciLocked);
        mciMarkerRef.current.setMap(kakaoMap);
      }

      if (isMciLocked) document.body.classList.add('mci-locked');
      else document.body.classList.remove('mci-locked');

    } catch (err) { console.error("MCI Marker Error:", err); }
  }, [kakaoMap, mciPos, mciSetupStarted, isMciLocked]);

  // 자원집결지 마커 (Native Marker 적용)
  useEffect(() => {
    if (!kakaoMap || !stagingPos || !window.kakao || !stagingSetupStarted) {
      if (stagingMarkerRef.current) stagingMarkerRef.current.setMap(null);
      stagingMarkerRef.current = null;
      return;
    }
    try {
      const pos = new window.kakao.maps.LatLng(stagingPos.lat, stagingPos.lng);
      if (!stagingMarkerRef.current) {
        const marker = new window.kakao.maps.Marker({
          position: pos,
          draggable: !isStagingLocked,
          zIndex: 1650,
          image: new window.kakao.maps.MarkerImage(
          '/icons/fire-point.svg', // 자원집결지에 fire-point.svg 아이콘 적용
            new window.kakao.maps.Size(42, 42),
            { offset: new window.kakao.maps.Point(10, 42) } // 깃발 기둥 하단 기준
          )
        });
        window.kakao.maps.event.addListener(marker, 'dragend', () => {
          const latlng = marker.getPosition();
          setStagingPos({ lat: latlng.getLat(), lng: latlng.getLng() });
        });
        window.kakao.maps.event.addListener(marker, 'click', () => {
          if (isStagingLockedRef.current) {
            setSelected("staging-site");
          }
        });
        marker.setMap(kakaoMap);
        stagingMarkerRef.current = marker;
      } else {
        stagingMarkerRef.current.setPosition(pos);
        stagingMarkerRef.current.setDraggable(!isStagingLocked);
        stagingMarkerRef.current.setMap(kakaoMap);
      }
    } catch (err) { console.error("Staging Marker Error:", err); }
  }, [kakaoMap, stagingPos, stagingSetupStarted, isStagingLocked]);

  // 수관 SVG 렌더링
  useEffect(() => {
    if (!kakaoMap || !window.kakao || !mapRef.current) return;
    hoseLinesRef.current.forEach(line => {
      if (line.setMap) line.setMap(null);
    });
    hoseLinesRef.current = [];

    const createHoseSVG = (fromLatLng, toLatLng, isPreview = false, linkId = null, fromName = "", toName = "") => {
      const proj = kakaoMap.getProjection();
      const p1 = proj.containerPointFromCoords(fromLatLng);
      const p2 = proj.containerPointFromCoords(toLatLng);
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 1) return null;

      // 앵커: 중간 위경도 (한쪽 차량이 화면 밖이어도 중간점이 화면 안이면 표시됨)
      const midLatLng = new window.kakao.maps.LatLng(
        (fromLatLng.getLat() + toLatLng.getLat()) / 2,
        (fromLatLng.getLng() + toLatLng.getLng()) / 2
      );
      const pm = proj.containerPointFromCoords(midLatLng);

      // p1, p2를 midPoint 기준 상대좌표로
      const r1x = p1.x - pm.x, r1y = p1.y - pm.y;
      const r2x = p2.x - pm.x, r2y = p2.y - pm.y;
      const rdx = r2x - r1x, rdy = r2y - r1y;

      // linkId 기반 시드
      const seed = linkId ? parseInt(String(linkId).slice(-6), 10) : 1234;
      const rng = (i) => ((seed * 9301 + i * 49297 + 233) % 233280) / 233280;

      // 수직 단위벡터
      const nx = -rdy / length, ny = rdx / length;
      const amp = Math.min(length * 0.18, 45);
      const segments = 4;

      // 중간 웨이포인트 (midPoint 기준 상대좌표)
      const relPts = [{ x: r1x, y: r1y }];
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const sign = (i % 2 === 0 ? 1 : -1) * (rng(i) > 0.5 ? 1 : -1);
        const mag = amp * (0.6 + rng(i + 10) * 0.8);
        relPts.push({
          x: r1x + rdx * t + nx * sign * mag,
          y: r1y + rdy * t + ny * sign * mag
        });
      }
      relPts.push({ x: r2x, y: r2y });

      // bounding box
      const xs = relPts.map(p => p.x), ys = relPts.map(p => p.y);
      const pad = 20;
      const bMinX = Math.min(...xs) - pad, bMinY = Math.min(...ys) - pad;
      const bMaxX = Math.max(...xs) + pad, bMaxY = Math.max(...ys) + pad;
      const W = bMaxX - bMinX, H = bMaxY - bMinY;

      // SVG 내 좌표
      const svgPts = relPts.map(p => ({ x: p.x - bMinX, y: p.y - bMinY }));
      const sx1 = svgPts[0].x, sy1 = svgPts[0].y;
      const sx2 = svgPts[svgPts.length - 1].x, sy2 = svgPts[svgPts.length - 1].y;

      // Cubic bezier 경로
      let pathD = `M ${sx1} ${sy1}`;
      for (let i = 0; i < svgPts.length - 1; i++) {
        const a = svgPts[i], b = svgPts[i + 1];
        const prev = svgPts[i - 1] || a;
        const next = svgPts[i + 2] || b;
        pathD += ` C ${a.x + (b.x - prev.x) * 0.25} ${a.y + (b.y - prev.y) * 0.25} ${b.x - (next.x - a.x) * 0.25} ${b.y - (next.y - a.y) * 0.25} ${b.x} ${b.y}`;
      }

      // 화살표
      const last = svgPts[svgPts.length - 2];
      const arrowRad = Math.atan2(sy2 - last.y, sx2 - last.x);
      const aLen = 11;
      const ax1 = sx2 - aLen * Math.cos(arrowRad - 0.38);
      const ay1 = sy2 - aLen * Math.sin(arrowRad - 0.38);
      const ax2 = sx2 - aLen * Math.cos(arrowRad + 0.38);
      const ay2 = sy2 - aLen * Math.sin(arrowRad + 0.38);

      const midPt = svgPts[Math.floor(svgPts.length / 2)];
      const uid = `hose_${linkId || 'prev'}`;

      const content = document.createElement("div");
      content.style.cssText = `
        position: absolute;
        width: ${W}px; height: ${H}px;
        transform: translate(${bMinX}px, ${bMinY}px);
        pointer-events: none;
        z-index: ${isPreview ? 51 : 50};
      `;
      content.innerHTML = `
        <style>
          @keyframes hoseFlow_${uid} { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -50; } }
        </style>
        <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <path d="${pathD}" fill="none" stroke="#007bff" stroke-width="7"
            stroke-linecap="round" stroke-linejoin="round" opacity="0.2"/>
          <path d="${pathD}" fill="none" stroke="#00aaff" stroke-width="3.5"
            stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray="${isPreview ? '8,8' : '20,10'}"
            style="animation: hoseFlow_${uid} 0.7s linear infinite;"/>
          <polygon points="${sx2},${sy2} ${ax1},${ay1} ${ax2},${ay2}" fill="#00aaff" opacity="0.9"/>
          ${!isPreview && linkId ? `<circle cx="${midPt.x}" cy="${midPt.y}" r="16" fill="transparent" style="pointer-events:auto; cursor:pointer;"/>` : ''}
        </svg>
      `;
      if (!isPreview && linkId) {
        const circle = content.querySelector('circle');
        if (circle) circle.addEventListener('click', (e) => {
          e.stopPropagation();
          setShowConfirm({ type: "hose", linkId, fromName, toName });
        });
      }
      return new window.kakao.maps.CustomOverlay({
        position: midLatLng, content,
        xAnchor: 0, yAnchor: 0,
        zIndex: isPreview ? 51 : 50
      });
    };

    hoseLinks.forEach(link => {
      const fromKey = `vehicle_${link.fromId}`;
      const toKey = `vehicle_${link.toId}`;
      const from = deployed[fromKey], to = deployed[toKey];
      if (from && to) {
        const overlay = createHoseSVG(
          new window.kakao.maps.LatLng(from.lat, from.lng),
          new window.kakao.maps.LatLng(to.lat, to.lng),
          false, link.id, from.name, to.name
        );
        if (overlay) { overlay.setMap(kakaoMap); hoseLinesRef.current.push(overlay); }
      }
    });

    if (hoseDragSource && dragPos && deployed[`vehicle_${hoseDragSource}`] && mapRef.current) {
      const from = deployed[`vehicle_${hoseDragSource}`];
      const rect = mapRef.current.getBoundingClientRect();
      const latlng = kakaoMap.getProjection().coordsFromContainerPoint(
        new window.kakao.maps.Point(dragPos.x - rect.left, dragPos.y - rect.top)
      );
      if (latlng) {
        const overlay = createHoseSVG(new window.kakao.maps.LatLng(from.lat, from.lng), latlng, true);
        if (overlay) { overlay.setMap(kakaoMap); hoseLinesRef.current.push(overlay); }
      }
    }
  }, [kakaoMap, hoseLinks, deployed, hoseDragSource, dragPos, mapZoom, mapSize]);

  // 방수 점선 렌더링
  useEffect(() => {
    if (!kakaoMap || !window.kakao || !mapRef.current) return;
    waterSprayRef.current.forEach(o => o.setMap(null));
    waterSprayRef.current = [];
    if (!accidentPos) return;

    waterSprayLinks.forEach(link => {
      const vehicleKey = `vehicle_${link.vehicleId}`;
      const vehicle = deployed[vehicleKey];
      if (!vehicle) return;

      const proj = kakaoMap.getProjection();
      const vp = proj.containerPointFromCoords(new window.kakao.maps.LatLng(vehicle.lat, vehicle.lng));
      const ap = proj.containerPointFromCoords(new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng));
      const angle = Math.atan2(ap.y - vp.y, ap.x - vp.x) * 180 / Math.PI;

      // 거리 자동 계산: 차량에서 화점까지의 픽셀 거리
      const dx = ap.x - vp.x;
      const dy = ap.y - vp.y;
      const r = Math.sqrt(dx * dx + dy * dy);

      const uid = `spray_${link.vehicleId}`;
      const svgSize = r * 2 + 60;
      const cx = svgSize / 2, cy = svgSize / 2;

      // 45도 범위 내 6개 점선 (중앙 굵은 줄 제거를 위해 i=0 제외 또는 각도 조정)
      // 기존 -20, -13, -6, 0, 6, 13, 20에서 0(중앙)을 제외하거나 스타일 통일
      const lines = [-20, -12, -5, 5, 12, 20].map((deg, i) => {
        const rad = deg * Math.PI / 180;
        const ex = cx + r * Math.cos(rad);
        const ey = cy + r * Math.sin(rad);
        const delay = i * 0.08;
        return `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}"
          stroke="#007bff"
          stroke-width="2"
          stroke-opacity="0.6"
          stroke-dasharray="10 8"
          style="animation: sprayFlow_${uid} 0.5s linear infinite; animation-delay: -${delay}s;"/>`;
      }).join('');

      const content = document.createElement("div");
      content.style.cssText = `
        position: absolute;
        width: ${svgSize}px; height: ${svgSize}px;
        transform: translate(-50%, -50%) rotate(${angle}deg);
        pointer-events: none;
        z-index: 40;
      `;
      content.innerHTML = `
        <style>
          @keyframes sprayFlow_${uid} {
            0%   { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -36; }
          }
        </style>
        <svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">
          ${lines}
          <circle cx="${cx}" cy="${cy}" r="4" fill="#00aaff" opacity="0.8"/>
        </svg>
      `;

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(vehicle.lat, vehicle.lng),
        content,
        xAnchor: 0.5, yAnchor: 0.5,
        zIndex: 40
      });
      overlay.setMap(kakaoMap);
      waterSprayRef.current.push(overlay);
    });
  }, [kakaoMap, waterSprayLinks, deployed, accidentPos, mapZoom, mapSize]);

  // 소화전 마커 렌더링
  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    hydrantMarkersRef.current.forEach(o => o.setMap(null));
    hydrantMarkersRef.current = [];
    if (!hydrantVisible || !accidentPos || !hydrantRadius) return;
    const nearby = HYDRANT_DATA.filter(h => {
      const d = getDistance(accidentPos.lat, accidentPos.lng, h.lat, h.lng);
      return d <= hydrantRadius / 1000;
    });

    // 배치 차량 목록 (거리 계산용)
    const deployedVehicles = Object.values(deployed).filter(d => d.itemType === 'vehicle');

    const isDotMode = mapZoom >= 4;

    nearby.forEach(h => {
      const pos = new window.kakao.maps.LatLng(h.lat, h.lng);
      const isCaptured = hydrantCaptureLinks.some(l => l.hydrantId === h.id);
      const uid = `hyd_${h.id}`;

      const el = document.createElement("div");

      if (isDotMode) {
        // 점 모드: 빨간 점
        el.style.cssText = `cursor:pointer; width:8px; height:8px; border-radius:50%; background:${isCaptured ? '#ff4500' : '#ff4444'}; box-shadow:0 0 4px ${isCaptured ? '#ff4500aa' : '#ff444488'};`;
      } else if (isCaptured) {
        // 물방울 3개: 각도/높이/딜레이 랜덤
        const drops = [
          { x: -8, delay: 0, dur: 0.9 },
          { x: 0, delay: 0.3, dur: 1.1 },
          { x: 8, delay: 0.15, dur: 1.0 },
        ];
        const dropSvg = drops.map((d, i) => `
          <circle cx="${16 + d.x}" cy="0" r="3" fill="#00aaff" opacity="0.9"
            style="animation: dropUp_${uid}_${i} ${d.dur}s ease-out ${d.delay}s infinite;">
          </circle>
        `).join('');
        const keyframes = drops.map((d, i) => `
          @keyframes dropUp_${uid}_${i} {
            0%   { transform: translateY(0px) scaleY(1); opacity: 0.9; }
            60%  { transform: translateY(-12px) scaleY(1.3); opacity: 0.6; }
            100% { transform: translateY(-20px) scaleY(0.6); opacity: 0; }
          }
        `).join('');
        el.style.cssText = "cursor:pointer; position:relative; display:flex; align-items:flex-end; justify-content:center;";
        el.innerHTML = `
          <style>${keyframes}</style>
          <svg width="32" height="32" style="position:absolute;top:-20px;left:0;overflow:visible;pointer-events:none;">
            ${dropSvg}
          </svg>
          <img src="/icons/hydrant.svg" style="width:32px;height:32px;" />
        `;
      } else {
        el.innerHTML = `<img src="/icons/hydrant.svg" style="width:28px;height:28px;" />`;
      }

      el._popupOpen = false;
      el.onclick = (e) => {
        e.stopPropagation();
        // 이미 팝업 열려있으면 닫기
        if (el._popupOpen) {
          hydrantMarkersRef.current.forEach(o => { if (o._isPopup) o.setMap(null); });
          hydrantMarkersRef.current = hydrantMarkersRef.current.filter(o => !o._isPopup);
          el._popupOpen = false;
          return;
        }
        // 다른 팝업 닫기
        hydrantMarkersRef.current.forEach(o => { if (o._isPopup) o.setMap(null); });
        hydrantMarkersRef.current = hydrantMarkersRef.current.filter(o => !o._isPopup);
        el._popupOpen = true;

        // 배치된 물 관련 차량과 거리 계산 (펌프차, 탱크, 화학, 산불)
        const waterVehicleTypes = ["pump", "tanker", "chemical", "forest"];
        const vehicleDistances = deployedVehicles
          .filter(v => waterVehicleTypes.includes(v.type))
          .map(v => ({
            name: v.name,
            dist: Math.round(getDistance(h.lat, h.lng, v.lat, v.lng) * 1000)
          }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 2);

        const distHtml = vehicleDistances.length > 0
          ? vehicleDistances.map(v => `<div style="display:flex;justify-content:space-between;"><span>🚒 ${v.name}</span><span style="color:#ff4500;font-weight:700;">${v.dist}m</span></div>`).join('')
          : '<div style="color:#4a7a9b;">배치된 차량 없음</div>';

        const popup = document.createElement("div");
        popup.style.cssText = "background:linear-gradient(145deg,#0e1e2e,#16263a);border:1px solid #ff4500;border-radius:10px;padding:12px 14px;min-width:220px;color:#fff;font-family:Pretendard,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.8);margin-bottom:10px;position:relative;";
        const typeLabel = h.type || "";
        const addr = h.address || "-";
        const center = h.center || "-";
        const detail = h.detail ? `<div>ℹ️ ${h.detail}</div>` : "";
        popup.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;border-bottom:1px solid #1e3a52;padding-bottom:8px;">
            <img src="/icons/hydrant.svg" style="width:20px;height:20px;" />
            <span style="font-size:13px;font-weight:700;color:#ff7050;">소화전 ${h.code}</span>
            <span style="font-size:11px;background:#1e3a52;padding:2px 6px;border-radius:4px;color:#7ec8e3;">${typeLabel}</span>
          </div>
          <div style="font-size:12px;color:#a0c4d8;line-height:1.8;margin-bottom:8px;">
            <div>📍 ${addr}</div><div>🏢 ${center}</div>${detail}
          </div>
          <div style="border-top:1px solid #1e3a52;padding-top:8px;font-size:12px;display:flex;flex-direction:column;gap:4px;">${distHtml}</div>
          <div id="hclose" style="position:absolute;top:6px;right:10px;color:#4a7a9b;cursor:pointer;font-size:24px;z-index:10;line-height:1;">✕</div>
          <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid #ff4500;"></div>
        `;
        const popupOverlay = new window.kakao.maps.CustomOverlay({ position: pos, content: popup, xAnchor: 0.5, yAnchor: 1.08, zIndex: 20000, clickable: true });
        popupOverlay._isPopup = true;
        popupOverlay.setMap(kakaoMap);
        hydrantMarkersRef.current.push(popupOverlay);
        popup.querySelector("#hclose").onclick = (ev) => { ev.stopPropagation(); popupOverlay.setMap(null); hydrantMarkersRef.current = hydrantMarkersRef.current.filter(o => o !== popupOverlay); el._popupOpen = false; };
      };
      const overlay = new window.kakao.maps.CustomOverlay({ position: pos, content: el, xAnchor: 0.5, yAnchor: 0.5, zIndex: 5000, clickable: true });
      overlay.setMap(kakaoMap);
      hydrantMarkersRef.current.push(overlay);
    });
  }, [kakaoMap, hydrantVisible, hydrantRadius, accidentPos, hydrantCaptureLinks, deployed, mapZoom]);

  // 소화전 점령 연결선 렌더링
  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    hydrantLinesRef.current.forEach(o => o.setMap(null));
    hydrantLinesRef.current = [];
    if (!hydrantVisible || hydrantCaptureLinks.length === 0) return;

    hydrantCaptureLinks.forEach(link => {
      const vehicle = deployed[`vehicle_${link.vehicleId}`];
      if (!vehicle) return;

      const fromLatLng = new window.kakao.maps.LatLng(link.hydrantLat, link.hydrantLng); // 소화전→차량
      const toLatLng = new window.kakao.maps.LatLng(vehicle.lat, vehicle.lng);

      const proj = kakaoMap.getProjection();
      const p1 = proj.containerPointFromCoords(fromLatLng);
      const p2 = proj.containerPointFromCoords(toLatLng);
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 1) return;

      const midLatLng = new window.kakao.maps.LatLng(
        (link.hydrantLat + vehicle.lat) / 2,
        (link.hydrantLng + vehicle.lng) / 2
      );
      const pm = proj.containerPointFromCoords(midLatLng);
      const r1x = p1.x - pm.x, r1y = p1.y - pm.y;
      const r2x = p2.x - pm.x, r2y = p2.y - pm.y;
      const rdx = r2x - r1x, rdy = r2y - r1y;

      const seed = link.id ? parseInt(String(link.id).slice(-6), 10) : 5678;
      const rng = (i) => ((seed * 9301 + i * 49297 + 233) % 233280) / 233280;
      const nx = -rdy / length, ny = rdx / length;
      const amp = Math.min(length * 0.18, 45);

      const relPts = [{ x: r1x, y: r1y }];
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        const sign = (i % 2 === 0 ? 1 : -1) * (rng(i) > 0.5 ? 1 : -1);
        relPts.push({ x: r1x + rdx * t + nx * sign * amp * (0.6 + rng(i + 10) * 0.8), y: r1y + rdy * t + ny * sign * amp * (0.6 + rng(i + 10) * 0.8) });
      }
      relPts.push({ x: r2x, y: r2y });

      const xs = relPts.map(p => p.x), ys = relPts.map(p => p.y);
      const pad = 20;
      const bMinX = Math.min(...xs) - pad, bMinY = Math.min(...ys) - pad;
      const W = Math.max(...xs) + pad - bMinX, H = Math.max(...ys) + pad - bMinY;
      const svgPts = relPts.map(p => ({ x: p.x - bMinX, y: p.y - bMinY }));
      const sx1 = svgPts[0].x, sy1 = svgPts[0].y;
      const sx2 = svgPts[svgPts.length - 1].x, sy2 = svgPts[svgPts.length - 1].y;

      let pathD = `M ${sx1} ${sy1}`;
      for (let i = 0; i < svgPts.length - 1; i++) {
        const a = svgPts[i], b = svgPts[i + 1];
        const prev = svgPts[i - 1] || a, next = svgPts[i + 2] || b;
        pathD += ` C ${a.x + (b.x - prev.x) * 0.25} ${a.y + (b.y - prev.y) * 0.25} ${b.x - (next.x - a.x) * 0.25} ${b.y - (next.y - a.y) * 0.25} ${b.x} ${b.y}`;
      }

      const last = svgPts[svgPts.length - 2];
      const arrowRad = Math.atan2(sy2 - last.y, sx2 - last.x);
      const aLen = 11;
      const ax1 = sx2 - aLen * Math.cos(arrowRad - 0.38), ay1 = sy2 - aLen * Math.sin(arrowRad - 0.38);
      const ax2 = sx2 - aLen * Math.cos(arrowRad + 0.38), ay2 = sy2 - aLen * Math.sin(arrowRad + 0.38);
      const uid = `cap_${link.id}`;

      const content = document.createElement("div");
      content.style.cssText = `position:absolute;width:${W}px;height:${H}px;transform:translate(${bMinX}px,${bMinY}px);pointer-events:none;z-index:49;`;
      content.innerHTML = `
        <style>@keyframes capFlow_${uid}{from{stroke-dashoffset:0}to{stroke-dashoffset:-50}}</style>
        <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <path d="${pathD}" fill="none" stroke="#ff4500" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.2"/>
          <path d="${pathD}" fill="none" stroke="#ff4500" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray="20,10" style="animation:capFlow_${uid} 0.7s linear infinite;"/>
          <polygon points="${sx2},${sy2} ${ax1},${ay1} ${ax2},${ay2}" fill="#ff4500" opacity="0.9"/>
        </svg>
      `;
      const overlay = new window.kakao.maps.CustomOverlay({ position: midLatLng, content, xAnchor: 0, yAnchor: 0, zIndex: 49 });
      overlay.setMap(kakaoMap);
      hydrantLinesRef.current.push(overlay);
    });
  }, [kakaoMap, hydrantVisible, hydrantCaptureLinks, deployed, mapZoom, mapSize]);



  const moveToMyLocation = () => {
    if (!navigator.geolocation) return alert("GPS를 지원하지 않는 브라우저입니다.");
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setAccidentPos({ lat: latitude, lng: longitude });
      kakaoMap.panTo(new window.kakao.maps.LatLng(latitude, longitude));
      addLog("현재 위치로 사고 지점 이동 (GPS)", "info");
    });
  };

  const handleSaveLogs = () => {
    if (logs.length === 0) return alert("저장할 기록이 없습니다.");
    try {
      const csvRows = ["\uFEFF시간,유형,내용"];
      logs.forEach(log => {
        const cleanText = log.text.replace(/"/g, '""');
        csvRows.push(`${log.timestamp},${log.type},"${cleanText}"`);
        const initialDeployed = {};
        data.forEach(d => {
          let name = "Unknown";
          if (d.item_type === "vehicle") {
            const v = vehicles.find(v => v.id === d.item_id);
            if (v) name = v.name;
          } else {
            const p = personnel.find(p => p.id === d.item_id);
            if (p) name = p.name;
          }
          // 복합 키 사용: itemType_itemId (데이터 충돌 방지)
          const compositeKey = `${d.item_type}_${d.item_id}`;
          initialDeployed[compositeKey] = { id: d.item_id, itemType: d.item_type, lat: d.lat, lng: d.lng, name };
        });
        setDeployed(initialDeployed);
      });
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `현장활동기록_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 100);
    } catch (err) { alert("저장 중 오류가 발생했습니다: " + err.message); }
  };

  const handleResetLogs = async () => {
    const { error } = await supabase.from("situation_logs").delete().not("id", "is", null);
    if (error) alert("초기화 실패: " + error.message);
    else setLogs([]);
    setShowResetConfirm(false);
  };

  const removeDeployment = async (id, itemType) => {
    await supabase.from("deployments").delete().eq("item_id", id).eq("item_type", itemType);
  };

  const confirmRecall = async () => {
    if (!showConfirm) return;
    const itemType = showConfirm.itemType || 'vehicle';
    const comboKey = `${itemType}_${showConfirm.id}`;
    setDeployed(prev => {
      const next = { ...prev };
      delete next[comboKey];
      return next;
    });
    setWaterSprayLinks(prev => prev.filter(s => s.vehicleId !== showConfirm.id));
    await removeDeployment(showConfirm.id, itemType);
    addLog(`${showConfirm.name} 철수 완료`, "recall");
    setShowConfirm(null);
    setSelected(null);
  };

  const deployedIds = new Set(Object.keys(deployed));
  const vehicleDeployedIds = Object.values(deployed).filter(d => d.itemType === "vehicle").map(v => v.id);
  const totalPSet = new Set();
  Object.values(deployed).forEach(d => { if (d.itemType === "personnel") totalPSet.add(d.id.toString()); });
  const vehicleDeployedIdSet = new Set(vehicleDeployedIds.map(v => v.toString()));
  personnel.forEach(p => { if (vehicleDeployedIdSet.has(p.vehicle_id?.toString())) totalPSet.add(p.id.toString()); });
  const personnelDeployedCount = totalPSet.size;
  const vehicleDeployedCount = vehicleDeployedIds.length;

  return (
    <div style={{ width: "100%", height: "100vh", background: "#060d18", display: "flex", flexDirection: "column", fontFamily: "'Pretendard', sans-serif", color: "#e8eef5", overflow: "hidden" }}>
      {/* 헤더 */}
      <div style={{ height: 60, background: "linear-gradient(90deg, #0e1925, #091420)", borderBottom: "1px solid #1e3a52", display: "flex", alignItems: "center", padding: "0 16px", gap: 16, flexShrink: 0, boxShadow: "0 4px 20px #000000aa", zIndex: 100, filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
        <div onClick={() => setShowGlobalResetInit(true)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 8px", borderRadius: 8, transition: "background 0.2s", marginLeft: -4, width: 218, flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.background = "#ffffff08"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div style={{ fontSize: 32, filter: "drop-shadow(0 0 10px #ff450088)" }}>🔥</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "#ff6030" }}>FIRE COMMAND</div>
            <div style={{ fontSize: 10, color: "#4a7a9b", letterSpacing: 1, fontWeight: 500 }}>TABLET DISPATCHER PRO</div>
          </div>
        </div>
        <div style={{ background: "#ff450015", border: "1px solid #ff450040", borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4500", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 13, color: "#ff7050", fontWeight: 700 }}>LIVE</span>
          <span style={{ fontSize: 15, color: "#a0c4d8", marginLeft: 2 }}>{selectedDistrict?.name || "알 수 없는 지역"} 화재 출동</span>
          {isAccidentLocked && (
            <button onClick={() => setIsAccidentLocked(false)} style={{ marginLeft: 8, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4, color: "#ff7050", padding: "2px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>위치정정</button>
          )}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
          {accidentPos && <WeatherWidget lat={accidentPos.lat} lng={accidentPos.lng} locationName={selectedDistrict?.name} />}
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.7, letterSpacing: 0.5 }}>{time.split(' ')[0]}</span>
            <span style={{ width: 1, height: 14, background: "#ffffff", opacity: 0.2 }}></span>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{time.split(' ')[1]}</span>
          </div>
          <button onClick={onManage} style={{ background: "linear-gradient(135deg, #1e3a52, #112233)", border: "1px solid #2a6a8a", borderRadius: 8, color: "#7ec8e3", padding: "10px 20px", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><span>⚙</span> 설정</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 왼쪽: 투입 현황 + 활동 기록 */}
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
            {sortedCenters.map(c => {
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
              <button onClick={handleSaveLogs} style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 4, color: "#7ec8e3", padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>저장</button>
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

        {/* 가운데: 카카오맵 */}
        <div ref={mapRef} style={{ flex: 1, position: "relative", background: "#060d18", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {selectedDistrict && <KakaoMap key={selectedDistrict.name} center={selectedDistrict.center} onMapReady={setKakaoMap} />}
          </div>
          
          {/* 지도 타입 토글 버튼 */}
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
          {/* 상단 통합 알림 가이드 라인 */}
          {selectedDistrict && (
            <div style={{ position: "absolute", top: 12, left: 0, right: 0, zIndex: 10005, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, pointerEvents: "none" }}>
              {/* 1. 화재 지점 확정 가이드 */}
              {!isAccidentLocked && (
                <div style={{ background: "rgba(14, 25, 37, 0.95)", border: "1px solid #ff4500", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.6)", pointerEvents: "auto" }}>
                  <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>화재 지점을 드래그하여 설정하세요</span>
                  <button onClick={() => { setIsAccidentLocked(true); addLog("화재 지점 위치 확정", "warning"); }} style={{ background: "linear-gradient(135deg, #ff4500, #ff8c00)", border: "none", borderRadius: 8, color: "#ffff00", padding: "6px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 10px rgba(255,69,0,0.4)" }}>화재 지점 확정</button>
                </div>
              )}

              {/* 2. MCI 임시의료소 설치 가이드 */}
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

              {/* 3. 자원집결지 설치 가이드 */}
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
          )}

          {/* 좌상단 통합 상태 배지 영역 */}
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10006, display: "flex", flexDirection: "column", gap: 12, pointerEvents: "none" }}>
            {/* 1. MCI 현황 배지 */}
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

            {/* 2. 자원집결지 현황 배지 */}
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
          {dragging && dragPos && mapRef.current && (() => {
            const rect = mapRef.current.getBoundingClientRect();
            const isOver = dragPos.x >= rect.left && dragPos.x <= rect.right && dragPos.y >= rect.top && dragPos.y <= rect.bottom;
            return isOver ? (
              <div style={{ position: "fixed", left: dragPos.x - dragOffsetRef.current.x, top: dragPos.y - dragOffsetRef.current.y, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 9999, background: dragging.itemType === "vehicle" ? "#1e2a3a" : "#2a1a1a", border: "2px dashed #ff4500", borderRadius: dragging.itemType === "vehicle" ? 8 : "50%", padding: "6px 12px", display: "flex", alignItems: "center", boxShadow: "0 4px 20px rgba(255,69,0,0.6)", opacity: 0.9 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{dragging.name}</span>
              </div>
            ) : null;
          })()}
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
                title="대상물 관리"
              >
                <span style={{ fontSize: 20 }}>🏢</span>
              </button>
            </div>
          )}

          {/* 우측 하단 버거 메뉴 복구 */}
          {selectedDistrict && (
            <>
              <div style={{ position: "absolute", bottom: 90, right: 20, zIndex: 10006 }}>
                {showHydrantRadiusPicker && (
                  <div style={{ position: "absolute", bottom: 64, right: 0, background: "#0d1f30", border: "1px solid #2a6a8a", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", gap: 6, minWidth: 90 }}>
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
                      // X 버튼: 소화전 숨기기
                      setHydrantVisible(false);
                      setHydrantRadius(null);
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
        </div>

        {/* 오른쪽: 사이드바 */}
        <div style={{ 
          width: 250, background: "#080f1a", borderLeft: "1px solid #1e3a52", 
          display: "flex", flexDirection: "column", position: "relative", zIndex: 100, 
          filter: isLight ? "invert(1) hue-rotate(180deg)" : "none",
          marginRight: isSidebarOpen ? 0 : -250,
          transition: "margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
          {/* 사이드바 토글 버튼 */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              position: "absolute",
              left: -32,
              top: "50%",
              transform: "translateY(-50%)",
              width: 32,
              height: 64,
              background: "#080f1a",
              border: "1px solid #1e3a52",
              borderRight: "none",
              borderRadius: "8px 0 0 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a7a9b",
              zIndex: 101,
              boxShadow: "-4px 0 15px rgba(0,0,0,0.5)",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ff4500"; e.currentTarget.style.background = "#112233"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#4a7a9b"; e.currentTarget.style.background = "#080f1a"; }}
          >
            <span style={{ fontSize: 16 }}>{isSidebarOpen ? "▶" : "◀"}</span>
          </button>
          <div style={{ display: "flex", background: "#0e1925" }}>
            {[{ k: "vehicle", icon: "🚒", label: "차량" }, { k: "personnel", icon: <img src="/icons/fireman.svg" alt="대원" style={{ width: 20, height: 20 }} />, label: "대원" }].map(t => (
              <button key={t.k} onClick={() => setSideTab(t.k)} style={{ flex: 1, padding: "12px 0", background: activeTab === t.k ? "#1a3a52" : "transparent", border: "none", borderBottom: `2px solid ${activeTab === t.k ? "#ff4500" : "transparent"}`, color: activeTab === t.k ? "#fff" : "#4a7a9b", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, fontSize: 18 }}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
            {sortedCenters.map(c => {
              const list = (activeTab === "personnel" ? personnel : vehicles).filter(x => x.center_id === c.id && !deployedIds.has(`${activeTab}_${x.id}`));
              if (!list.length) return null;
              const isExpanded = expandedCenters[c.id];
              return (
                <div key={c.id} style={{ marginBottom: 16 }}>
                  <div
                    onClick={() => setExpandedCenters(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                    style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a52", borderRadius: 8, fontSize: 15, color: c.color, fontWeight: 700, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "12px 16px", boxSizing: "border-box" }}>
                    <span>{c.name}</span>
                    <span style={{ fontSize: 12, color: "#a0c4d8" }}>{isExpanded ? "▲ 접기" : "▼ 펼치기"}</span>
                  </div>
                  {isExpanded && list.map(x => (
                    <div key={x.id}
                      onMouseDown={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        dragOffsetRef.current = {
                          x: e.clientX - (rect.left + rect.width / 2),
                          y: e.clientY - (rect.top + rect.height / 2)
                        };
                        dragPayloadRef.current = { ...x, itemType: activeTab };
                        dragStartPosRef.current = { x: e.clientX, y: e.clientY };
                      }}
                      onTouchStart={e => {
                        const touch = e.touches[0];
                        const rect = e.currentTarget.getBoundingClientRect();
                        dragOffsetRef.current = {
                          x: touch.clientX - (rect.left + rect.width / 2),
                          y: touch.clientY - (rect.top + rect.height / 2)
                        };
                        // fromPopup 없이 세팅 → onMove에서 세로 스크롤 감지 시 취소
                        dragPayloadRef.current = { ...x, itemType: activeTab };
                        dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                      }}
                      style={{ background: "#112233", border: "1px solid #1e3a52", borderRadius: 8, padding: "8px 12px", marginBottom: 6, cursor: "grab", display: "flex", alignItems: "center", gap: 10, userSelect: "none", touchAction: "pan-y" }}>
                      <span style={{ fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                        {activeTab === "personnel" ? (
                          <img src="/icons/fireman.svg" alt="대원" style={{ width: "100%", height: "100%" }} />
                        ) : (
                          VEHICLE_ICONS[x.type]?.startsWith("/") ? (
                            <img src={VEHICLE_ICONS[x.type]} alt={x.type} style={{ width: "100%", height: "100%" }} />
                          ) : (
                            VEHICLE_ICONS[x.type]
                          )
                        )}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{x.name}</div>
                        <div style={{ fontSize: 11, color: "#4a7a9b" }}>{x.role || VEHICLE_LABELS[x.type]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
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

      {/* 모달들 */}
      {
        showConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20000, backdropFilter: "blur(4px)" }} onClick={() => setShowConfirm(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0e1925", border: `1px solid ${showConfirm.type === 'recall' ? '#ff4500' : '#4ade80'}`, borderRadius: 20, padding: 32, maxWidth: 360, width: "100%", textAlign: "center", filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
                {showConfirm.type === "hose" ? `${showConfirm.fromName} ↔ ${showConfirm.toName} 수관을 회수하시겠습니까?`
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
                    addLog(`수관 회수: ${showConfirm.fromName} ↔ ${showConfirm.toName}`, "info");
                    setHoseLinks(prev => prev.filter(l => l.id !== showConfirm.linkId));
                    setShowConfirm(null);
                    setSelected(null);
                  } else if (showConfirm.type === "hydrant-release") {
                    addLog(`${showConfirm.vehicleName} 소화전 점령 해제`, "info");
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
                    actualDeleteTarget(showConfirm.id, showConfirm.name);
                    setShowConfirm(null);
                  } else if (showConfirm.type === "snapshot-delete") {
                    actualDeleteSnapshot(showConfirm.id, showConfirm.name, showConfirm.targetId);
                    setShowConfirm(null);
                  } else { confirmRecall(); }
                }} style={{ flex: 1, padding: "8px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 6, color: "#ff7050" }}>확인</button>
              </div>
            </div>
          </div>
        )
      }
      {
        showResetConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20000, backdropFilter: "blur(4px)" }} onClick={() => setShowResetConfirm(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0e1925", border: "1px solid #ff4500", borderRadius: 20, padding: 32, maxWidth: 360, width: "100%", textAlign: "center", filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>기록을 초기화하시겠습니까?</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: "8px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#fff" }}>취소</button>
                <button onClick={handleResetLogs} style={{ flex: 1, padding: "8px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 6, color: "#ff7050" }}>초기화</button>
              </div>
            </div>
          </div>
        )
      }
      {
        showGlobalResetInit && (
          <div style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 21000, backdropFilter: "blur(8px)" }} onClick={() => setShowGlobalResetInit(false)}>
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
        )
      }

      {
        showWaterAdjust && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20000, backdropFilter: "blur(10px)" }} onClick={() => setShowWaterAdjust(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(145deg, #101a2a, #0a121e)", border: "1px solid #009dff66", borderRadius: 20, padding: "20px", minWidth: 240, textAlign: "center", boxShadow: "0 15px 40px rgba(0,0,0,0.8)", filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
              <div style={{ fontSize: 12, color: "#7ec8e3", marginBottom: 4, fontWeight: 600 }}>{showWaterAdjust.name}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 20 }}>잔여 수량 설정</div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 15, marginBottom: 24 }}>
                <button
                  onClick={() => setShowWaterAdjust(prev => ({ ...prev, current: Math.max(0, prev.current - 100) }))}
                  style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #1e3a52", background: "#1a2a3a", color: "#60a5fa", fontSize: 20, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#2a3a4a"}
                  onMouseLeave={e => e.currentTarget.style.background = "#1a2a3a"}
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
                  onMouseEnter={e => e.currentTarget.style.background = "#2a3a4a"}
                  onMouseLeave={e => e.currentTarget.style.background = "#1a2a3a"}
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
                    // Supabase 업데이트
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
        )
      }
      {
        showUtilityModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20000, backdropFilter: "blur(12px)", padding: "20px" }} onClick={() => setShowUtilityModal(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "linear-gradient(145deg, #0f1a2a, #070d14)",
              border: "1px solid #ff450066",
              borderRadius: 24, padding: "22px 24px",
              width: utilityTab === "mci" ? (mciViewMode === "hospital" ? "min(1380px, 96vw)" : "min(320px, 96vw)") : "min(385px, 96vw)",
              maxWidth: "96vw",
              minHeight: utilityTab === "mci" ? 520 : "auto",
              maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              filter: isLight ? "invert(1) hue-rotate(180deg)" : "none",
              msOverflowStyle: "none", scrollbarWidth: "none"
            }}>

              {/* 상단 헤더 (공통) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {utilityTab !== "menu" && utilityTab !== "targets" && !mciFromBadge && (
                    <button onClick={() => setUtilityTab("menu")} style={{ background: "transparent", border: "none", color: "#7ec8e3", fontSize: 18, cursor: "pointer", padding: "4px" }}>←</button>
                  )}
                  <span style={{ fontSize: 24 }}>{utilityTab === "menu" ? "🛠️" : utilityTab === "calc" ? "🧮" : utilityTab === "targets" ? "🏢" : utilityTab === "forest_fire" ? "🌲" : "🚑"}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: -0.5, lineHeight: 1.3 }}>
                    {utilityTab === "menu" ? "현장 지휘 유틸리티" : (utilityTab === "calc" ? "고층건물화재 방수압력 계산기" : utilityTab === "targets" ? "대상물 관리" : utilityTab === "forest_fire" ? "산불진화 대응" : "다수사상자 대응 (MCI)")}
                  </span>
                </div>
                <button onClick={() => setShowUtilityModal(false)} style={{ background: "transparent", border: "none", color: "#4a7a9b", fontSize: 32, lineHeight: 1, cursor: "pointer", padding: "0 4px", marginLeft: 10 }}>×</button>
              </div>

              {/* 1. 메인 메뉴 화면 */}
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
                      {/* 좌측 강조 바 */}
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: m.gradient }} />

                      <div style={{
                        width: 52, height: 52, borderRadius: 14,
                        background: "rgba(0,0,0,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 28, border: `1px solid ${m.color}33`
                      }}>
                        {m.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 500, color: "#fff", marginBottom: 3 }}>{m.label}</div>
                        <div
                          style={{ fontSize: 13, color: "#7ec8e3", opacity: 0.8, lineHeight: 1.4 }}
                          dangerouslySetInnerHTML={{ __html: m.desc }}
                        />
                      </div>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "rgba(255,255,255,0.05)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: m.color, fontSize: 14
                      }}>
                        ➔
                      </div>
                    </button>
                  ))}
                  <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "#4a7a9b", fontWeight: 500, opacity: 0.6, letterSpacing: 1 }}>CONNECTED TO HEADQUARTER</div>
                </div>
              )}

              {/* 2. 방수압 계산기 화면 */}
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
                          <button
                            key={size}
                            onClick={() => setPumpCalc(p => ({ ...p, hoseSize: size }))}
                            style={{
                              flex: 1, padding: "8px 0", border: "none", borderRadius: 8,
                              background: pumpCalc.hoseSize === size ? "linear-gradient(135deg, #3b82f6, #1e3a8a)" : "transparent",
                              color: pumpCalc.hoseSize === size ? "#fff" : "#7ec8e3",
                              fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                              opacity: pumpCalc.hoseSize === size ? 1 : 0.6
                            }}
                          >
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
                      <div style={{ fontSize: 14, color: "#4a7a9b", marginTop: 4 }}>
                        약 {(() => {
                          const base = pumpCalc.mode === "monitor" ? 0.70 : 0.35;
                          const hoseFactor = pumpCalc.hoseSize === 40 ? 0.05 : 0.015;
                          const val = ((pumpCalc.floor - 1) * 0.03) + (pumpCalc.hose * hoseFactor) + base;
                          return val.toFixed(2);
                        })()} MPa
                      </div>
                    </div>

                    <p style={{ fontSize: 10, color: "#e7f4fc88", lineHeight: 1.6, margin: 0, textAlign: "center" }}>
                      ※ 기준: 층고 3m (0.03MPa/층) <br />
                      P(압력) = 0.03(H-1) + NL + B <br />
                      <span style={{ fontSize: 9 }}>(H:층수, N:호스수, L:마찰손실, B:관창압)</span>
                    </p>
                  </div>
                </>
              )}

              {/* 3. 대상물 관리 화면 */}
              {utilityTab === "targets" && (
                <TargetModule
                  targets={targets} setTargets={setTargets}
                  selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget}
                  snapshots={snapshots} setSnapshots={setSnapshots}
                  isSavingSnapshot={isSavingSnapshot} setIsSavingSnapshot={setIsSavingSnapshot}
                  inputModal={inputModal} setInputModal={setInputModal}
                  accidentAddress={accidentAddress} accidentPos={accidentPos}
                  addLog={addLog}
                  handleDeleteTarget={handleDeleteTarget}
                  setShowConfirm={setShowConfirm}
                  handleLoadSnapshot={handleLoadSnapshot}
                  handleSaveSnapshot={handleSaveSnapshot}
                />
              )}

              {/* 3. 산불진화 (준비중) 화면 */}
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
                  <p style={{ fontSize: 13, color: "#4a7a9b", lineHeight: 1.6, margin: 0, maxWidth: 240 }}>
                    지표화/수관화 분석 및 <br />
                    실시간 산불 진화 전술 최적화 모듈을 <br />
                    개발하고 있습니다.
                  </p>
                </div>
              )}

              {/* 4. 다수사상자 대응 (MCI) 화면 */}
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
        )
      }
      {/* 커스텀 입력 모달 */}
      {inputModal.show && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30000 }}>
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
              <button
                onClick={() => setInputModal(p => ({ ...p, show: false }))}
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 12, color: "#7ec8e3", padding: "14px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >취소</button>
              <button
                onClick={() => {
                  inputModal.onConfirm(inputModal.defaultValue);
                  setInputModal(p => ({ ...p, show: false }));
                }}
                style={{ flex: 1, background: `linear-gradient(135deg, ${inputModal.type === 'target' ? '#3b82f6, #1e3a8a' : '#8b5cf6, #4c1d95'})`, border: "none", borderRadius: 12, color: "#fff", padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(59,130,246,0.2)" }}
              >저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 자원집결지 상세 전술 팝업 */}
      <StagingPopup
        isOpen={selected === "staging-site"}
        onClose={() => setSelected(null)}
        centers={centers}
        vehicles={vehicles}
      />

      {/* 현장 투입 자원 총괄 현황 팝업 */}
      <ResourceSummaryPopup
        isOpen={showResourceSummary}
        onClose={() => setShowResourceSummary(false)}
        deployed={deployed}
        vehicles={vehicles}
        personnel={personnel}
        centers={centers}
        selectedDistrict={selectedDistrict}
      />
    </div >
  );
}
