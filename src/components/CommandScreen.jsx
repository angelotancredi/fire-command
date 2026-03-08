import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { VEHICLE_ICONS, VEHICLE_LABELS, getDistance } from "../constants";
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
  time, addLog,
  selected, setSelected,
  activeTab, setSideTab,
  expandedCenters, setExpandedCenters
}) {
  const [kakaoMap, setKakaoMap] = useState(null);
  const [mapZoom, setMapZoom] = useState(3);
  const [dragging, setDragging] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const fireMarkerRef = useRef(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGlobalResetInit, setShowGlobalResetInit] = useState(false);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const dragPayloadRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef(null);
  const hoseLinesRef = useRef([]);
  const [dragPos, setDragPos] = useState(null);
  const [hoseDragSource, setHoseDragSource] = useState(null);
  const [showWaterAdjust, setShowWaterAdjust] = useState(null); // { id, name, current }
  const [showUtilityModal, setShowUtilityModal] = useState(false);
  const [pumpCalc, setPumpCalc] = useState({ floor: 10, hose: 1, mode: "standard", hoseSize: 40 });

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
      if (a.name === selectedDistrict.jurisdictional) return -1;
      if (b.name === selectedDistrict.jurisdictional) return 1;
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
        if (!accidentPos || accidentPos.lat !== selectedDistrict.center.lat) {
          setAccidentPos(selectedDistrict.center);
          setIsAccidentLocked(false);
          addLog(`${selectedDistrict.name} 작전 구역 설정`, "info");
        }
      } catch (err) { console.error("Map panTo error:", err); }
    }
  }, [kakaoMap, selectedDistrict]);

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
          header.innerHTML = `<span style="font-size: 20px;">${VEHICLE_ICONS[item.type]}</span> <span style="font-weight: 700; font-size: 15px;">${item.name}</span>`;
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
              crewItem.innerHTML = `<span style="font-size: 14px;">👤</span> <span style="font-size: 13px;">${p.name}</span> <span style="font-size: 10px; color: #4a7a9b; border: 1px solid #1e3a52; padding: 1px 4px; border-radius: 4px;">${p.role}</span>`;
              const handleCrewDragStart = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                e.stopPropagation();
                const touch = e.touches ? e.touches[0] : e;
                dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                dragPayloadRef.current = { ...p, itemType: "personnel", isMoving: false };
                dragOffsetRef.current = { x: 0, y: 0 };
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
          const canExtendHose = ["pump", "tanker", "chemical"].includes(item.type);
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

            // 수관 연장 여부 확인 (현재 차량이 시작점인 링크 검색)
            const existingLink = hoseLinks.find(l => l.fromId === item.id);

            if (existingLink) {
              hoseBtn.innerText = "수관 철수";
              hoseBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              hoseBtn.onclick = (e) => {
                e.stopPropagation();
                const toName = deployed[existingLink.toId]?.name || "차량";
                // 기존 수관 확인 모달 로직 재사용
                setShowConfirm({
                  type: "hose",
                  linkId: existingLink.id,
                  fromName: item.name,
                  toName: toName
                });
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
          }
          const recallBtn = document.createElement("button");
          recallBtn.innerText = "🚨 현장 철수";
          recallBtn.style.cssText = "width: 100%; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
          recallBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name }); };
          actions.appendChild(recallBtn);
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
        closeBtn.style.cssText = "position: absolute; top: 10px; right: 12px; color: #4a7a9b; cursor: pointer; font-size: 16px; z-index: 10;";
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
  }, [kakaoMap, deployed, selected, mapZoom, centers, personnel]);

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

      // 수평 이동(좌측 드래그)이 수직 이동보다 크고 10px 이상 이동했을 때만 드래그 시작
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
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
      <div style={{ height: 60, background: "linear-gradient(90deg, #0e1925, #091420)", borderBottom: "1px solid #1e3a52", display: "flex", alignItems: "center", padding: "0 24px", gap: 20, flexShrink: 0, boxShadow: "0 4px 20px #000000aa", zIndex: 100 }}>
        <div onClick={() => setShowGlobalResetInit(true)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 8, transition: "background 0.2s" }}
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
          <span style={{ fontSize: 13, color: "#a0c4d8", marginLeft: 2 }}>{selectedDistrict?.name || "알 수 없는 지역"} 화재 출동</span>
        </div>
        <div style={{ flexShrink: 0 }}><WeatherWidget /></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 24, alignItems: "center" }}>
          <button onClick={onManage} style={{ background: "linear-gradient(135deg, #1e3a52, #112233)", border: "1px solid #2a6a8a", borderRadius: 8, color: "#7ec8e3", padding: "10px 20px", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><span>⚙</span> 설정</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.7, letterSpacing: 0.5 }}>{time.split(' ')[0]}</span>
            <span style={{ width: 1, height: 14, background: "#ffffff", opacity: 0.2 }}></span>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{time.split(' ')[1]}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 왼쪽: 투입 현황 + 활동 기록 */}
        <div style={{ width: 270, background: "#0a1420", borderRight: "1px solid #1e3a52", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#7ec8e3", letterSpacing: 1 }}>🏢 현장 투입 조직</div>
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
              <button onClick={() => setShowResetConfirm(true)} style={{ background: "#3a1a1a", border: "1px solid #ff450066", borderRadius: 4, color: "#ff7050", padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>초기화</button>
              <button onClick={handleSaveLogs} style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 4, color: "#7ec8e3", padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>저장</button>
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
          {accidentPos && (
            <div style={{ position: "absolute", top: 20, right: 20, zIndex: 1000, display: "flex", gap: 10, pointerEvents: "none" }}>
              <button onClick={() => setIsAccidentLocked(!isAccidentLocked)} style={{ pointerEvents: "auto", background: isAccidentLocked ? "#ff4500" : "rgba(14, 25, 37, 0.85)", border: "1px solid #ff4500", borderRadius: 8, color: isAccidentLocked ? "#fff" : "#ffff00", padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "0.2s", backdropFilter: "blur(4px)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                {isAccidentLocked ? "🔓 위치 고정 해제" : "🔒 화재 지점 확정"}
              </button>
              <button onClick={moveToMyLocation} style={{ pointerEvents: "auto", background: "rgba(26, 58, 82, 0.85)", border: "1px solid #2a6a8a", borderRadius: 8, color: "#7ec8e3", padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", backdropFilter: "blur(4px)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                📍 내 위치로 (GPS)
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
          {/* 우측 하단 FAB 버튼 */}
          <div style={{ position: "absolute", bottom: 25, right: 25, zIndex: 10006 }}>
            <button
              onClick={() => setShowUtilityModal(true)}
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "linear-gradient(135deg, #ff4500, #ff8c00)",
                border: "2px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 34, fontWeight: "bold",
                cursor: "pointer", boxShadow: "0 6px 15px rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.1s active", pointerEvents: "auto",
                outline: "none"
              }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.94)"; e.currentTarget.style.filter = "brightness(0.9)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "brightness(1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "brightness(1)"; }}
              onTouchStart={e => { e.currentTarget.style.transform = "scale(0.94)"; e.currentTarget.style.filter = "brightness(0.9)"; }}
              onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "brightness(1)"; }}
            >
              ＋
            </button>
          </div>
        </div>

        {/* 오른쪽: 사이드바 */}
        <div style={{ width: 270, background: "#080f1a", borderLeft: "1px solid #1e3a52", display: "flex", flexDirection: "column", position: "relative", zIndex: 100 }}>
          <div style={{ display: "flex", background: "#0e1925" }}>
            {[{ k: "vehicle", l: "🚒 차량" }, { k: "personnel", l: "👤 대원" }].map(t => (
              <button key={t.k} onClick={() => setSideTab(t.k)} style={{ flex: 1, padding: "20px 0", background: activeTab === t.k ? "#1a3a52" : "transparent", border: "none", borderBottom: `2px solid ${activeTab === t.k ? "#ff4500" : "transparent"}`, color: activeTab === t.k ? "#fff" : "#4a7a9b", fontSize: 18, fontWeight: 700 }}>{t.l}</button>
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
                    style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a52", borderRadius: 8, fontSize: 15, color: c.color, fontWeight: 700, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "10px 16px", boxSizing: "border-box" }}>
                    <span>{c.name}</span>
                    <span style={{ fontSize: 12, color: "#a0c4d8" }}>{isExpanded ? "▲ 접기" : "▼ 펼치기"}</span>
                  </div>
                  {isExpanded && list.map(x => (
                    <div key={x.id}
                      onMouseDown={e => {
                        e.preventDefault();
                        dragOffsetRef.current = { x: 0, y: 0 };
                        dragPayloadRef.current = { ...x, itemType: activeTab };
                        dragStartPosRef.current = { x: e.clientX, y: e.clientY };
                        setDragPos({ x: e.clientX, y: e.clientY });
                      }}
                      onTouchStart={e => {
                        // 터치 시 preventDefault는 여기서 하면 스크롤이 안 되므로 주의
                        // 대신 전역 onMove에서 제어함
                        const touch = e.touches[0];
                        dragOffsetRef.current = { x: 0, y: 0 };
                        dragPayloadRef.current = { ...x, itemType: activeTab };
                        dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                        setDragPos({ x: touch.clientX, y: touch.clientY });
                      }}
                      style={{ background: "#112233", border: "1px solid #1e3a52", borderRadius: 8, padding: "8px 12px", marginBottom: 6, cursor: "grab", display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
                      <span style={{ fontSize: 20 }}>{activeTab === "personnel" ? "👤" : VEHICLE_ICONS[x.type]}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{x.name}</span>
                        <span style={{ fontSize: 11, color: "#4a7a9b", marginLeft: "auto" }}>{activeTab === "personnel" ? x.role : VEHICLE_LABELS[x.type]}</span>
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
        @keyframes hoseFlow { from { stroke-dashoffset: 25; } to { stroke-dashoffset: 0; } }
        .hose-flow-active { animation: hoseFlow 0.5s linear infinite; }
        .hose-flow-preview { animation: hoseFlow 0.8s linear infinite reverse; }
        * { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
        input, textarea { -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; user-select: text; }
      `}</style>

      {/* 모달들 */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => setShowConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1e2e", border: "1px solid #ff4500aa", borderRadius: 12, padding: "24px 28px", minWidth: 260, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
              {showConfirm.type === "hose" ? `${showConfirm.fromName} ↔ ${showConfirm.toName} 수관을 회수하시겠습니까?` : `${showConfirm.name} 철수하시겠습니까?`}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(null)} style={{ flex: 1, padding: "8px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#fff" }}>취소</button>
              <button onClick={() => {
                if (showConfirm.type === "hose") {
                  addLog(`수관 회수: ${showConfirm.fromName} ↔ ${showConfirm.toName}`, "info");
                  setHoseLinks(prev => prev.filter(l => l.id !== showConfirm.linkId));
                  setShowConfirm(null);
                  setSelected(null);
                } else { confirmRecall(); }
              }} style={{ flex: 1, padding: "8px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 6, color: "#ff7050" }}>확인</button>
            </div>
          </div>
        </div>
      )}
      {showResetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => setShowResetConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1e2e", border: "1px solid #ff4500aa", borderRadius: 12, padding: "24px 28px", minWidth: 260, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>기록을 초기화하시겠습니까?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: "8px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#fff" }}>취소</button>
              <button onClick={handleResetLogs} style={{ flex: 1, padding: "8px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 6, color: "#ff7050" }}>초기화</button>
            </div>
          </div>
        </div>
      )}
      {showGlobalResetInit && (
        <div style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, backdropFilter: "blur(8px)" }} onClick={() => setShowGlobalResetInit(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1e2e", border: "2px solid #ff4500", borderRadius: 16, padding: "32px", maxWidth: 320, width: "90%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>시작 화면으로 돌아갈까요?</div>
            <div style={{ fontSize: 13, color: "#a0c4d8", lineHeight: 1.6, marginBottom: 24 }}>현재 진행 중인 모든 배치 정보와<br />활동 기록이 삭제되고 초기화됩니다.</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowGlobalResetInit(false)} style={{ flex: 1, padding: "12px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer" }}>취소</button>
              <button onClick={() => { onGlobalReset(); setShowGlobalResetInit(false); }} style={{ flex: 1, padding: "12px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 8, color: "#ff7050", fontWeight: 700, cursor: "pointer" }}>전체 초기화</button>
            </div>
          </div>
        </div>
      )}

      {showWaterAdjust && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 11000, backdropFilter: "blur(10px)" }} onClick={() => setShowWaterAdjust(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(145deg, #101a2a, #0a121e)", border: "1px solid #009dff66", borderRadius: 20, padding: "20px", minWidth: 240, textAlign: "center", boxShadow: "0 15px 40px rgba(0,0,0,0.8)" }}>
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
      )}
      {showUtilityModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 12000, backdropFilter: "blur(12px)" }} onClick={() => setShowUtilityModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(145deg, #0f1a2a, #070d14)", border: "1px solid #ff450066", borderRadius: 24, padding: "30px", width: 340, boxShadow: "0 25px 50px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🧮</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: -0.5 }}>고층건물화재 방수압력 계산기</span>
              </div>
              <button onClick={() => setShowUtilityModal(false)} style={{ background: "transparent", border: "none", color: "#4a7a9b", fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
              <button
                onClick={() => setPumpCalc(p => ({ ...p, mode: "standard" }))}
                style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 8, background: pumpCalc.mode === "standard" ? "#1e3a52" : "transparent", color: pumpCalc.mode === "standard" ? "#fff" : "#4a7a9b", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "0.2s" }}
              >💦 일반 관창</button>
              <button
                onClick={() => setPumpCalc(p => ({ ...p, mode: "monitor" }))}
                style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 8, background: pumpCalc.mode === "monitor" ? "#ff4500" : "transparent", color: pumpCalc.mode === "monitor" ? "#fff" : "#4a7a9b", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "0.2s" }}
              >🚒 방수포</button>
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
                <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 3 }}>
                  {[40, 65].map(size => (
                    <button
                      key={size}
                      onClick={() => setPumpCalc(p => ({ ...p, hoseSize: size }))}
                      style={{
                        flex: 1, padding: "6px 0", border: "none", borderRadius: 8,
                        background: pumpCalc.hoseSize === size ? "#4a7a9b" : "transparent",
                        color: pumpCalc.hoseSize === size ? "#fff" : "#4a7a9b",
                        fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "0.2s"
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
                  // 3.5kg(오렌지/옐로) -> 15kg+(레드) 동적 색상 계산
                  const hue = Math.max(0, Math.min(45, 45 - (valKg - 3.5) * 3));
                  const color = `hsl(${hue}, 100%, 55%)`;
                  return { fontSize: 32, fontWeight: 900, color: color, textShadow: `0 0 20px ${color}66`, transition: "0.4s" };
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
          </div>
        </div>
      )}
    </div>
  );
}
