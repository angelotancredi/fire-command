import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { VEHICLE_ICONS, VEHICLE_LABELS, ROLES, DISTRICTS, getDistance, HOSPITALS, SEVERITIES, TRANSPORT_STATUSES } from "../constants";
import KakaoMap from "./KakaoMap";
import WeatherWidget from "./WeatherWidget";
import MciModule from "./CommandScreen/MciModule.jsx";
import TargetModule from "./CommandScreen/TargetModule.jsx";
import StagingPopup from "./CommandScreen/StagingPopup.jsx";
import ResourceSummaryPopup from "./CommandScreen/ResourceSummaryPopup.jsx";
import HYDRANT_DATA from "../data/fire_hydrants.json";

const UTILITY_MENU_ITEMS = [
  { key: "staging", label: "자원집결지", desc: "출동 자원의 효율적 관리", icon: <img src="/icons/fire-point.svg" alt="자원집결지" style={{ width: 28, height: 28 }} />, color: "#8b5cf6", gradient: "linear-gradient(135deg, #4c1d95, #8b5cf6)" },
  { key: "mci", label: "다수사상자 대응 (MCI)", desc: "임시의료소 설치 / 실시간 환자 관리", icon: "🚑", color: "#f97316", gradient: "linear-gradient(135deg, #9a3412, #f97316)" },
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
  const fireMarkerRef = useRef(null);
  const suppressionCircleRef = useRef(null);
  const hoseLinesRef = useRef([]);
  const waterSprayRef = useRef([]);
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
  const mciMarkerRef = useRef(null);
  const stagingMarkerRef = useRef(null);
  const isMciLockedRef = useRef(isMciLocked);
  const [stagingSetupStarted, setStagingSetupStarted] = useState(false);
  const isStagingLockedRef = useRef(isStagingLocked);
  const [siameseLinks, setSiameseLinks] = useState([]); // [{id, lat, lng, name}]

  useEffect(() => { isMciLockedRef.current = isMciLocked; }, [isMciLocked]);
  useEffect(() => { isStagingLockedRef.current = isStagingLocked; }, [isStagingLocked]);

  useEffect(() => {
    if (selectedDistrict) {
      setHydrantRadius(selectedDistrict.hydrantRadius || 500);
    }
  }, [selectedDistrict]);

  const [mciViewMode, setMciViewMode] = useState("main");
  const [mciFromBadge, setMciFromBadge] = useState(false);
  const [mciTransportLog, setMciTransportLog] = useState([]);

  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [inputModal, setInputModal] = useState({ show: false, type: "", title: "", placeholder: "", defaultValue: "", onConfirm: null });
  const [mapTypeId, setMapType] = useState("ROADMAP");
  const [showResourceSummary, setShowResourceSummary] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGlobalResetInit, setShowGlobalResetInit] = useState(false);
  const [showHydrantRadiusPicker, setShowHydrantRadiusPicker] = useState(false);
  const [utilityTab, setUtilityTab] = useState("staging");
  const [showUtilityModal, setShowUtilityModal] = useState(false);
  const hydrantMarkersRef = useRef([]);
  const hydrantLinesRef = useRef([]);

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
    
    setHydrantVisible(data.hydrantVisible || false);
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

  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    const handleZoomChanged = () => setMapZoom(kakaoMap.getLevel());
    window.kakao.maps.event.addListener(kakaoMap, 'zoom_changed', handleZoomChanged);
    return () => window.kakao.maps.event.removeListener(kakaoMap, 'zoom_changed', handleZoomChanged);
  }, [kakaoMap]);

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
          if (e.type === 'touchstart') e.preventDefault();
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

      // --- 분수기(Y-Coupling) 오버레이 생성 로직 고도화: 차량 포트별 독립 생성 ---
      const uniqueSplitterSources = [];
      hoseLinks.filter(l => l.toType === "personnel" && (l.fromType === "vehicle" || !l.fromType)).forEach(link => {
        const key = `${link.fromId}_${link.port || 1}`;
        if (!uniqueSplitterSources.includes(key)) uniqueSplitterSources.push(key);
      });

      uniqueSplitterSources.forEach(sourceKey => {
        const [vId, portStr] = sourceKey.split("_");
        const port = parseInt(portStr);
        const v = deployed[`vehicle_${vId}`];
        if (!v) return;

        const pLinks = hoseLinks.filter(l => String(l.fromId) === String(vId) && (l.port || 1) === port && l.toType === "personnel");
        if (pLinks.length === 0) return;

        const compoundId = `${vId}_${port}`; // 차량ID_포트번호 복합키
        let yPos = yCouplingPositions[compoundId];
        const isDotMode = mapZoom >= 4;

        if (!yPos) {
          let avgLat = 0, avgLng = 0;
          pLinks.forEach(l => {
            const pDep = deployed[`personnel_${l.toId}`];
            if (pDep) { avgLat += pDep.lat; avgLng += pDep.lng; }
          });
          avgLat /= pLinks.length; avgLng /= pLinks.length;
          yPos = {
            lat: v.lat + (avgLat - v.lat) * 0.4,
            lng: v.lng + (avgLng - v.lng) * 0.4
          };
        }

        const isSelected = selected === `y_${compoundId}`;
        const yContent = document.createElement("div");
        yContent.className = `y-coupling-${compoundId}`;
        
        if (isDotMode) {
          yContent.style.cssText = `
            width: 10px; height: 10px; background: #00aaff;
            border: 2px solid #fff; border-radius: 50%;
            box-shadow: 0 0 8px #00aaff;
            cursor: pointer; transform: scale(1);
            transition: transform 0.2s;
          `;
        } else {
          yContent.style.cssText = `
            width: 32px; height: 32px; background: #001a2c;
            border: 2px solid #00aaff; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 0 20px rgba(0, 170, 255, 0.4), inset 0 0 10px rgba(0, 170, 255, 0.2);
            cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            transform: scale(1);
            z-index: 1500;
          `;
          yContent.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#7ec8e3" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 2px rgba(0,170,255,0.5))">
              <path d="M12 12.5L8 4.5H5.5V6.5L9 12.5L9 14.5V20.5H15V14.5L15 12.5L18.5 6.5V4.5H16L12 12.5Z"/>
            </svg>
          `;
        }
        
        const startYDrag = (e) => {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          const touch = e.touches ? e.touches[0] : e;
          dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
          // vehicleId에 복합키 저장
          dragPayloadRef.current = { itemType: 'yCoupling', vehicleId: compoundId, lat: yPos.lat, lng: yPos.lng, name: `${v.name} 분수기` };
          yCouplingLastClientPosRef.current = { x: touch.clientX, y: touch.clientY };
          yCouplingDragPosRef.current = { vehicleId: compoundId, lat: yPos.lat, lng: yPos.lng };
        };
        yContent.addEventListener('mousedown', startYDrag);
        yContent.addEventListener('touchstart', startYDrag, { passive: false });

        const yOverlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(yPos.lat, yPos.lng),
          content: yContent,
          xAnchor: 0.5, yAnchor: 0.5, zIndex: 1500, clickable: true
        });
        yOverlay.setMap(kakaoMap);
        overlaysRef.current.push(yOverlay);
        yCouplingOverlayRef.current[compoundId] = yOverlay; 

        // 분수기 팝업 (Y 클릭 시)
        if (isSelected) {
          const yPopup = document.createElement("div");
          yPopup.style.cssText = "background:#0e1e2e; border:1px solid #00aaff; border-radius:12px; padding:12px 16px; min-width:180px; box-shadow:0 10px 30px rgba(0,0,0,0.8); position:relative; color:#fff; margin-bottom:20px; text-align:center;";
          
          const p1Link = pLinks[0]; // 인덱스 기반으로 1번 포트 할당
          const p2Link = pLinks[1]; // 인덱스 기반으로 2번 포트 할당

          const titlePrefix = v.type === "tanker" ? `${v.name}(${port}번 포트)` : v.name;
          yPopup.innerHTML = `
            <div style="font-size:14px; font-weight:700; color:#7ec8e3; margin-bottom:4px;">${titlePrefix} 분수기</div>
            <div style="font-size:11px; color:#a0c4d8; margin-bottom:12px;">2구 분기점 (연결: ${pLinks.length}/2)</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button class="hose-ext-btn-1" style="width:100%; padding:8px 0; background:${p1Link ? '#334c5f' : '#007bff'}; border:none; color:#fff; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">
                ${p1Link ? '1번 수관 철수' : '🔧 1번 수관 연장'}
              </button>
              <button class="hose-ext-btn-2" style="width:100%; padding:8px 0; background:${p2Link ? '#334c5f' : '#007bff'}; border:none; color:#fff; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">
                ${p2Link ? '2번 수관 철수' : '🔧 2번 수관 연장'}
              </button>
            </div>
          `;
          
          const setupBtn = (btnClass, portNum, existingLink) => {
            const btn = yPopup.querySelector(btnClass);
            if (existingLink) {
              btn.onclick = (e) => {
                e.stopPropagation();
                setShowConfirm({ type: "hose", linkId: existingLink.id, fromName: `${titlePrefix} 분수기`, toName: personnel.find(p => p.id === existingLink.toId)?.name || "대원" });
              };
            } else {
              const startHose = (e) => {
                e.preventDefault(); e.stopPropagation();
                const touch = e.touches ? e.touches[0] : e;
                // 드래그 소스에 복합키 전달
                setHoseDragSource(`y_${compoundId}_${portNum}`);
                setSelected(null); 
                hoseDragOriginRef.current = { lat: yPos.lat, lng: yPos.lng };
                setDragPos({ x: touch.clientX, y: touch.clientY });
                dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
              };
              btn.onmousedown = startHose;
              btn.ontouchstart = startHose;
            }
          };

          setupBtn(".hose-ext-btn-1", 1, p1Link);
          setupBtn(".hose-ext-btn-2", 2, p2Link);

            const stopProp = (e) => e.stopPropagation();
            yPopup.addEventListener('mousedown', stopProp);
            yPopup.addEventListener('mouseup', stopProp);
            yPopup.addEventListener('touchstart', stopProp, { passive: false });
            yPopup.addEventListener('touchmove', stopProp, { passive: false });
            yPopup.addEventListener('touchend', stopProp);
            yPopup.addEventListener('click', stopProp);
            
            const closeX = document.createElement("div");
            closeX.innerHTML = "✕";
            closeX.style.cssText = "position:absolute; top:4px; right:8px; color:#4a7a9b; cursor:pointer;";
            closeX.onclick = (e) => { e.stopPropagation(); setSelected(null); };
            yPopup.appendChild(closeX);

            const yPopupOverlay = new window.kakao.maps.CustomOverlay({
              position: new window.kakao.maps.LatLng(yPos.lat, yPos.lng),
              content: yPopup, yAnchor: 1.1, zIndex: 10000, clickable: true
            });
            yPopupOverlay.setMap(kakaoMap);
            overlaysRef.current.push(yPopupOverlay);
        }
      });

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
          actions.style.cssText = "padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.2);";
          
          const isLadder = item.type === "ladder" || item.name?.includes("사다리");
          // 방수포 기능이 가능한 차량인지 확인
          const canDischarge = ["pump", "tanker", "chemical", "forest", "ladder"].includes(item.type) || isLadder;
          
          if (canDischarge) {
            if (item.type === "tanker") {
              // --- 물탱크차 전용 3행 레이아웃 ---
              const row1 = document.createElement("div");
              row1.style.cssText = "display: flex; gap: 6px; width: 100%;";
              
              const createHoseBtn = (port) => {
                const btn = document.createElement("button");
                const existingLink = hoseLinks.find(l => String(l.fromId) === String(item.id) && l.port === port);
                if (existingLink) {
                  btn.innerText = `수관(${port}) 철수`;
                  btn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                  btn.onclick = (e) => {
                    e.stopPropagation();
                    const toName = personnel.find(p => String(p.id) === String(existingLink.toId))?.name || "대원";
                    setShowConfirm({ type: "hose", linkId: existingLink.id, fromName: `${item.name}(${port}번 포트)`, toName });
                  };
                } else {
                  btn.innerText = `수관 연장(${port})`;
                  btn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: crosshair;";
                  const startHoseDrag = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const touch = e.touches ? e.touches[0] : e;
                    setHoseDragSource(`v_${item.id}_${port}`);
                    setSelected(null);
                    setDragPos({ x: touch.clientX, y: touch.clientY });
                  };
                  btn.onmousedown = startHoseDrag;
                  btn.ontouchstart = startHoseDrag;
                }
                return btn;
              };
              row1.appendChild(createHoseBtn(1));
              row1.appendChild(createHoseBtn(2));
              actions.appendChild(row1);

              const row2 = document.createElement("div");
              row2.style.cssText = "display: flex; gap: 6px; width: 100%;";
              
              const sprayBtn = document.createElement("button");
              const isSprayActive = waterSprayLinks.find(s => s.vehicleId === item.id);
              if (isSprayActive) {
                sprayBtn.innerText = "🚒 방수포 종료";
                sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #004a7c; border: 1px solid #009dff; color: #00ccff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                sprayBtn.onclick = (e) => {
                  e.stopPropagation();
                  setWaterSprayLinks(prev => prev.filter(s => s.vehicleId !== item.id));
                  setSelected(null);
                  addLog(`${item.name} 방수포 방수 종료`, "info");
                };
              } else {
                sprayBtn.innerText = "🚒 방수포 방수";
                sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #002a4a; border: 1px solid #009dff55; color: #7ec8e3; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                sprayBtn.onclick = (e) => {
                  e.stopPropagation();
                  if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요.");
                  setWaterSprayLinks(prev => [...prev.filter(s => s.vehicleId !== item.id), { id: Date.now(), vehicleId: item.id }]);
                  setSelected(null);
                  addLog(`${item.name} 방수포 방수 시작`, "info");
                };
              }
              row2.appendChild(sprayBtn);

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
                  setSelected(null);
                  setDragPos({ x: touch.clientX, y: touch.clientY });
                };
                captureBtn.onmousedown = startCaptureDrag;
                captureBtn.ontouchstart = startCaptureDrag;
              }
              row2.appendChild(captureBtn);
              actions.appendChild(row2);

              const row3 = document.createElement("div");
              row3.style.cssText = "display: flex; gap: 6px; width: 100%;";
              
              const waterInfo = document.createElement("div");
              waterInfo.innerText = `수량: ${item.water_capacity || 0}L`;
              waterInfo.style.cssText = "flex: 1; background: #004a7c; border: 1px solid #009dff; border-radius: 6px; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; cursor: pointer;";
              waterInfo.onclick = (e) => {
                e.stopPropagation();
                setShowWaterAdjust({ id: item.id, name: item.name, current: item.water_capacity });
              };
              row3.appendChild(waterInfo);

              const recallBtn = document.createElement("button");
              recallBtn.innerText = "🚨 현장 철수";
              recallBtn.style.cssText = "flex: 1; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name }); };
              row3.appendChild(recallBtn);
              actions.appendChild(row3);
            } else {
              // --- 기존 차량 레이아웃 (펌프차 등) ---
              const row1 = document.createElement("div");
              row1.style.cssText = "display: flex; gap: 6px; width: 100%;";

              const sprayBtn = document.createElement("button");
              const isSprayActive = waterSprayLinks.find(s => s.vehicleId === item.id);
              if (isSprayActive) {
                sprayBtn.innerText = "🚒 방수포 종료";
                sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #004a7c; border: 1px solid #009dff; color: #00ccff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                sprayBtn.onclick = (e) => {
                  e.stopPropagation();
                  setWaterSprayLinks(prev => prev.filter(s => s.vehicleId !== item.id));
                  setSelected(null);
                  addLog(`${item.name} 방수포 방수 종료`, "info");
                };
              } else {
                sprayBtn.innerText = "🚒 방수포 방수";
                sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #002a4a; border: 1px solid #009dff55; color: #7ec8e3; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                sprayBtn.onclick = (e) => {
                  e.stopPropagation();
                  if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요.");
                  setWaterSprayLinks(prev => [
                    ...prev.filter(s => s.vehicleId !== item.id),
                    { id: Date.now(), vehicleId: item.id }
                  ]);
                  setSelected(null);
                  addLog(`${item.name} 방수포 방수 시작`, "info");
                };
              }
              row1.appendChild(sprayBtn);

              if (!isLadder) {
                const hoseBtn = document.createElement("button");
                const existingLink = hoseLinks.find(l => String(l.fromId) === String(item.id));
                if (existingLink) {
                  hoseBtn.innerText = "수관 철수";
                  hoseBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                  hoseBtn.onclick = (e) => {
                    e.stopPropagation();
                    const toName = personnel.find(p => String(p.id) === String(existingLink.toId))?.name || "대원";
                    setShowConfirm({ type: "hose", linkId: existingLink.id, fromName: item.name, toName });
                  };
                } else {
                  hoseBtn.innerText = "수관 연장";
                  hoseBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: crosshair;";
                  const startHoseDrag = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const touch = e.touches ? e.touches[0] : e;
                    setHoseDragSource(item.id);
                    setSelected(null);
                    setDragPos({ x: touch.clientX, y: touch.clientY });
                  };
                  hoseBtn.onmousedown = startHoseDrag;
                  hoseBtn.ontouchstart = startHoseDrag;
                }
                row1.appendChild(hoseBtn);
              }
              actions.appendChild(row1);

              if (!isLadder) {
                const row2 = document.createElement("div");
                row2.style.cssText = "display: flex; gap: 6px; width: 100%;";

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
                    setSelected(null);
                    setDragPos({ x: touch.clientX, y: touch.clientY });
                  };
                  captureBtn.onmousedown = startCaptureDrag;
                  captureBtn.ontouchstart = startCaptureDrag;
                }
                row2.appendChild(captureBtn);

                if (item.water_capacity > 0) {
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
              }

              const recallBtn = document.createElement("button");
              recallBtn.innerText = "🚨 현장 철수";
              recallBtn.style.cssText = "width: 100%; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name }); };
              actions.appendChild(recallBtn);
            }
          } else {
            const recallBtn = document.createElement("button");
            recallBtn.innerText = "🚨 현장 철수";
            recallBtn.style.cssText = "width: 100%; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
            recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name, itemType: item.itemType }); };
            actions.appendChild(recallBtn);
          }
          popupDiv.appendChild(actions);
        } else {
          // --- 대원 팝업 UI 복구 ---
          popupDiv.style.cssText = `
            background: linear-gradient(135deg, #0e1e2e, #16263a);
            border: 1px solid #ff4500; border-radius: 12px; padding: 0;
            min-width: 220px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            position: relative; color: #fff; margin-bottom: 20px; overflow: hidden;
          `;
          const header = document.createElement("div");
          header.style.cssText = "padding: 12px; background: #1a2a3a; border-bottom: 1px solid #ff450033; text-align: center;";
          header.innerHTML = `
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 2px;">${item.name}</div>
            <div style="font-size: 11px; color: #7ec8e3;">${item.role}</div>
          `;
          popupDiv.appendChild(header);

          const personnelActions = document.createElement("div");
          personnelActions.style.cssText = "padding: 12px; display: flex; flexDirection: column; gap: 8px;";
          
          // [수정] 대원 관창 방수 로직 복구
          const sprayBtn = document.createElement("button");
          const isSprayActive = waterSprayLinks.find(s => s.personnelId === item.id);
          const isConnected = hoseLinks.some(l => l.toId === item.id);
          
          if (isSprayActive) {
            sprayBtn.innerText = "💧 방수 종료";
            sprayBtn.style.cssText = "width: 100%; padding: 10px 0; background: #004a7c; border: 1px solid #009dff; color: #00ccff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
            sprayBtn.onclick = (e) => {
              e.stopPropagation();
              setWaterSprayLinks(prev => prev.filter(s => s.personnelId !== item.id));
              addLog(`${item.name} 대원 방수 종료`, "info");
              setSelected(null);
            };
          } else {
            sprayBtn.innerText = "💧 관창 방수";
            const btnStyle = isConnected 
              ? "background: #002a4a; border: 1px solid #009dff55; color: #7ec8e3; cursor: pointer;"
              : "background: #1a1a1a; border: 1px solid #333; color: #555; cursor: not-allowed;";
            sprayBtn.style.cssText = `width: 100%; padding: 10px 0; border-radius: 6px; font-size: 13px; font-weight: 700; ${btnStyle}`;
            sprayBtn.onclick = (e) => {
              e.stopPropagation();
              if (!isConnected) return alert("먼저 수관을 연장해야 합니다.");
              if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요.");
              setWaterSprayLinks(prev => [...prev, { id: Date.now(), personnelId: item.id }]);
              addLog(`${item.name} 대원 관창 방수 시작`, "info");
              setSelected(null);
            };
          }
          personnelActions.appendChild(sprayBtn);

          const recallBtn = document.createElement("button");
          recallBtn.innerText = "🚨 현장 철수";
          recallBtn.style.cssText = "width: 100%; padding: 8px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
          recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name, itemType: item.itemType }); };
          personnelActions.appendChild(recallBtn);
          
          popupDiv.appendChild(personnelActions);
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

      // --- 신규: 연결송수구 오버레이 렌더링 ---
      siameseLinks.forEach(conn => {
        if (!conn.lat || !conn.lng) return;
        const isSelected = selected === conn.id;
        const content = document.createElement("div");
        content.style.cursor = "pointer";
        content.style.position = "relative";
        content.style.zIndex = isSelected ? "2000" : "1500";

        const isDotMode = mapZoom >= 4;
        const markerHtml = isDotMode ? `
          <div style="width: 14px; height: 14px; background: #10b981; 
                      border: 2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.7)'}; 
                      border-radius: 50%; 
                      box-shadow: ${isSelected ? '0 0 15px #10b981' : '0 2px 6px rgba(0,0,0,0.5)'}; 
                      transition: all 0.2s;">
          </div>
        ` : `
          <div style="background: linear-gradient(135deg, #065f46, #064e3b); 
                      border: 2px solid ${isSelected ? '#fff' : '#10b981'}; 
                      border-radius: 6px; 
                      padding: 5px 8px; display: flex; align-items: center; 
                      box-shadow: ${isSelected ? '0 0 20px #10b981' : '0 4px 12px rgba(0,0,0,0.5)'}; 
                      pointer-events: auto; user-select: none;
                      transition: all 0.2s;">
            <div style="display: flex; gap: 6px;">
              <div style="width: 14px; height: 14px; background: #f87171; border: 1.5px solid #d4af37; border-radius: 50%; position: relative; box-shadow: inset 0 0 4px rgba(0,0,0,0.3);">
                <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1.5px; background: #d4af37; transform: translateY(-50%);"></div>
              </div>
              <div style="width: 14px; height: 14px; background: #f87171; border: 1.5px solid #d4af37; border-radius: 50%; position: relative; box-shadow: inset 0 0 4px rgba(0,0,0,0.3);">
                <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1.5px; background: #d4af37; transform: translateY(-50%);"></div>
              </div>
            </div>
          </div>
        `;
        content.innerHTML = markerHtml;

        const startDrag = (e) => {
          if (e.type === 'touchstart') e.preventDefault();
          e.stopPropagation();
          const touch = e.touches ? e.touches[0] : e;
          dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
          if (mapRef.current && kakaoMap) {
            const rect = mapRef.current.getBoundingClientRect();
            const cp = kakaoMap.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(conn.lat, conn.lng));
            dragOffsetRef.current = { x: touch.clientX - (rect.left + cp.x), y: touch.clientY - (rect.top + cp.y) };
          }
          dragPayloadRef.current = { ...conn, itemType: "siamese", fromMap: true };
        };
        content.addEventListener('mousedown', startDrag);
        content.addEventListener('touchstart', startDrag, { passive: false });
        
        // 클릭 시 선택 (삭제 팝업용 등)
        content.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelected(prev => prev === conn.id ? null : conn.id);
        });

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(conn.lat, conn.lng),
          content: content,
          xAnchor: 0.5, yAnchor: 0.5,
          zIndex: isSelected ? 2000 : 1500,
          clickable: true
        });
        overlay.setMap(kakaoMap);
        overlaysRef.current.push(overlay);

        // 선택되었을 때 삭제 팝업 표시
        if (isSelected) {
          const deleteBtn = document.createElement("div");
          deleteBtn.style.cssText = "background: rgba(58, 26, 26, 0.95); border: 2px solid #ff4500; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: #ff4500; font-size: 20px; font-weight: 900; cursor: pointer; position: relative; margin-bottom: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); transition: all 0.2s;";
          deleteBtn.innerText = "✕";
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            setSiameseLinks(prev => prev.filter(s => s.id !== conn.id));
            setHoseLinks(prev => prev.filter(l => l.toId !== conn.id));
            setSelected(null);
            addLog("연결송수구 제거", "recall");
          };
          
          const popupOverlay = new window.kakao.maps.CustomOverlay({
            position: new window.kakao.maps.LatLng(conn.lat, conn.lng),
            content: deleteBtn,
            yAnchor: 1.5,
            zIndex: 10000,
            clickable: true
          });
          popupOverlay.setMap(kakaoMap);
          overlaysRef.current.push(popupOverlay);
        }
      });
    } catch (err) {
      console.error("Overlay sync error:", err);
    }
  }, [kakaoMap, deployed, selected, mapZoom, centers, personnel, waterSprayLinks, hoseLinks, hydrantCaptureLinks, siameseLinks]);

  useEffect(() => {
    const onDown = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const onMove = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      
      // ── 분수기 드래그: 최우선 처리, 커서 위치를 직접 좌표로 변환 (계산 오차 없음) ──
      if (dragPayloadRef.current?.itemType === 'yCoupling' && mapRef.current && kakaoMap) {
        if (!dragStartPosRef.current) return;
        const dx = touch.clientX - dragStartPosRef.current.x;
        const dy = touch.clientY - dragStartPosRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          const rect = mapRef.current.getBoundingClientRect();
          const latlng = kakaoMap.getProjection().coordsFromContainerPoint(
            new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top)
          );
          if (latlng) {
            const vId = dragPayloadRef.current.vehicleId;
            const yOverlay = yCouplingOverlayRef.current[vId];
            if (yOverlay) yOverlay.setPosition(latlng);
            yCouplingDragPosRef.current = { vehicleId: vId, lat: latlng.getLat(), lng: latlng.getLng() };
            yCouplingIsDraggingRef.current = true;
          }
          if (e.cancelable) e.preventDefault();
        }
        return;
      }

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

      if (Math.sqrt(dx * dx + dy * dy) > 10) {
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
      
      const hDS = hydrantDragSource;
      const hoseDS = hoseDragSource;
      const payload = dragPayloadRef.current;
      const isActuallyDragging = !!dragging;
      const offset = dragOffsetRef.current;

      // 이동 거리 계산 (드래그 여부 판별용)
      const moveDist = dragStartPosRef.current 
        ? Math.sqrt((touch.clientX - dragStartPosRef.current.x)**2 + (touch.clientY - dragStartPosRef.current.y)**2)
        : 0;

      const clearSources = () => {
        setHoseDragSource(null);
        setHydrantDragSource(null);
        setDragPos(null);
        hoseDragOriginRef.current = null;
      };

      if (hDS && mapRef.current && kakaoMap) {
        const rect = mapRef.current.getBoundingClientRect();
        const dropX = touch.clientX - rect.left;
        const dropY = touch.clientY - rect.top;
        let targetHydrant = null;
        let minDist = 40;
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
            ...prev.filter(l => l.vehicleId !== hDS && l.hydrantId !== targetHydrant.id),
            { id: Date.now(), vehicleId: hDS, hydrantId: targetHydrant.id, hydrantLat: targetHydrant.lat, hydrantLng: targetHydrant.lng }
          ]);
          const vName = deployed[`vehicle_${hDS}`]?.name || "차량";
          addLog(`${vName} → 소화전 ${targetHydrant.code} 점령`, "info");
          clearSources();
          setDragging(null);
          dragPayloadRef.current = null;
          dragStartPosRef.current = null;
        } else if (moveDist > 20) {
          // 대상 없이 멀리 드래그하고 떼면 취소 (단순 클릭 시에는 유지)
          clearSources();
          setDragging(null);
          dragPayloadRef.current = null;
          dragStartPosRef.current = null;
        }
        return;
      }

      if (hoseDS && mapRef.current && kakaoMap) {
        const rect = mapRef.current.getBoundingClientRect();
        const point = new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top);
        const sourceStr = hoseDS.toString();
        const isFromSplitter = sourceStr.startsWith("y_");
        const isFromPortedVehicle = sourceStr.startsWith("v_");
        const parts = sourceStr.split("_");
        const actualFromId = (isFromSplitter || isFromPortedVehicle) ? parts[1] : hoseDS;
        const fromType = isFromSplitter ? "splitter" : "vehicle";
        const port = (isFromSplitter || isFromPortedVehicle) ? parseInt(parts[2]) : 1;

        let targetUnit = null;
        let minPixelDist = 40;

        Object.keys(deployed).forEach(compositeKey => {
          const d = deployed[compositeKey];
          const typeStr = compositeKey.split("_")[0];
          const idStr = compositeKey.split("_")[1];
          
          if (typeStr !== 'personnel' && typeStr !== 'vehicle') return;
          if (typeStr === 'vehicle' && String(idStr) === String(actualFromId)) return; // 자기 자신 제외 (타입 불일치 방어)

          const pPos = kakaoMap.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(d.lat, d.lng));
          const dropPos = new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top);
          const dx = pPos.x - dropPos.x;
          const dy = pPos.y - dropPos.y;
          const pixelDist = Math.sqrt(dx * dx + dy * dy);

          if (pixelDist < minPixelDist) { 
            minPixelDist = pixelDist; 
            const originalItem = typeStr === "personnel" ? personnel.find(p => String(p.id) === String(idStr)) : vehicles.find(v => String(v.id) === String(idStr));
            targetUnit = { id: idStr, type: typeStr, name: originalItem?.name || d.name || "대상" }; 
          }
        });

        siameseLinks.forEach(s => {
          const sPos = kakaoMap.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(s.lat, s.lng));
          const dropPos = new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top);
          const dx = sPos.x - dropPos.x;
          const dy = sPos.y - dropPos.y;
          const pixelDist = Math.sqrt(dx * dx + dy * dy);

          if (pixelDist < minPixelDist) {
            minPixelDist = pixelDist;
            targetUnit = { id: s.id, type: "siamese", name: s.name || "연결송수구" };
          }
        });

        if (targetUnit) {
          setHoseLinks(prev => [
            ...prev.filter(l => !(String(l.fromId) === String(actualFromId) && l.fromType === fromType && String(l.port) === String(port) && String(l.toId) === String(targetUnit.id))),
            { id: Date.now(), fromId: actualFromId, fromType: fromType, toId: targetUnit.id, toType: targetUnit.type, port }
          ]);
          
          const fromName = isFromSplitter 
            ? `${deployed[`vehicle_${actualFromId}`]?.name || "차량"} 분수기` 
            : (deployed[`vehicle_${actualFromId}`]?.name || "기점");
          const toName = targetUnit.name || "대상";
          addLog(`${fromName} → ${toName} 수관 연장됨`, "info");
          setSelected(null); // 연결 성공 시 팝업 닫기
          clearSources();
          setDragging(null);
          dragPayloadRef.current = null;
          dragStartPosRef.current = null;
        } else if (moveDist > 20) {
          // 대상 없이 멀리 드래그하고 떼면 취소 (단순 클릭 시에는 유지)
          clearSources();
          setDragging(null);
          dragPayloadRef.current = null;
          dragStartPosRef.current = null;
        }
        return;
      } 
      
      if (payload) {
        // [낙관적 업데이트] 서버 저장 전에 UI 상태를 먼저 정리하여 '배지 끈적임' 현상 방지
        const currentPayload = payload;
        const currentOffset = offset;
        const currentIsActuallyDragging = isActuallyDragging;

        // 드래그 상태 즉시 해제
        setDragging(null);
        dragPayloadRef.current = null;
        dragStartPosRef.current = null;
        dragOffsetRef.current = { x: 0, y: 0 };

        if (currentPayload.itemType === 'yCoupling') {
          if (yCouplingIsDraggingRef.current && yCouplingDragPosRef.current) {
            const { vehicleId, lat, lng } = yCouplingDragPosRef.current;
            setYCouplingPositions(prev => ({ ...prev, [vehicleId]: { lat, lng } }));
          } else {
            setSelected(prev => prev === `y_${currentPayload.vehicleId}` ? null : `y_${currentPayload.vehicleId}`);
          }
          yCouplingDragPosRef.current = null;
          yCouplingIsDraggingRef.current = false;
          yCouplingLastClientPosRef.current = null;
          return;
        }

        // --- 연결송수구 드롭 처리 ---
        if (currentPayload?.itemType === "siamese" && currentIsActuallyDragging) {
          const rect = mapRef.current.getBoundingClientRect();
          const dropX = touch.clientX - currentOffset.x - rect.left;
          const dropY = touch.clientY - currentOffset.y - rect.top;
          const latlng = kakaoMap.getProjection().coordsFromContainerPoint(new window.kakao.maps.Point(dropX, dropY));

          if (latlng) {
            setSiameseLinks(prev => prev.map(s => s.id === currentPayload.id ? { ...s, lat: latlng.getLat(), lng: latlng.getLng() } : s));
          }
          return;
        }

        if (!currentIsActuallyDragging) {
          const compositeKey = currentPayload.itemType === "siamese" ? currentPayload.id : `${currentPayload.itemType}_${currentPayload.id}`;
          setSelected(prev => (prev === compositeKey) ? null : compositeKey);
        } else if (mapRef.current && kakaoMap) {
          setSelected(null);
          const rect = mapRef.current.getBoundingClientRect();
          const isOverMap = touch.clientX >= rect.left && touch.clientX <= rect.right
            && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
          if (isOverMap) {
            try {
              const adjustedX = touch.clientX - currentOffset.x - rect.left;
              const adjustedY = touch.clientY - currentOffset.y - rect.top;
              const latlng = kakaoMap.getProjection().coordsFromContainerPoint(new window.kakao.maps.Point(adjustedX, adjustedY));
              if (latlng) {
                const lat = latlng.getLat(), lng = latlng.getLng();
                if (!isNaN(lat) && !isNaN(lng)) {
                  const compositeKey = `${currentPayload.itemType}_${currentPayload.id}`;
                  setDeployed(prev => ({ ...prev, [compositeKey]: { ...(prev[compositeKey] || currentPayload), lat, lng, itemType: currentPayload.itemType } }));
                  // 비동기 저장은 백그라운드에서 진행
                  saveDeployment(currentPayload.id, currentPayload.itemType, lat, lng);
                  addLog(`${currentPayload.name} ${currentPayload.isMoving ? "위치 이동" : "현장 배치"}`, currentPayload.isMoving ? "move" : "deploy");
                }
              }
            } catch (err) { console.error(err); }
          } else {
            if (currentPayload.itemType === "personnel") {
              const comboKey = `personnel_${currentPayload.id}`;
              setDeployed(prev => { const next = { ...prev }; delete next[comboKey]; return next; });
              setHoseLinks(prev => prev.filter(l => l.toId !== currentPayload.id));
              setWaterSprayLinks(prev => prev.filter(s => s.personnelId !== currentPayload.id));
              removeDeployment(currentPayload.id, "personnel");
              addLog(`${currentPayload.name} 철수 완료`, "recall");
            } else if (currentPayload.itemType === "vehicle") {
              setShowConfirm({ type: "recall", id: currentPayload.id, name: currentPayload.name, itemType: "vehicle" });
            }
          }
        }
      }

      setDragging(null);
      dragPayloadRef.current = null;
      dragStartPosRef.current = null;
      dragOffsetRef.current = { x: 0, y: 0 };
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [kakaoMap, dragging, hoseDragSource, hydrantDragSource, deployed]);

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

  // [복구] 화점 마커 애니메이션 클래스 제어
  useEffect(() => {
    if (isAccidentLocked) {
      document.body.classList.add('fire-locked');
    } else {
      document.body.classList.remove('fire-locked');
    }
    return () => document.body.classList.remove('fire-locked');
  }, [isAccidentLocked]);

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
          '/icons/fire-point.svg',
            new window.kakao.maps.Size(42, 42),
            { offset: new window.kakao.maps.Point(10, 42) }
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

  useEffect(() => {
    if (!kakaoMap || !window.kakao || !mapRef.current) return;
    hoseLinesRef.current.forEach(line => {
      if (line.setMap) line.setMap(null);
    });
    hoseLinesRef.current = [];
    try {

    const createHoseSVG = (fromLatLng, toLatLng, isPreview = false, linkId = null, fromName = "", toName = "", fromType = "", toType = "", port = null) => {
      const proj = kakaoMap.getProjection();
      
      // 분수기(splitter) 또는 물탱크차(PORT 지원 차량)의 경우 포트에 따라 시작 지점 오프셋 적용
      let startP = proj.containerPointFromCoords(fromLatLng);
      if ((fromType === "splitter" || fromType === "vehicle") && port) {
        const offsetVal = port === 1 ? -6 : 6;
        startP = new window.kakao.maps.Point(startP.x + offsetVal, startP.y);
      }
      
      const p1 = startP;
      const p2 = proj.containerPointFromCoords(toLatLng);
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 1) return null;

      const midLatLng = proj.coordsFromContainerPoint(new window.kakao.maps.Point(
        (p1.x + p2.x) / 2,
        (p1.y + p2.y) / 2
      ));
      const pm = proj.containerPointFromCoords(midLatLng);

      const r1x = p1.x - pm.x, r1y = p1.y - pm.y;
      const r2x = p2.x - pm.x, r2y = p2.y - pm.y;
      const rdx = r2x - r1x, rdy = r2y - r1y;

      const nx = -rdy / length, ny = rdx / length;
      const bend = Math.min(length * 0.15, 35);
      
      const offS = (fromType === "splitter" || fromType === "personnel") ? 6 : 12;
      const offE = (toType === "splitter" || toType === "personnel") ? 6 : 12;
      const sx = r1x + (rdx / length) * offS, sy = r1y + (rdy / length) * offS;
      const ex = r2x - (rdx / length) * offE, ey = r2y - (rdy / length) * offE;

      const cp1x = sx + (ex - sx) * 0.33 - nx * bend;
      const cp1y = sy + (ey - sy) * 0.33 - ny * bend;
      const cp2x = sx + (ex - sx) * 0.66 + nx * bend;
      const cp2y = sy + (ey - sy) * 0.66 + ny * bend;

      const pad = 40;
      const minX = Math.min(sx, ex, cp1x, cp2x) - pad;
      const minY = Math.min(sy, ey, cp1y, cp2y) - pad;
      const maxX = Math.max(sx, ex, cp1x, cp2x) + pad;
      const maxY = Math.max(sy, ey, cp1y, cp2y) + pad;
      const W = maxX - minX, H = maxY - minY;

      const pathD = `M ${sx-minX} ${sy-minY} C ${cp1x-minX} ${cp1y-minY} ${cp2x-minX} ${cp2y-minY} ${ex-minX} ${ey-minY}`;

      const uid = `hose_${linkId || Date.now()}`;
      const content = document.createElement("div");
      content.style.cssText = `position: absolute; width: ${W}px; height: ${H}px; transform: translate(${minX}px, ${minY}px); pointer-events: none; z-index: ${isPreview ? 51 : 50};`;
      content.innerHTML = `
        <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <path d="${pathD}" fill="none" stroke="#007bff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.2"/>
          <path d="${pathD}" fill="none" stroke="#00aaff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray="${isPreview ? '8,8' : '20,10'}" style="animation: hoseFlow_${uid} 0.8s linear infinite;"/>
          ${!isPreview && linkId ? `<circle cx="${(sx+ex)/2-minX}" cy="${(sy+ey)/2-minY}" r="20" fill="transparent" style="pointer-events:auto; cursor:pointer;"/>` : ''}
          <style> @keyframes hoseFlow_${uid} { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -50; } } </style>
        </svg>
      `;
      if (!isPreview && linkId) {
        content.querySelector('circle').addEventListener('click', (e) => {
          e.stopPropagation();
          setShowConfirm({ type: "hose", linkId, fromName, toName });
        });
      }
      return new window.kakao.maps.CustomOverlay({ position: midLatLng, content, xAnchor: 0, yAnchor: 0, zIndex: isPreview ? 51 : 50 });
    };

    // [복구] 차량 ➔ 분기점(분수기) 공급 수관 자동 렌더링 (포트별 독립 그룹화)
    const uniqueSplitterSources = [];
    hoseLinks.filter(l => l.toType === "personnel" && (l.fromType === "vehicle" || !l.fromType)).forEach(link => {
      const key = `${link.fromId}_${link.port || 1}`;
      if (!uniqueSplitterSources.includes(key)) uniqueSplitterSources.push(key);
    });

    uniqueSplitterSources.forEach(sourceKey => {
      const [vId, portStr] = sourceKey.split("_");
      const port = parseInt(portStr);
      const v = deployed[`vehicle_${vId}`];
      if (!v) return;

      const pLinks = hoseLinks.filter(l => String(l.fromId) === String(vId) && (l.port || 1) === port && l.toType === "personnel");
      if (pLinks.length >= 1) {
        const compoundId = `${vId}_${port}`;
        let yPos = yCouplingPositions[compoundId];
        if (!yPos) {
          let avgLat = 0, avgLng = 0;
          pLinks.forEach(l => {
            const p = personnel.find(per => String(per.id) === String(l.toId));
            const pDep = deployed[`personnel_${l.toId}`] || p;
            if (pDep) { avgLat += pDep.lat; avgLng += pDep.lng; }
          });
          avgLat /= pLinks.length; avgLng /= pLinks.length;
          yPos = { lat: v.lat + (avgLat - v.lat) * 0.4, lng: v.lng + (avgLng - v.lng) * 0.4 };
        }
        const overlay = createHoseSVG(
          new window.kakao.maps.LatLng(v.lat, v.lng),
          new window.kakao.maps.LatLng(yPos.lat, yPos.lng),
          false, `feeder_${compoundId}`, v.name, "분수기", "vehicle", "splitter", port
        );
        if (overlay) { overlay.setMap(kakaoMap); hoseLinesRef.current.push(overlay); }
      }
    });

    hoseLinks.forEach(link => {
      const vId = link.fromId;
      const v = deployed[`vehicle_${vId}`];
      const port = link.port || 1;
      const pLinks = hoseLinks.filter(l => String(l.fromId) === String(vId) && (l.port || 1) === port && (l.toType === "personnel" || !l.toType));
      
      const compoundId = `${vId}_${port}`;
      // 분수기 사용 여부 판단 (타겟이 대원일 때만 분수기 활성화)
      let isSplitter = (link.fromType === "splitter" || pLinks.length >= 1) && (link.toType === "personnel" || !link.toType);
      
      let fromCoord = null;
      // 드래그 중인 기점 유닛(차량)의 실시간 좌표 우선 적용
      const isFromDragging = dragging && String(dragging.id) === String(vId) && dragging.itemType === "vehicle";
      
      if (isSplitter && v) {
        if (yCouplingPositions[compoundId]) {
          fromCoord = yCouplingPositions[compoundId];
        } else if (pLinks.length > 0) {
          let avgLat = 0, avgLng = 0;
          pLinks.forEach(l => {
            const p = personnel.find(per => String(per.id) === String(l.toId));
            const pDep = deployed[`personnel_${l.toId}`] || p;
            if (pDep) { avgLat += pDep.lat; avgLng += pDep.lng; }
          });
          avgLat /= pLinks.length; avgLng /= pLinks.length;
          fromCoord = {
            lat: v.lat + (avgLat - v.lat) * 0.4,
            lng: v.lng + (avgLng - v.lng) * 0.4
          };
        }
      } else if (isFromDragging && dragPos && mapRef.current) {
        const rect = mapRef.current.getBoundingClientRect();
        const latlng = kakaoMap.getProjection().coordsFromContainerPoint(
          new window.kakao.maps.Point(dragPos.x - rect.left, dragPos.y - rect.top)
        );
        if (latlng) fromCoord = { lat: latlng.getLat(), lng: latlng.getLng() };
      } else {
        fromCoord = v;
      }

      const toType = link.toType || "personnel";
      let to = null;
      
      // 드래그 중인 타겟 유닛의 실시간 좌표 우선 적용
      const isTargetDragging = dragging && String(dragging.id) === String(link.toId) && dragging.itemType === toType;
      
      if (isTargetDragging && dragPos && mapRef.current) {
        const rect = mapRef.current.getBoundingClientRect();
        const latlng = kakaoMap.getProjection().coordsFromContainerPoint(
          new window.kakao.maps.Point(dragPos.x - rect.left, dragPos.y - rect.top)
        );
        if (latlng) to = { lat: latlng.getLat(), lng: latlng.getLng(), name: dragging.name };
      }

      if (!to) {
        if (toType === "siamese") {
          to = siameseLinks.find(s => s.id === link.toId);
        } else {
          to = deployed[`${toType}_${link.toId}`] || (toType === "personnel" ? personnel.find(p => p.id === link.toId) : null);
        }
      }
      
      if (fromCoord && to) {
        const fromName = isSplitter ? "분수기" : (v?.name || "");
        const toName = to.name || (toType === "personnel" ? "대원" : "차량");
        
        // [중요] 분수기 내부 포트 번호 자동 계산 (기존 차량 포트와 무관하게 인덱스 기반으로 1, 2 할당)
        let displayPort = link.port;
        if (isSplitter) {
           const idx = pLinks.findIndex(l => String(l.id) === String(link.id));
           displayPort = idx >= 0 ? idx + 1 : 1;
        }

        const overlay = createHoseSVG(
          new window.kakao.maps.LatLng(fromCoord.lat, fromCoord.lng),
          new window.kakao.maps.LatLng(to.lat, to.lng),
          false, link.id, fromName, toName,
          isSplitter ? "splitter" : "vehicle", toType,
          displayPort
        );
        if (overlay) { overlay.setMap(kakaoMap); hoseLinesRef.current.push(overlay); }
      }
    });

    if (hoseDragSource && dragPos && mapRef.current) {
      const sourceStr = hoseDragSource.toString();
      const isFromSplitter = sourceStr.startsWith("y_");
      const isFromPortedVehicle = sourceStr.startsWith("v_");
      const parts = sourceStr.split("_");
      const vId = (isFromSplitter || isFromPortedVehicle) ? parts[1] : hoseDragSource;
      const port = (isFromSplitter || isFromPortedVehicle) ? parseInt(parts[2]) : 1;
      const compoundId = `${vId}_${port}`;
      const fromCoord = isFromSplitter ? yCouplingPositions[compoundId] : deployed[`vehicle_${vId}`];

      if (fromCoord) {
        const rect = mapRef.current.getBoundingClientRect();
        const latlng = kakaoMap.getProjection().coordsFromContainerPoint(
          new window.kakao.maps.Point(dragPos.x - rect.left, dragPos.y - rect.top)
        );
        if (latlng) {
          const fromName = isFromSplitter ? "분수기" : (deployed[`vehicle_${vId}`]?.name || "");
          const overlay = createHoseSVG(
            new window.kakao.maps.LatLng(fromCoord.lat, fromCoord.lng),
            latlng, true, null, fromName, "", 
            isFromSplitter ? "splitter" : "vehicle", "preview",
            port
          );
          if (overlay) { overlay.setMap(kakaoMap); hoseLinesRef.current.push(overlay); }
        }
      }
    }
    } catch (e) {
      console.error("Rendering error:", e);
    }
  }, [kakaoMap, hoseLinks, deployed, hoseDragSource, dragging, dragPos, mapZoom, mapSize, yCouplingPositions]);

  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    waterSprayRef.current.forEach(o => o.setMap(null));
    waterSprayRef.current = [];
    if (!accidentPos) return;

    waterSprayLinks.forEach(link => {
      let originCoord = null;
      let isPersonnel = false;

      if (link.vehicleId) {
        const v = deployed[`vehicle_${link.vehicleId}`];
        if (v) originCoord = new window.kakao.maps.LatLng(v.lat, v.lng);
      } else if (link.personnelId) {
        const p = deployed[`personnel_${link.personnelId}`];
        if (p) { originCoord = new window.kakao.maps.LatLng(p.lat, p.lng); isPersonnel = true; }
      }

      if (!originCoord || !accidentPos) return;

      const proj = kakaoMap.getProjection();
      const vp = proj.containerPointFromCoords(originCoord);
      const ap = proj.containerPointFromCoords(new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng));
      const angle = Math.atan2(ap.y - vp.y, ap.x - vp.x) * 180 / Math.PI;

      const dx = ap.x - vp.x;
      const dy = ap.y - vp.y;
      const r = Math.sqrt(dx * dx + dy * dy);

      // SVG 크기를 넉넉하게 잡음 (곡선과 물보라 고려)
      const svgSize = r * 2 + 100;
      const cx = svgSize / 2, cy = svgSize / 2;

      // [신규 설계] 2차 베지어 곡선(Quadratic Bezier)을 이용한 유선형 방수
      const sprayConfig = isPersonnel 
        ? { angles: [-5, -2.5, 0, 2.5, 5], width: 3.5, dash: '6,10', durBase: 0.2, opacity: 0.7 }
        : { angles: [-5, -2.5, 0, 2.5, 5], width: 7.5, dash: '12,8', durBase: 0.2, opacity: 0.9 };

      const uid = `spray_${link.id || Math.random().toString(36).substr(2, 9)}`;
      
      const paths = sprayConfig.angles.map((deg, i) => {
        const rad = deg * Math.PI / 180;
        // 끝점 계산
        const ex = cx + r * Math.cos(rad);
        const ey = cy + r * Math.sin(rad);
        
        // 베지어 제어점(Control Point) 계산: 중간 지점에서 바깥쪽으로 살짝 휨
        // 평면 지도상에서 확산되는 느낌을 주기 위함
        const midX = cx + (r / 2) * Math.cos(rad);
        const midY = cy + (r / 2) * Math.sin(rad);
        
        // 제어점 오프셋 (각도에 비례하여 바깥으로 밀어냄)
        const bendFactor = deg * 0.4; 
        const bendRad = (angle + 90) * Math.PI / 180;
        const qx = midX + Math.cos(bendRad) * bendFactor;
        const qy = midY + Math.sin(bendRad) * bendFactor;

        return `
          <path d="M ${cx} ${cy} Q ${qx} ${qy} ${ex} ${ey}" 
                fill="none" stroke="url(#sprayGrad_${uid})" 
                stroke-width="${sprayConfig.width}" 
                stroke-dasharray="${sprayConfig.dash}" 
                stroke-linecap="round" opacity="${sprayConfig.opacity}"
                style="animation: sprayFlow_${uid} ${sprayConfig.durBase + i * 0.05}s linear infinite, 
                          sprayWobble_${uid} ${1 + i * 0.1}s ease-in-out infinite alternate;">
          </path>
        `;
      }).join("");

      // 착탄지 물보라/안개 효과
      const mistEffect = `
        <g transform="translate(${cx + r}, ${cy})">
          <circle cx="0" cy="0" r="8" fill="#7ec8e3" opacity="0.4">
            <animate attributeName="r" from="5" to="25" dur="1s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.4" to="0" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle cx="5" cy="-5" r="5" fill="#fff" opacity="0.3">
            <animate attributeName="r" from="3" to="15" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.3" to="0" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="-5" cy="5" r="5" fill="#fff" opacity="0.3">
            <animate attributeName="r" from="3" to="15" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.3" to="0" dur="0.8s" repeatCount="indefinite" />
          </circle>
        </g>
      `;

      const content = document.createElement("div");
      content.style.cssText = `
        position: absolute;
        width: ${svgSize}px; height: ${svgSize}px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 40;
      `;
      content.innerHTML = `
        <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="transform: rotate(${angle}deg); transform-origin: center;">
          <defs>
            <linearGradient id="sprayGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:rgba(0, 122, 255, 0.9)" />
              <stop offset="70%" style="stop-color:rgba(126, 200, 227, 0.6)" />
              <stop offset="100%" style="stop-color:rgba(255, 255, 255, 0.8)" />
            </linearGradient>
            <filter id="glow_${uid}">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#glow_${uid})">
            ${paths}
          </g>
          ${mistEffect}
          <circle cx="${cx}" cy="${cy}" r="4" fill="#fff" opacity="0.8"/>
          <style> 
            @keyframes sprayFlow_${uid} { from { stroke-dashoffset: 50; } to { stroke-dashoffset: 0; } } 
            @keyframes sprayWobble_${uid} { 
              from { transform: translate(0, 0); } 
              to { transform: translate(0, ${isPersonnel ? '1px' : '3px'}); } 
            }
          </style>
        </svg>
      `;

      const overlay = new window.kakao.maps.CustomOverlay({
        position: originCoord,
        content,
        xAnchor: 0.5, yAnchor: 0.5,
        zIndex: 40
      });
      overlay.setMap(kakaoMap);
      waterSprayRef.current.push(overlay);
    });
  }, [kakaoMap, waterSprayLinks, deployed, accidentPos, mapZoom, mapSize]);

  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    hydrantMarkersRef.current.forEach(o => o.setMap(null));
    hydrantMarkersRef.current = [];
    if (!hydrantVisible || !accidentPos || !hydrantRadius) return;
    const nearby = HYDRANT_DATA.filter(h => {
      const d = getDistance(accidentPos.lat, accidentPos.lng, h.lat, h.lng);
      return d <= hydrantRadius / 1000;
    });

    const deployedVehicles = Object.values(deployed).filter(d => d.itemType === 'vehicle');

    const isDotMode = mapZoom >= 4;

    nearby.forEach(h => {
      const pos = new window.kakao.maps.LatLng(h.lat, h.lng);
      const isCaptured = hydrantCaptureLinks.some(l => l.hydrantId === h.id);
      const uid = `hyd_${h.id}`;

      const el = document.createElement("div");

      if (isDotMode) {
        el.style.cssText = `cursor:pointer; width:8px; height:8px; border-radius:50%; background:${isCaptured ? '#ff4500' : '#ff4444'}; box-shadow:0 0 4px ${isCaptured ? '#ff4500aa' : '#ff444488'};`;
      } else if (isCaptured) {
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
        if (el._popupOpen) {
          hydrantMarkersRef.current.forEach(o => { if (o._isPopup) o.setMap(null); });
          hydrantMarkersRef.current = hydrantMarkersRef.current.filter(o => !o._isPopup);
          el._popupOpen = false;
          return;
        }
        hydrantMarkersRef.current.forEach(o => { if (o._isPopup) o.setMap(null); });
        hydrantMarkersRef.current = hydrantMarkersRef.current.filter(o => !o._isPopup);
        el._popupOpen = true;

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

  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    hydrantLinesRef.current.forEach(o => o.setMap(null));
    hydrantLinesRef.current = [];
    if (!hydrantVisible || hydrantCaptureLinks.length === 0) return;

    hydrantCaptureLinks.forEach(link => {
      const vehicle = deployed[`vehicle_${link.vehicleId}`];
      if (!vehicle) return;

      const fromLatLng = new window.kakao.maps.LatLng(link.hydrantLat, link.hydrantLng);
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
        </svg>
      `;
      const overlay = new window.kakao.maps.CustomOverlay({ position: midLatLng, content, xAnchor: 0, yAnchor: 0, zIndex: 49 });
      overlay.setMap(kakaoMap);
      hydrantLinesRef.current.push(overlay);
    });
  }, [kakaoMap, hydrantVisible, hydrantCaptureLinks, deployed, mapZoom, mapSize]);

  // 소화전 점령 드래그 미리보기 선
  const hydrantPreviewLineRef = useRef(null);
  useEffect(() => {
    if (hydrantPreviewLineRef.current) {
      hydrantPreviewLineRef.current.setMap(null);
      hydrantPreviewLineRef.current = null;
    }
    if (!kakaoMap || !hydrantDragSource || !dragPos || !mapRef.current) return;
    const vehicle = deployed[`vehicle_${hydrantDragSource}`];
    if (!vehicle) return;
    const rect = mapRef.current.getBoundingClientRect();
    const cursorLatLng = kakaoMap.getProjection().coordsFromContainerPoint(
      new window.kakao.maps.Point(dragPos.x - rect.left, dragPos.y - rect.top)
    );
    if (!cursorLatLng) return;
    const fromLatLng = new window.kakao.maps.LatLng(vehicle.lat, vehicle.lng);
    const proj = kakaoMap.getProjection();
    const p1 = proj.containerPointFromCoords(fromLatLng);
    const p2 = proj.containerPointFromCoords(cursorLatLng);
    const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
    const midLatLng = proj.coordsFromContainerPoint(new window.kakao.maps.Point(cx, cy));
    if (!midLatLng) return;
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const pad = 30;
    const minX = Math.min(p1.x, p2.x) - pad - cx, minY = Math.min(p1.y, p2.y) - pad - cy;
    const maxX = Math.max(p1.x, p2.x) + pad - cx, maxY = Math.max(p1.y, p2.y) + pad - cy;
    const W = maxX - minX, H = maxY - minY;
    const r1x = p1.x - cx - minX, r1y = p1.y - cy - minY;
    const r2x = p2.x - cx - minX, r2y = p2.y - cy - minY;
    const content = document.createElement('div');
    content.style.cssText = `position:absolute;width:${W}px;height:${H}px;transform:translate(${minX}px,${minY}px);pointer-events:none;z-index:52;`;
    content.innerHTML = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${r1x}" y1="${r1y}" x2="${r2x}" y2="${r2y}" stroke="#ff4500" stroke-width="2.5" stroke-dasharray="10,6" opacity="0.8"/>
    </svg>`;
    const overlay = new window.kakao.maps.CustomOverlay({ position: midLatLng, content, xAnchor: 0, yAnchor: 0, zIndex: 52 });
    overlay.setMap(kakaoMap);
    hydrantPreviewLineRef.current = overlay;
    return () => { overlay.setMap(null); hydrantPreviewLineRef.current = null; };
  }, [kakaoMap, hydrantDragSource, dragPos, deployed, mapZoom]);

  const moveToMyLocation = () => {
    if (!navigator.geolocation) return alert("GPS를 지원하지 않는 브라우저입니다.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setAccidentPos({ lat: latitude, lng: longitude });
        kakaoMap.panTo(new window.kakao.maps.LatLng(latitude, longitude));
        addLog("현재 위치로 사고 지점 이동 (고정밀 GPS)", "info");
      },
      (err) => {
        let msg = "위치를 가져올 수 없습니다.";
        if (err.code === 1) msg = "위치 정보 권한이 거부되었습니다.";
        else if (err.code === 2) msg = "위치 정보를 사용할 수 없습니다.";
        else if (err.code === 3) msg = "요청 시간이 초과되었습니다.";
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleSaveLogs = () => {
    if (logs.length === 0) return alert("저장할 기록이 없습니다.");
    try {
      const csvRows = ["\uFEFF시간,유형,내용"];
      logs.forEach(log => {
        const cleanText = log.text.replace(/"/g, '""');
        csvRows.push(`${log.timestamp},${log.type},"${cleanText}"`);
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
    setWaterSprayLinks(prev => prev.filter(s => s.vehicleId !== showConfirm.id && s.personnelId !== showConfirm.id));
    // [추가] 차량/대원 철수 시 해당 개체와 연결된 모든 요소(물줄기, 수관, 소화전 점령, 분수기) 제거
    if (itemType === 'vehicle') {
      setHoseLinks(prev => prev.filter(l => l.fromId !== showConfirm.id));
      setHydrantCaptureLinks(prev => prev.filter(l => l.vehicleId !== showConfirm.id));
      setYCouplingPositions(prev => {
        const next = { ...prev };
        delete next[showConfirm.id]; // 기본 키 삭제
        // 복합 키(vId_port) 삭제
        Object.keys(next).forEach(key => {
          if (key.startsWith(`${showConfirm.id}_`)) delete next[key];
        });
        return next;
      });
    } else {
      setHoseLinks(prev => prev.filter(l => l.toId !== showConfirm.id));
    }
    
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
            <div style={{ position: "absolute", top: 12, left: 0, right: 0, zIndex: 10005, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, pointerEvents: "none" }}>
              {!isAccidentLocked && (
                <div style={{ background: "rgba(14, 25, 37, 0.95)", border: "1px solid #ff4500", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.6)", pointerEvents: "auto" }}>
                  <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>화재 지점을 드래그하여 설정하세요</span>
                  <button onClick={() => { setIsAccidentLocked(true); addLog("화재 지점 위치 확정", "warning"); }} style={{ background: "linear-gradient(135deg, #ff4500, #ff8c00)", border: "none", borderRadius: 8, color: "#ffff00", padding: "6px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 10px rgba(255,69,0,0.4)" }}>화재 지점 확정</button>
                </div>
              )}

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

          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10006, display: "flex", flexDirection: "column", gap: 12, pointerEvents: "none" }}>
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
              <div style={{ position: "fixed", left: dragPos.x - dragOffsetRef.current.x, top: dragPos.y - dragOffsetRef.current.y, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 9999, background: dragging.itemType === "vehicle" ? "#1e2a3a" : (dragging.itemType === "personnel" ? "#2a1a1a" : "linear-gradient(135deg, #065f46, #064e3b)"), border: dragging.itemType === "siamese" ? "2px solid #10b981" : "2px dashed #ff4500", borderRadius: dragging.itemType === "vehicle" || dragging.itemType === "siamese" ? 8 : "50%", padding: dragging.itemType === "siamese" ? "6px 10px" : "6px 12px", display: "flex", alignItems: "center", boxShadow: dragging.itemType === "siamese" ? "0 4px 20px rgba(16,185,129,0.5)" : "0 4px 20px rgba(255,69,0,0.6)", opacity: 0.9 }}>
                {dragging.itemType === "siamese" ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ width: 14, height: 14, background: "#f87171", border: "1.5px solid #d4af37", borderRadius: "50%", position: "relative" }}>
                      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1.5, background: "#d4af37", transform: "translateY(-50%)" }}></div>
                    </div>
                    <div style={{ width: 14, height: 14, background: "#f87171", border: "1.5px solid #d4af37", borderRadius: "50%", position: "relative" }}>
                      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1.5, background: "#d4af37", transform: "translateY(-50%)" }}></div>
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{dragging.name}</span>
                )}
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

          {selectedDistrict && (
            <>
              {/* --- 신규: 연결송수구 배치 버튼 --- */}
              <div style={{ position: "absolute", bottom: 230, right: 20, zIndex: 10006 }}>
                <button
                  onClick={() => {
                    if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요.");
                    if (siameseLinks.length > 0) return alert("이미 연결송수구가 배치되어 있습니다. 드래그하여 이동시키거나 기존 것을 제거해 주세요.");
                    const newId = `siamese_${Date.now()}`;
                    const newConn = {
                      id: newId,
                      lat: accidentPos.lat + (Math.random() - 0.5) * 0.0002,
                      lng: accidentPos.lng + (Math.random() - 0.5) * 0.0002,
                      name: "연결송수구"
                    };
                    setSiameseLinks(prev => [...prev, newConn]);
                    addLog("지도상에 연결송수구 배치", "info");
                  }}
                  style={{
                    width: 56, height: 56,
                    background: "linear-gradient(135deg, #064e3b, #065f46)",
                    border: "1px solid #10b98166",
                    borderRadius: "50%", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    pointerEvents: "auto",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.1)";
                    e.currentTarget.style.borderColor = "#10b981";
                    e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.3)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.borderColor = "#10b98166";
                    e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)";
                  }}
                  title="연결송수구 배치"
                >
                  <svg viewBox="0 -4 64 52" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="38" width="60" height="6" rx="1" fill="#064e3b" stroke="#10b981" strokeWidth="2"/>
                    <path d="M6 38V22C6 17.5817 9.5817 14 14 14H50C54.4183 14 58 17.5817 58 22V38" stroke="#10b981" strokeWidth="3"/>
                    <circle cx="15" cy="18" r="11" fill="#f87171" stroke="#fbbf24" strokeWidth="2.5"/>
                    <circle cx="49" cy="18" r="11" fill="#f87171" stroke="#fbbf24" strokeWidth="2.5"/>
                    <path d="M6 18H15M49 18H58" stroke="#fbbf24" strokeWidth="2.5"/>
                  </svg>
                </button>
              </div>

              <div style={{ position: "absolute", bottom: 160, right: 20, zIndex: 10006 }}>
                <button
                  onClick={moveToMyLocation}
                  style={{
                    width: 56, height: 56,
                    background: "linear-gradient(135deg, #1e3a52, #0f1a2a)",
                    border: "1px solid #7ec8e366",
                    borderRadius: "50%", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    pointerEvents: "auto",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.1)";
                    e.currentTarget.style.borderColor = "#7ec8e3";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.borderColor = "#7ec8e366";
                  }}
                  title="현재 위치로 사고 지점 설정"
                >
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#7ec8e3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="22" y1="12" x2="18" y2="12" />
                    <line x1="6" y1="12" x2="2" y2="12" />
                    <line x1="12" y1="6" x2="12" y2="2" />
                    <line x1="12" y1="22" x2="12" y2="18" />
                    <circle cx="12" cy="12" r="3" fill="#7ec8e3" />
                  </svg>
                </button>
              </div>

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
                      setHydrantVisible(false);
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

        <div style={{ 
          width: 250, background: "#080f1a", borderLeft: "1px solid #1e3a52", 
          display: "flex", flexDirection: "column", position: "relative", zIndex: 100, 
          filter: isLight ? "invert(1) hue-rotate(180deg)" : "none",
          marginRight: isSidebarOpen ? 0 : -250,
          transition: "margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
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
          <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000, backdropFilter: "blur(4px)" }} onClick={() => setShowConfirm(null)}>
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
          <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000, backdropFilter: "blur(4px)" }} onClick={() => setShowResetConfirm(false)}>
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
        )
      }

      {
        showWaterAdjust && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40000, backdropFilter: "blur(10px)" }} onClick={() => setShowWaterAdjust(null)}>
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
