import { useEffect, useRef } from "react";
import HYDRANT_DATA from "../../data/fire_hydrants.json";
import { getDistance } from "../../constants";

export default function useHydrantSystem({
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
}) {
  const hydrantMarkersRef = useRef([]);
  const hydrantLinesRef = useRef([]);
  const hydrantPreviewLineRef = useRef(null);

  // 1. 소화전 마커 표시 및 필터링
  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;
    
    // 기존 마커 제거
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

  // 2. 소화전 점령 연결선 렌더링
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
      const amp = Math.min(length * 0.3, 60);

      const relPts = [{ x: r1x, y: r1y }];
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        const sign = (i % 2 === 0 ? 1 : -1);
        const jitter = 0.8 + rng(i) * 0.4;
        relPts.push({ 
          x: r1x + rdx * t + nx * sign * amp * jitter, 
          y: r1y + rdy * t + ny * sign * amp * jitter 
        });
      }
      relPts.push({ x: r2x, y: r2y });

      const xs = relPts.map(p => p.x), ys = relPts.map(p => p.y);
      const pad = 20;
      const bMinX = Math.min(...xs) - pad, bMinY = Math.min(...ys) - pad;
      const W = Math.max(...xs) + pad - bMinX, H = Math.max(...ys) + pad - bMinY;
      const svgPts = relPts.map(p => ({ x: p.x - bMinX, y: p.y - bMinY }));
      const sx1 = svgPts[0].x, sy1 = svgPts[0].y;

      let pathD = `M ${sx1} ${sy1}`;
      for (let i = 0; i < svgPts.length - 1; i++) {
        const a = svgPts[i], b = svgPts[i + 1];
        const prev = svgPts[i - 1] || a, next = svgPts[i + 2] || b;
        pathD += ` C ${a.x + (b.x - prev.x) * 0.25} ${a.y + (b.y - prev.y) * 0.25} ${b.x - (next.x - a.x) * 0.25} ${b.y - (next.y - a.y) * 0.25} ${b.x} ${b.y}`;
      }

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

  // 3. 소화전 점령 드래그 미리보기 선
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
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) return;

    const nx = -dy / length, ny = dx / length;
    const amp = Math.min(length * 0.25, 50);

    const cp1x = p1.x + dx * 0.33 + nx * amp;
    const cp1y = p1.y + dy * 0.33 + ny * amp;
    const cp2x = p1.x + dx * 0.66 - nx * amp;
    const cp2y = p1.y + dy * 0.66 - ny * amp;

    const pad = 50;
    const minX = Math.min(p1.x, p2.x, cp1x, cp2x) - pad - cx;
    const minY = Math.min(p1.y, p2.y, cp1y, cp2y) - pad - cy;
    const maxX = Math.max(p1.x, p2.x, cp1x, cp2x) + pad - cx;
    const maxY = Math.max(p1.y, p2.y, cp1y, cp2y) + pad - cy;
    
    const W = maxX - minX, H = maxY - minY;
    const r1x = p1.x - cx - minX, r1y = p1.y - cy - minY;
    const r2x = p2.x - cx - minX, r2y = p2.y - cy - minY;
    const rcp1x = cp1x - cx - minX, rcp1y = cp1y - cy - minY;
    const rcp2x = cp2x - cx - minX, rcp2y = cp2y - cy - minY;

    const pathD = `M ${r1x} ${r1y} C ${rcp1x} ${rcp1y} ${rcp2x} ${rcp2y} ${r2x} ${r2y}`;

    const content = document.createElement('div');
    content.style.cssText = `position:absolute;width:${W}px;height:${H}px;transform:translate(${minX}px,${minY}px);pointer-events:none;z-index:52;`;
    content.innerHTML = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" fill="none" stroke="#ff4500" stroke-width="3" stroke-dasharray="10,6" opacity="0.8"/>
    </svg>`;
    
    const overlay = new window.kakao.maps.CustomOverlay({ position: midLatLng, content, xAnchor: 0, yAnchor: 0, zIndex: 52 });
    overlay.setMap(kakaoMap);
    hydrantPreviewLineRef.current = overlay;
    
    return () => { overlay.setMap(null); hydrantPreviewLineRef.current = null; };
  }, [kakaoMap, hydrantDragSource, dragPos, deployed, mapZoom]);

  return { hydrantMarkersRef, hydrantLinesRef, hydrantPreviewLineRef };
}
