import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { VEHICLE_ICONS, VEHICLE_LABELS, ROLES, DISTRICTS, getDistance, HOSPITALS } from "../constants";
import KakaoMap from "./KakaoMap";
import WeatherWidget from "./WeatherWidget";

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
  const [dragging, setDragging] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const handleMciDeconstruction = () => {
    setMciPos(null);
    setMciSetupStarted(false);
    setIsMciLocked(false);
    setSelected(null);
    addLog("현장응급의료소 해체 완료", "recall");
  };
  const fireMarkerRef = useRef(null);
  const mciMarkerRef = useRef(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGlobalResetInit, setShowGlobalResetInit] = useState(false);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const dragPayloadRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef(null);
  const hoseLinesRef = useRef([]);
  const waterSprayRef = useRef([]);
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
      accidentAddress
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

  const handleDeleteTarget = async (targetId, name) => {
    if (!confirm(`대상물 "${name}"을(를) 삭제하시겠습니까?\n모든 관련 전술 스냅샷도 함께 삭제됩니다.`)) return;
    
    try {
      // 1. 관련 스냅샷 삭제
      await supabase.from("tactical_snapshots").delete().eq("target_id", targetId);
      // 2. 대상물 삭제
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
    addLog(`전술 스냅샷 불러오기 완료: ${snapshot.name}`, "info");
    setShowUtilityModal(false);
    
    if (kakaoMap && data.accidentPos) {
      kakaoMap.panTo(new window.kakao.maps.LatLng(data.accidentPos.lat, data.accidentPos.lng));
      kakaoMap.setLevel(2);
    }
  };

  const SEVERITIES = [
    { key: "red", label: "긴급", color: "#ff4d4d" },
    { key: "yellow", label: "응급", color: "#ffcc00" },
    { key: "green", label: "비응급", color: "#4ade80" },
    { key: "black", label: "지연", color: "#666" }
  ];
  const TRANSPORT_STATUSES = ["환자 이송 중", "병원 도착", "복귀 중"];

  const UTILITY_MENU_ITEMS = [
    { key: "calc", label: "방수압력 계산기", desc: "고층화재 층수/호스별 최적 압력", icon: "🧮", color: "#3b82f6", gradient: "linear-gradient(135deg, #1e3a8a, #3b82f6)" },
    { key: "mci", label: "다수사상자 대응 (MCI)", desc: "응급의료소 설치 및 실시간 환자 관리", icon: "🚑", color: "#f97316", gradient: "linear-gradient(135deg, #9a3412, #f97316)" },
    { key: "forest_fire", label: "산불진화", desc: "지표화/수관화 분석 및 진화 전술", icon: "🌲", color: "#22c55e", gradient: "linear-gradient(135deg, #166534, #22c55e)" },
  ];

  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    const handleZoomChanged = () => setMapZoom(kakaoMap.getLevel());
    window.kakao.maps.event.addListener(kakaoMap, 'zoom_changed', handleZoomChanged);
    return () => window.kakao.maps.event.removeListener(kakaoMap, 'zoom_changed', handleZoomChanged);
  }, [kakaoMap]);

  const saveDeployment = async (itemId, itemType, lat, lng) => {
    try {
      await supabase.from("deployments").upsert({ item_id: itemId, item_type: itemType, lat, lng }, { onConflict: "item_id" });
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
        if (["지휘", "삼랑진119안전센터", "경남소방본부"].includes(center.name)) return 3;
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
        const isSelected = selected === item.id;
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
          dragPayloadRef.current = { ...item, isMoving: true };
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
          crewList.style.cssText = "padding: 12px; max-height: 180px; overflow-y: auto;";
          const vehicleCrew = personnel.filter(p => p.vehicle_id === item.id && !deployed[p.id]);
          if (vehicleCrew.length > 0) {
            const crewTitle = document.createElement("div");
            crewTitle.style.cssText = "font-size: 11px; color: #7ec8e3; margin-bottom: 8px; font-weight: 600;";
            crewTitle.innerText = `탑승 대원 (${vehicleCrew.length}명)`;
            crewList.appendChild(crewTitle);
            vehicleCrew.forEach(p => {
              const crewItem = document.createElement("div");
              crewItem.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: #0a1828; border-radius: 6px; margin-bottom: 4px; border: 1px solid #1e3a52; cursor: grab;";
              crewItem.innerHTML = `<span style="font-size: 14px; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px;"><img src="/icons/fireman.svg" alt="대원" style="width: 100%; height: 100%;" /></span> <span style="font-size: 13px;">${p.name}</span> <span style="font-size: 10px; color: #4a7a9b; border: 1px solid #1e3a52; padding: 1px 4px; border-radius: 4px;">${p.role}</span>`;
              const handleCrewDragStart = (e) => {
                // 터치 시 즉시 preventDefault 하지 않음 (스크롤을 위해)
                const isTouch = e.type === 'touchstart';
                const touch = isTouch ? e.touches[0] : e;
                
                // 터치 위치와 엘리먼트 위치를 계산하여 오프셋 보정
                const rect = e.currentTarget.getBoundingClientRect();
                dragOffsetRef.current = {
                  x: touch.clientX - (rect.left + rect.width / 2),
                  y: touch.clientY - (rect.top + rect.height / 2)
                };
                
                dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                dragPayloadRef.current = { ...p, itemType: "personnel", isMoving: false };
                setSelected(null);
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
          const canExtendHose = ["pump", "tanker", "chemical", "forest"].includes(item.type);
          if (canExtendHose) {
            const hoseRow = document.createElement("div");
            hoseRow.style.cssText = "display: flex; gap: 6px; width: 100%;";
            const hoseBtn = document.createElement("button");
            let waterInfo = null;
            if (item.water_capacity > 0) {
              waterInfo = document.createElement("div");
              waterInfo.innerText = `수량: ${item.water_capacity}L`;
              waterInfo.style.cssText = "flex: 1; background: #004a7c; border: 1px solid #009dff; border-radius: 6px; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; cursor: pointer;";
              waterInfo.onclick = (e) => {
                e.stopPropagation();
                setShowWaterAdjust({ id: item.id, name: item.name, current: item.water_capacity });
              };
            }

            const existingLink = hoseLinks.find(l => l.fromId === item.id);
            if (existingLink) {
              hoseBtn.innerText = "수관 철수";
              hoseBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              hoseBtn.onclick = (e) => {
                e.stopPropagation();
                const toName = deployed[existingLink.toId]?.name || "차량";
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
            hoseRow.appendChild(hoseBtn);
            if (waterInfo) hoseRow.appendChild(waterInfo);
            actions.appendChild(hoseRow);

            // 방수 버튼 + 현장 철수 (canExtendHose 차량만)
            const bottomRow = document.createElement("div");
            bottomRow.style.cssText = "display: flex; gap: 6px; width: 100%;";
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
            const recallBtn = document.createElement("button");
            recallBtn.innerText = "🚨 현장 철수";
            recallBtn.style.cssText = "flex: 1; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
            recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name }); };
            bottomRow.appendChild(sprayBtn);
            bottomRow.appendChild(recallBtn);
            actions.appendChild(bottomRow);
          } else {
            // 수관 없는 차량: 현장 철수만 전체 너비
            const recallBtn = document.createElement("button");
            recallBtn.innerText = "🚨 현장 철수";
            recallBtn.style.cssText = "width: 100%; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
            recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name }); };
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
          recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name }); };
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
      } else if (selected === "mci-site" && mciPos) {
        // MCI 전용 팝업
        const popupDiv = document.createElement("div");
        popupDiv.style.cssText = `
          background: linear-gradient(135deg, #0e1e2e, #16263a);
          border: 1px solid #ff4d4d; border-radius: 12px; padding: 16px;
          min-width: 180px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
          position: relative; color: #fff; text-align: center; margin-bottom: 20px;
          font-family: 'Pretendard', sans-serif;
        `;
        const title = document.createElement("div");
        title.style.cssText = "font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #ff7050;";
        title.innerText = "🚑 현장응급의료소";
        popupDiv.appendChild(title);

        const msg = document.createElement("div");
        msg.style.cssText = "font-size: 12px; color: #7ec8e3; line-height: 1.5;";
        msg.innerHTML = "자세한 사항은<br/>좌상단 배지를 클릭하세요";
        popupDiv.appendChild(msg);

        const recallBtn = document.createElement("button");
        recallBtn.innerText = "🚨 의료소 해체";
        recallBtn.style.cssText = "width: 100%; margin-top: 14px; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff4d4d66; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
        recallBtn.onclick = (e) => {
          e.stopPropagation();
          if (window.confirm("현장응급의료소를 해체하시겠습니까?")) {
            handleMciDeconstruction();
          }
        };
        popupDiv.appendChild(recallBtn);

        const closeBtn = document.createElement("div");
        closeBtn.innerText = "✕";
        closeBtn.style.cssText = "position: absolute; top: 6px; right: 10px; color: #4a7a9b; cursor: pointer; font-size: 24px; z-index: 10; line-height: 1;";
        closeBtn.onclick = (e) => { e.stopPropagation(); setSelected(null); };
        popupDiv.appendChild(closeBtn);

        const arrow = document.createElement("div");
        arrow.style.cssText = "position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #ff4d4d;";
        popupDiv.appendChild(arrow);

        const popupOverlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(mciPos.lat, mciPos.lng),
          content: popupDiv,
          yAnchor: 1.1,
          zIndex: 10000,
          clickable: true
        });
        popupOverlay.setMap(kakaoMap);
        overlaysRef.current.push(popupOverlay);
      }
    } catch (err) {
      console.error("Overlay sync error:", err);
    }
  }, [kakaoMap, deployed, selected, mapZoom, centers, personnel, waterSprayLinks, hoseLinks]);

  // document 레벨 마우스/터치 핸들러
  useEffect(() => {
    const onMove = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      if (hoseDragSource) {
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

      // 방향 무관하게 10px 이상 이동 시 드래그 시작
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        setDragging(dragPayloadRef.current);
        if (e.cancelable) e.preventDefault();
      }
    };

    const onUp = async (e) => {
      const touch = e.changedTouches ? e.changedTouches[0] : e;

      if (hoseDragSource && mapRef.current && kakaoMap) {
        const rect = mapRef.current.getBoundingClientRect();
        const point = new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top);
        const latlng = kakaoMap.getProjection().coordsFromContainerPoint(point);
        // 픽셀 기반 정밀 타겟 매칭
        let targetVehicleId = null;
        let minPixelDist = 40; // 최대 40px 반경 이내만 허용

        Object.keys(deployed).forEach(id => {
          const d = deployed[id];
          if (d.itemType !== 'vehicle' || id === hoseDragSource) return;

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
            targetVehicleId = id;
          }
        });

        if (targetVehicleId) {
          setHoseLinks(prev => [
            ...prev.filter(l => !(l.fromId === hoseDragSource && l.toId === targetVehicleId)),
            { id: Date.now(), fromId: hoseDragSource, toId: targetVehicleId }
          ]);
          const fromName = deployed[hoseDragSource]?.name || "차량";
          const toName = deployed[targetVehicleId]?.name || "차량";
          addLog(`${fromName} → ${toName} 수관 연장됨`, "info");
        }
      } else if (dragPayloadRef.current) {
        const data = dragPayloadRef.current;
        if (!dragging) {
          setSelected(prev => (prev && prev.toString()) === data.id.toString() ? null : data.id);
        } else if (mapRef.current && kakaoMap) {
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
                  setDeployed(prev => ({ ...prev, [data.id]: { ...(prev[data.id] || data), lat, lng, itemType: data.itemType } }));
                  await saveDeployment(data.id, data.itemType, lat, lng);
                  addLog(`${data.name} ${data.isMoving ? "위치 이동" : "현장 배치"}`, data.isMoving ? "move" : "deploy");
                }
              }
            } catch (err) { console.error(err); }
          }
        }
      }

      setHoseDragSource(null);
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
  }, [kakaoMap, dragging, hoseDragSource, deployed]);

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
            setSelected(prev => prev === "mci-site" ? null : "mci-site");
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

  // 수관 SVG 렌더링
  useEffect(() => {
    if (!kakaoMap || !window.kakao || !mapRef.current) return;
    hoseLinesRef.current.forEach(line => line.setMap(null));
    hoseLinesRef.current = [];

    const createHoseSVG = (fromLatLng, toLatLng, isPreview = false, linkId = null, fromName = "", toName = "") => {
      const proj = kakaoMap.getProjection();
      const p1 = proj.containerPointFromCoords(fromLatLng);
      const p2 = proj.containerPointFromCoords(toLatLng);
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const content = document.createElement("div");
      content.style.cssText = `
        position: absolute; width: ${length}px; height: 40px;
        transform-origin: 0% 50%; transform: translate(0, -20px) rotate(${angle}deg);
        pointer-events: ${isPreview ? 'none' : 'auto'}; cursor: ${isPreview ? 'default' : 'pointer'};
        z-index: ${isPreview ? 51 : 50};
      `;
      content.innerHTML = `
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="20" x2="${length}" y2="20" stroke="#007bff" stroke-width="4" stroke-linecap="round" opacity="0.3" />
          <line x1="0" y1="20" x2="${length}" y2="20" stroke="#00aaff" stroke-width="4" stroke-linecap="round"
                stroke-dasharray="${isPreview ? '8, 8' : '15, 10'}"
                class="${isPreview ? 'hose-flow-preview' : 'hose-flow-active'}" />
          <polygon points="-8,-6 8,0 -8,6" fill="#00aaff" transform="translate(${length / 2}, 20)" 
                   style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));" />
        </svg>
      `;
      if (!isPreview && linkId) {
        content.onclick = (e) => {
          e.stopPropagation();
          setShowConfirm({ type: "hose", linkId, fromName, toName });
        };
      }
      return new window.kakao.maps.CustomOverlay({ position: fromLatLng, content, xAnchor: 0, yAnchor: 0, zIndex: isPreview ? 51 : 50 });
    };

    hoseLinks.forEach(link => {
      const from = deployed[link.fromId], to = deployed[link.toId];
      if (from && to) {
        const overlay = createHoseSVG(
          new window.kakao.maps.LatLng(from.lat, from.lng),
          new window.kakao.maps.LatLng(to.lat, to.lng),
          false, link.id, from.name, to.name
        );
        overlay.setMap(kakaoMap);
        hoseLinesRef.current.push(overlay);
      }
    });

    if (hoseDragSource && dragPos && deployed[hoseDragSource] && mapRef.current) {
      const from = deployed[hoseDragSource];
      const rect = mapRef.current.getBoundingClientRect();
      const latlng = kakaoMap.getProjection().coordsFromContainerPoint(
        new window.kakao.maps.Point(dragPos.x - rect.left, dragPos.y - rect.top)
      );
      if (latlng) {
        const overlay = createHoseSVG(new window.kakao.maps.LatLng(from.lat, from.lng), latlng, true);
        overlay.setMap(kakaoMap);
        hoseLinesRef.current.push(overlay);
      }
    }
  }, [kakaoMap, hoseLinks, deployed, hoseDragSource, dragPos, mapZoom]);

  // 방수 점선 렌더링
  useEffect(() => {
    if (!kakaoMap || !window.kakao || !mapRef.current) return;
    waterSprayRef.current.forEach(o => o.setMap(null));
    waterSprayRef.current = [];
    if (!accidentPos) return;

    waterSprayLinks.forEach(link => {
      const vehicle = deployed[link.vehicleId];
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
  }, [kakaoMap, waterSprayLinks, deployed, accidentPos, mapZoom]);

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

  const removeDeployment = async (itemId) => {
    await supabase.from("deployments").delete().eq("item_id", itemId);
  };

  const confirmRecall = async () => {
    if (!showConfirm) return;
    setDeployed(prev => { const next = { ...prev }; delete next[showConfirm.id]; return next; });
    setWaterSprayLinks(prev => prev.filter(s => s.vehicleId !== showConfirm.id));
    await removeDeployment(showConfirm.id);
    addLog(`${showConfirm.name} 철수 완료`, "recall");
    setShowConfirm(null);
    setSelected(null);
  };

  const deployedIds = new Set(Object.keys(deployed));
  const vehicleDeployedIds = Object.values(deployed).filter(d => d.itemType === "vehicle").map(v => v.id);
  const totalPSet = new Set();
  Object.values(deployed).forEach(d => { if (d.itemType === "personnel") totalPSet.add(d.id); });
  personnel.forEach(p => { if (vehicleDeployedIds.includes(p.vehicle_id)) totalPSet.add(p.id); });
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
        <div style={{ width: 250, background: "#0a1420", borderRight: "1px solid #1e3a52", display: "flex", flexDirection: "column", flexShrink: 0, filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#7ec8e3", letterSpacing: 1 }}>🏢 현장 투입</div>
            <div style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 500 }}>
              차량: <span style={{ color: "#60a5fa" }}>{vehicleDeployedCount}대</span>, 대원: <span style={{ color: "#4ade80" }}>{personnelDeployedCount}명</span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
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
          {/* 상단 통합 알림 가이드 라인 */}
          {selectedDistrict && (
            <div style={{ position: "absolute", top: 16, left: 0, right: 0, zIndex: 10005, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}>
              {/* 1. 화재 지점 확정 가이드 */}
              {!isAccidentLocked && (
                <div style={{ background: "rgba(14, 25, 37, 0.95)", border: "1px solid #ff4500", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.6)", pointerEvents: "auto" }}>
                  <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>화재 지점을 드래그하여 설정하세요</span>
                  <button onClick={() => { setIsAccidentLocked(true); addLog("화재 지점 위치 확정", "warning"); }} style={{ background: "linear-gradient(135deg, #ff4500, #ff8c00)", border: "none", borderRadius: 8, color: "#ffff00", padding: "6px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 10px rgba(255,69,0,0.4)" }}>화재 지점 확정</button>
                </div>
              )}

              {/* 2. MCI 응급의료소 설치 가이드 */}
              {mciSetupStarted && !isMciLocked && (
                <div style={{ background: "rgba(14, 25, 37, 0.95)", border: "1px solid #4ade80", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,255,0,0.3)", pointerEvents: "auto" }}>
                  <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>🚑 현장응급의료소를 설치하세요</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        setIsMciLocked(true);
                        addLog("현장응급의료소 위치 확정", "info");
                      }}
                      style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
                    >현장응급의료소 확정</button>
                    <button
                      onClick={() => {
                        setMciSetupStarted(false);
                        setMciPos(null);
                        addLog("현장응급의료소 설치 취소", "recall");
                      }}
                      style={{ background: "rgba(255,255,255,0.1)", border: "1px solid #ff4500", borderRadius: 8, color: "#ff7050", padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >설치 취소</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 좌상단 MCI 현황 배지 */}
          {selectedDistrict && isMciLocked && (
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10006 }}>
              <button
                onClick={() => { setUtilityTab("mci"); setShowUtilityModal(true); setMciFromBadge(true); }}
                style={{ background: "linear-gradient(135deg, #1e3a52, #0f1a2a)", border: "1px solid #4ade80", borderRadius: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.4)", cursor: "pointer", pointerEvents: "auto" }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>MCI 대응 중</div>
                  <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 500 }}>사상자: {mciStats.red + mciStats.yellow + mciStats.green + mciStats.black}명</div>
                </div>
                <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); setIsMciLocked(false); }}
                    style={{ padding: "4px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 12, color: "#a0c4d8", fontWeight: 700 }}
                  >위치정정</div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirm({ type: "mci-clear", name: "현장응급의료소" });
                    }}
                    style={{ padding: "4px 8px", background: "rgba(255,69,0,0.2)", border: "1px solid #ff450066", borderRadius: 6, fontSize: 12, color: "#ff7050", fontWeight: 700 }}
                  >MCI 취소</div>
                </div>
              </button>
            </div>
          )}
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
            <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10006 }}>
              <button
                onClick={() => { setShowUtilityModal(true); setUtilityTab("targets"); setMciFromBadge(false); }}
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
          )}
        </div>

        {/* 오른쪽: 사이드바 */}
        <div style={{ width: 250, background: "#080f1a", borderLeft: "1px solid #1e3a52", display: "flex", flexDirection: "column", position: "relative", zIndex: 100, filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
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
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {sortedCenters.map(c => {
              const list = (activeTab === "personnel" ? personnel : vehicles).filter(x => x.center_id === c.id && !deployedIds.has(x.id));
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
                        dragPayloadRef.current = { ...x, itemType: activeTab };
                        dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                      }}
                      style={{ background: "#112233", border: "1px solid #1e3a52", borderRadius: 8, padding: "8px 12px", marginBottom: 6, cursor: "grab", display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
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
                {showConfirm.type === "hose" ? `${showConfirm.fromName} ↔ ${showConfirm.toName} 수관을 회수하시겠습니까?` : showConfirm.type === "mci-clear" ? "현장응급의료소를 해체하고 모든 통계를 초기화하시겠습니까?" : showConfirm.type === "log-clear" ? "이동 로그를 전체 초기화하시겠습니까?" : `${showConfirm.name} 철수하시겠습니까?`}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowConfirm(null)} style={{ flex: 1, padding: "8px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#fff" }}>취소</button>
                <button onClick={() => {
                  if (showConfirm.type === "hose") {
                    addLog(`수관 회수: ${showConfirm.fromName} ↔ ${showConfirm.toName}`, "info");
                    setHoseLinks(prev => prev.filter(l => l.id !== showConfirm.linkId));
                    setShowConfirm(null);
                    setSelected(null);
                  } else if (showConfirm.type === "mci-clear") {
                    setIsMciLocked(false);
                    setMciSetupStarted(false);
                    setMciPos(null);
                    setMciStats({ red: 0, yellow: 0, green: 0, black: 0 });
                    setHospitalStats(HOSPITALS.reduce((acc, h) => ({ ...acc, [h.name]: { red: 0, yellow: 0, green: 0, black: 0 } }), {}));
                    addLog("현장응급의료소 전체 해체 및 초기화", "recall");
                    setShowConfirm(null);
                  } else if (showConfirm.type === "log-clear") {
                    setMciTransportLog([]);
                    addLog("이동 로그 초기화", "info");
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
                    setDeployed(prev => ({
                      ...prev,
                      [targetId]: { ...prev[targetId], water_capacity: newVal }
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
              borderRadius: 24, padding: "30px",
              width: utilityTab === "mci" ? (mciViewMode === "hospital" ? "min(1380px, 96vw)" : "min(320px, 96vw)") : "min(340px, 96vw)",
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
                      onClick={() => {
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
                        width: "100%", padding: "20px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 20,
                        display: "flex", alignItems: "center", gap: 20,
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
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{m.label}</div>
                        <div style={{ fontSize: 12, color: "#7ec8e3", opacity: 0.8 }}>{m.desc}</div>
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
                          const val = (((pumpCalc.floor - 1) * 0.03) + (pumpCalc.hose * hoseFactor) + base) * 10.2;
                          return val.toFixed(1);
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
                              <button 
                                onClick={() => handleLoadSnapshot(s)}
                                style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#7ec8e3", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              >불러오기</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                          {[
                            { key: "red", label: "긴급(Red)", color: "#ff4d4d" },
                            { key: "yellow", label: "응급(Yellow)", color: "#ffcc00" },
                            { key: "green", label: "비응급(Green)", color: "#4ade80" },
                            { key: "black", label: "지연(Black)", color: "#666" },
                          ].map(item => (
                            <div key={item.key} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "10px", border: `1px solid ${item.color}44` }}>
                              <div style={{ fontSize: 12, color: item.color, fontWeight: 600, marginBottom: 6 }}>{item.label}</div>
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
                                {["red", "yellow", "green", "black"].map(type => {
                                  const colors = { red: "#ff4d4d", yellow: "#ffcc00", green: "#4ade80", black: "#666" };
                                  return (
                                    <div key={type} style={{ textAlign: "center", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 4px" }}>
                                      <div style={{ fontSize: 12, color: colors[type], marginBottom: 6, fontWeight: 700 }}>{type === "red" ? "긴급" : type === "yellow" ? "응급" : type === "green" ? "비응급" : "지연"}</div>
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
                              {/* 행1: 구급차 → 병원 + 삭제 */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", alignItems: "center", gap: 6, marginBottom: 7 }}>
                                <div onClick={() => openPop('amb')} style={{ ...cell, color: t.amb ? "#fff" : "#4a7a9b" }}>{t.amb || "구급차 선택"}</div>
                                <span style={{ color: "#4a7a9b", fontSize: 10 }}>➔</span>
                                <div onClick={() => openPop('hosp')} style={{ ...cell, color: t.hosp ? "#fff" : "#4a7a9b" }}>{t.hosp || "병원 선택"}</div>
                                <button onClick={() => setMciTransports(pts => pts.filter(pt => pt.id !== t.id))} style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontSize: 16, padding: "0 2px" }}>×</button>
                              </div>

                              {/* 행2: 중증도 | 인원 | 이송상태 */}
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

                              {/* 드롭다운 팝업 */}
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

                      {mciTransportLog.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                          {[["병원 도착", "#4ade80"], ["환자 이송 중", "#ffcc00"], ["복귀 중", "#7ec8e3"]].map(([stat, color]) => (
                            <div key={stat} style={{ background: `${color}10`, border: `1px solid ${color}33`, borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
                              <div style={{ fontSize: 16, fontWeight: 800, color }}>{mciTransportLog.filter(l => l.stat === stat).length}</div>
                              <div style={{ fontSize: 9, color: "#4a7a9b", marginTop: 2, lineHeight: 1.2 }}>{stat}</div>
                            </div>
                          ))}
                        </div>
                      )}

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
    </div >
  );
}
