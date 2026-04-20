import { useEffect } from "react";
import { VEHICLE_ICONS, LADDER_SVG, BASKET_SVG } from "../../constants";

export default function useVehicleMarkers({
  kakaoMap,
  deployed,
  selected,
  mapZoom,
  centers,
  personnel,
  vehicles,
  waterSprayLinks,
  hoseLinks,
  hydrantCaptureLinks,
  siameseLinks,
  yCouplingPositions,
  accidentPos,
  overlaysRef,
  yCouplingOverlayRef,
  dragPayloadRef,
  dragStartPosRef,
  dragOffsetRef,
  yCouplingDragPosRef,
  yCouplingLastClientPosRef,
  mapRef,
  setSelected,
  setShowConfirm,
  setShowWaterAdjust,
  setWaterSprayLinks,
  setHoseDragSource,
  setHydrantDragSource,
  setDragPos,
  setSiameseLinks,
  setHoseLinks,
  ladderDeployments,
  setLadderDeployments,
  basketOccupants,
  setBasketOccupants,
  hoseDragOriginRef,
  addLog,
}) {
  useEffect(() => {
    if (!kakaoMap || !window.kakao || !window.kakao.maps) return;
    try {
      overlaysRef.current.forEach(o => { if (o) o.setMap(null); });
      overlaysRef.current = [];

      // ── 차량/대원 마커 ──
      Object.values(deployed).forEach(item => {
        if (!item.lat || !item.lng || isNaN(item.lat) || isNaN(item.lng)) return;
        
        // ── 바스켓 탑승 대원 위치 보정 ──
        let itemLat = item.lat;
        let itemLng = item.lng;
        if (item.itemType === 'personnel' && accidentPos) {
          const vId = Object.keys(basketOccupants).find(key => String(basketOccupants[key]) === String(item.id));
          if (vId && ladderDeployments[vId]) {
            itemLat = accidentPos.lat;
            itemLng = accidentPos.lng;
          }
        }

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
          dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
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
          position: new window.kakao.maps.LatLng(itemLat, itemLng),
          content,
          xAnchor: 0.5, yAnchor: 0.5,
          zIndex: isSelected ? 2000 : 1000,
          clickable: true
        });
        overlay.setMap(kakaoMap);
        overlaysRef.current.push(overlay);

        // ── 사다리차 연출 ──
        const isLadder = item.type === "ladder" || item.name?.includes("사다리");
        if (item.itemType === 'vehicle' && isLadder && ladderDeployments[item.id] && accidentPos) {
          // 1. 사다리 본체 (Polyline)
          const ladderLine = new window.kakao.maps.Polyline({
            path: [
              new window.kakao.maps.LatLng(item.lat, item.lng),
              new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng)
            ],
            strokeWeight: 14, strokeColor: '#d1d5db', strokeOpacity: 0.8, strokeStyle: 'solid'
          });
          ladderLine.setMap(kakaoMap);
          overlaysRef.current.push(ladderLine);

          const ladderInner = new window.kakao.maps.Polyline({
            path: [
              new window.kakao.maps.LatLng(item.lat, item.lng),
              new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng)
            ],
            strokeWeight: 6, strokeColor: '#9ca3af', strokeOpacity: 1, strokeStyle: 'solid'
          });
          ladderInner.setMap(kakaoMap);
          overlaysRef.current.push(ladderInner);

          // 2. 사다리 바스켓
          const bDiv = document.createElement("div");
          bDiv.innerHTML = BASKET_SVG;
          bDiv.style.cssText = "width:34px; height:34px; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.5));";
          
          const basketOverlay = new window.kakao.maps.CustomOverlay({
            position: new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng),
            content: bDiv, xAnchor: 0.5, yAnchor: 1, zIndex: 1100
          });
          basketOverlay.setMap(kakaoMap);
          overlaysRef.current.push(basketOverlay);
        }
      });

      // ── 분수기(Y-Coupling) 오버레이 ──
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

        const compoundId = `${vId}_${port}`;
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
            transform: scale(1); z-index: 1500;
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

        if (isSelected) {
          const yPopup = document.createElement("div");
          yPopup.style.cssText = "background:#0e1e2e; border:1px solid #00aaff; border-radius:12px; padding:12px 16px; min-width:180px; box-shadow:0 10px 30px rgba(0,0,0,0.8); position:relative; color:#fff; margin-bottom:20px; text-align:center;";

          const p1Link = pLinks[0];
          const p2Link = pLinks[1];
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

      // ── 차량/대원 선택 팝업 ──
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
            : (VEHICLE_ICONS[item.type] || "🚒");
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
          const canDischarge = ["pump", "tanker", "chemical", "forest", "ladder"].includes(item.type) || isLadder;

          if (canDischarge) {
            if (item.type === "tanker") {
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
                sprayBtn.onclick = (e) => { e.stopPropagation(); setWaterSprayLinks(prev => prev.filter(s => s.vehicleId !== item.id)); setSelected(null); addLog(`${item.name} 방수포 방수 종료`, "info"); };
              } else {
                sprayBtn.innerText = "🚒 방수포 방수";
                sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #002a4a; border: 1px solid #009dff55; color: #7ec8e3; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                sprayBtn.onclick = (e) => { e.stopPropagation(); if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요."); setWaterSprayLinks(prev => [...prev.filter(s => s.vehicleId !== item.id), { id: Date.now(), vehicleId: item.id }]); setSelected(null); addLog(`${item.name} 방수포 방수 시작`, "info"); };
              }
              row2.appendChild(sprayBtn);

              const captureBtn = document.createElement("button");
              const existingCapture = hydrantCaptureLinks.find(l => l.vehicleId === item.id);
              if (existingCapture) {
                captureBtn.innerText = "🔥 점령 해제";
                captureBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                captureBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "hydrant-release", vehicleId: item.id, vehicleName: item.name }); };
              } else {
                captureBtn.innerText = "🔥 소화전 점령";
                captureBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: crosshair;";
                const startCaptureDrag = (e) => { e.preventDefault(); e.stopPropagation(); const touch = e.touches ? e.touches[0] : e; setHydrantDragSource(item.id); setSelected(null); setDragPos({ x: touch.clientX, y: touch.clientY }); };
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
              waterInfo.onclick = (e) => { e.stopPropagation(); setShowWaterAdjust({ id: item.id, name: item.name, current: item.water_capacity }); };
              row3.appendChild(waterInfo);
              const recallBtn3 = document.createElement("button");
              recallBtn3.innerText = "🚨 현장 철수";
              recallBtn3.style.cssText = "flex: 1; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
              recallBtn3.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "recall", id: item.id, name: item.name }); };
              row3.appendChild(recallBtn3);
              actions.appendChild(row3);
            } else {
              const row1 = document.createElement("div");
              row1.style.cssText = "display: flex; gap: 6px; width: 100%;";
              
              const sprayBtn = document.createElement("button");
              const isSprayActive = waterSprayLinks.find(s => s.vehicleId === item.id);
              if (isSprayActive) {
                sprayBtn.innerText = "🚒 방수포 종료";
                sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #004a7c; border: 1px solid #009dff; color: #00ccff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                sprayBtn.onclick = (e) => { e.stopPropagation(); setWaterSprayLinks(prev => prev.filter(s => s.vehicleId !== item.id)); setSelected(null); addLog(`${item.name} 방수포 방수 종료`, "info"); };
              } else {
                sprayBtn.innerText = "🚒 방수포 방수";
                sprayBtn.style.cssText = "flex: 1; padding: 10px 0; background: #002a4a; border: 1px solid #009dff55; color: #7ec8e3; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                sprayBtn.onclick = (e) => { e.stopPropagation(); if (!accidentPos) return alert("화재 지점을 먼저 설정해주세요."); setWaterSprayLinks(prev => [...prev.filter(s => s.vehicleId !== item.id), { id: Date.now(), vehicleId: item.id }]); setSelected(null); addLog(`${item.name} 방수포 방수 시작`, "info"); };
              }
              row1.appendChild(sprayBtn);

              if (isLadder) {
                const ladderBtn = document.createElement("button");
                const isDeployed = ladderDeployments[item.id];
                ladderBtn.innerText = isDeployed ? "🪜 사다리 축소" : "🪜 사다리 전개";
                ladderBtn.style.cssText = `flex: 1; padding: 10px 0; background: ${isDeployed ? '#334c5f' : '#002a4a'}; border: 1px solid ${isDeployed ? '#00ccff' : '#009dff55'}; color: ${isDeployed ? '#00ccff' : '#7ec8e3'}; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;`;
                ladderBtn.onclick = (e) => {
                  e.stopPropagation();
                  const nextState = !isDeployed;
                  setLadderDeployments(prev => ({ ...prev, [item.id]: nextState }));
                  if (!nextState) {
                    setBasketOccupants(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                  }
                  addLog(`${item.name} 사다리 ${nextState ? "전개" : "축소"}`, "info");
                  setSelected(null);
                };
                row1.appendChild(ladderBtn);
              }

              if (!isLadder) {
                const hoseBtn = document.createElement("button");
                const existingLink = hoseLinks.find(l => String(l.fromId) === String(item.id));
                if (existingLink) {
                  hoseBtn.innerText = "수관 철수";
                  hoseBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
                  hoseBtn.onclick = (e) => { e.stopPropagation(); const toName = personnel.find(p => String(p.id) === String(existingLink.toId))?.name || "대원"; setShowConfirm({ type: "hose", linkId: existingLink.id, fromName: item.name, toName }); };
                } else {
                  hoseBtn.innerText = "수관 연장";
                  hoseBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: crosshair;";
                  const startHoseDrag = (e) => { e.preventDefault(); e.stopPropagation(); const touch = e.touches ? e.touches[0] : e; setHoseDragSource(item.id); setSelected(null); setDragPos({ x: touch.clientX, y: touch.clientY }); };
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
                  captureBtn.onclick = (e) => { e.stopPropagation(); setShowConfirm({ type: "hydrant-release", vehicleId: item.id, vehicleName: item.name }); };
                } else {
                  captureBtn.innerText = "🔥 소화전 점령";
                  captureBtn.style.cssText = "flex: 1; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: crosshair;";
                  const startCaptureDrag = (e) => { e.preventDefault(); e.stopPropagation(); const touch = e.touches ? e.touches[0] : e; setHydrantDragSource(item.id); setSelected(null); setDragPos({ x: touch.clientX, y: touch.clientY }); };
                  captureBtn.onmousedown = startCaptureDrag;
                  captureBtn.ontouchstart = startCaptureDrag;
                }
                row2.appendChild(captureBtn);
                if (item.water_capacity > 0) {
                  const waterInfo = document.createElement("div");
                  waterInfo.innerText = `수량: ${item.water_capacity || 0}L`;
                  waterInfo.style.cssText = "flex: 1; background: #004a7c; border: 1px solid #009dff; border-radius: 6px; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; cursor: pointer;";
                  waterInfo.onclick = (e) => { e.stopPropagation(); setShowWaterAdjust({ id: item.id, name: item.name, current: item.water_capacity }); };
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
          personnelActions.style.cssText = "padding: 12px; display: flex; flex-direction: column; gap: 8px;";

          const sprayBtn = document.createElement("button");
          const isSprayActive = waterSprayLinks.find(s => s.personnelId === item.id);
          const isConnected = hoseLinks.some(l => l.toId === item.id);

          if (isSprayActive) {
            sprayBtn.innerText = "💧 방수 종료";
            sprayBtn.style.cssText = "width: 100%; padding: 10px 0; background: #004a7c; border: 1px solid #009dff; color: #00ccff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;";
            sprayBtn.onclick = (e) => { e.stopPropagation(); setWaterSprayLinks(prev => prev.filter(s => s.personnelId !== item.id)); addLog(`${item.name} 대원 방수 종료`, "info"); setSelected(null); };
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
          yAnchor: 1.05, zIndex: 10000, clickable: true
        });
        popupOverlay.setMap(kakaoMap);
        overlaysRef.current.push(popupOverlay);
      }

      // ── 연결송수구 오버레이 ──
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
                      pointer-events: auto; user-select: none; transition: all 0.2s;">
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
        content.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelected(prev => prev === conn.id ? null : conn.id);
        });

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(conn.lat, conn.lng),
          content,
          xAnchor: 0.5, yAnchor: 0.5,
          zIndex: isSelected ? 2000 : 1500,
          clickable: true
        });
        overlay.setMap(kakaoMap);
        overlaysRef.current.push(overlay);

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
            content: deleteBtn, yAnchor: 1.5, zIndex: 10000, clickable: true
          });
          popupOverlay.setMap(kakaoMap);
          overlaysRef.current.push(popupOverlay);
        }
      });
    } catch (err) {
      console.error("Overlay sync error:", err);
    }
  }, [kakaoMap, deployed, selected, mapZoom, centers, personnel, waterSprayLinks, hoseLinks, hydrantCaptureLinks, siameseLinks, yCouplingPositions]);
}
