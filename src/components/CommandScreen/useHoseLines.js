import { useEffect, useRef } from "react";

export default function useHoseLines({
  kakaoMap,
  hoseLinks,
  deployed,
  hoseDragSource,
  dragging,
  dragPos,
  mapZoom,
  mapSize,
  yCouplingPositions,
  personnel,
  siameseLinks,
  waterSprayLinks,
  accidentPos,
  setShowConfirm,
  mapRef
}) {
  const hoseLinesRef = useRef([]);
  const waterSprayRef = useRef([]);

  // 1. 수관 연장 렌더링 (createHoseSVG)
  useEffect(() => {
    if (!kakaoMap || !window.kakao || !mapRef.current) return;
    hoseLinesRef.current.forEach(line => {
      if (line.setMap) line.setMap(null);
    });
    hoseLinesRef.current = [];
    try {

    const createHoseSVG = (fromLatLng, toLatLng, isPreview = false, linkId = null, fromName = "", toName = "", fromType = "", toType = "", port = null) => {
      const proj = kakaoMap.getProjection();

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

    // 차량 → 분수기 공급 수관 자동 렌더링
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
      let isSplitter = (link.fromType === "splitter" || pLinks.length >= 1) && (link.toType === "personnel" || !link.toType);

      let fromCoord = null;
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

  // 2. 방수포 렌더링
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

      const svgSize = r * 2 + 100;
      const cx = svgSize / 2, cy = svgSize / 2;

      const sprayConfig = isPersonnel
        ? { angles: [-5, -2.5, 0, 2.5, 5], width: 3.5, dash: '6,10', durBase: 0.2, opacity: 0.7 }
        : { angles: [-5, -2.5, 0, 2.5, 5], width: 7.5, dash: '12,8', durBase: 0.2, opacity: 0.9 };

      const uid = `spray_${link.id || Math.random().toString(36).substr(2, 9)}`;

      const paths = sprayConfig.angles.map((deg, i) => {
        const rad = deg * Math.PI / 180;
        const ex = cx + r * Math.cos(rad);
        const ey = cy + r * Math.sin(rad);
        const midX = cx + (r / 2) * Math.cos(rad);
        const midY = cy + (r / 2) * Math.sin(rad);
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

  return { hoseLinesRef, waterSprayRef };
}
