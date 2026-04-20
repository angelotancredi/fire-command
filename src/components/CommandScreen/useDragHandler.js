import { useEffect } from "react";
import { getDistance } from "../../utils/geoUtils";
import HYDRANT_DATA from "../../data/fire_hydrants.json";

export default function useDragHandler({
  kakaoMap,
  mapRef,
  dragging,
  setDragging,
  dragPos,
  setDragPos,
  hoseDragSource,
  setHoseDragSource,
  hydrantDragSource,
  setHydrantDragSource,
  hoseDragOriginRef,
  dragPayloadRef,
  dragStartPosRef,
  dragOffsetRef,
  yCouplingOverlayRef,
  yCouplingDragPosRef,
  yCouplingIsDraggingRef,
  yCouplingLastClientPosRef,
  deployed,
  setDeployed,
  personnel,
  vehicles,
  accidentPos,
  hydrantRadius,
  siameseLinks,
  setSiameseLinks,
  hoseLinks,
  setHoseLinks,
  setHydrantCaptureLinks,
  setWaterSprayLinks,
  setYCouplingPositions,
  setSelected,
  setShowConfirm,
  addLog,
  saveDeployment,
  removeDeploymentRecord,
  supabase,
}) {
  useEffect(() => {
    const onDown = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const onMove = (e) => {
      const touch = e.touches ? e.touches[0] : e;

      // ── 분수기 드래그: 최우선 처리 ──
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

      const moveDist = dragStartPosRef.current
        ? Math.sqrt((touch.clientX - dragStartPosRef.current.x) ** 2 + (touch.clientY - dragStartPosRef.current.y) ** 2)
        : 0;

      const clearSources = () => {
        setHoseDragSource(null);
        setHydrantDragSource(null);
        setDragPos(null);
        hoseDragOriginRef.current = null;
      };

      // ── 소화전 점령 드롭 ──
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
          clearSources();
          setDragging(null);
          dragPayloadRef.current = null;
          dragStartPosRef.current = null;
        }
        return;
      }

      // ── 수관 연장 드롭 ──
      if (hoseDS && mapRef.current && kakaoMap) {
        const rect = mapRef.current.getBoundingClientRect();
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
          if (typeStr === 'vehicle' && String(idStr) === String(actualFromId)) return;

          const pPos = kakaoMap.getProjection().containerPointFromCoords(new window.kakao.maps.LatLng(d.lat, d.lng));
          const dropPos = new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top);
          const dx = pPos.x - dropPos.x;
          const dy = pPos.y - dropPos.y;
          const pixelDist = Math.sqrt(dx * dx + dy * dy);

          if (pixelDist < minPixelDist) {
            minPixelDist = pixelDist;
            const originalItem = typeStr === "personnel"
              ? personnel.find(p => String(p.id) === String(idStr))
              : vehicles.find(v => String(v.id) === String(idStr));
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
          setSelected(null);
          clearSources();
          setDragging(null);
          dragPayloadRef.current = null;
          dragStartPosRef.current = null;
        } else if (moveDist > 20) {
          clearSources();
          setDragging(null);
          dragPayloadRef.current = null;
          dragStartPosRef.current = null;
        }
        return;
      }

      // ── 일반 유닛 드롭/클릭 ──
      if (payload) {
        const currentPayload = payload;
        const currentOffset = offset;
        const currentIsActuallyDragging = isActuallyDragging;

        setDragging(null);
        dragPayloadRef.current = null;
        dragStartPosRef.current = null;
        dragOffsetRef.current = { x: 0, y: 0 };

        // 분수기(Y커플링) 드롭
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

        // 연결송수구 이동
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
              removeDeploymentRecord(supabase, currentPayload.id, "personnel");
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
}
