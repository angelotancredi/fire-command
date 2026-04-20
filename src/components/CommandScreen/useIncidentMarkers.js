import { useEffect, useRef } from "react";

export default function useIncidentMarkers({
  kakaoMap,
  accidentPos,
  setAccidentPos,
  isAccidentLocked,
  setAccidentAddress,
  mciPos,
  setMciPos,
  mciSetupStarted,
  isMciLocked,
  setMciFromBadge,
  setShowUtilityModal,
  setUtilityTab,
  stagingPos,
  setStagingPos,
  stagingSetupStarted,
  isStagingLocked,
  setSelected
}) {
  const fireMarkerRef = useRef(null);
  const mciMarkerRef = useRef(null);
  const stagingMarkerRef = useRef(null);

  // 이벤트 핸들러에서 최신 상태를 참조하기 위한 Ref
  const isMciLockedRef = useRef(isMciLocked);
  const isStagingLockedRef = useRef(isStagingLocked);

  useEffect(() => { isMciLockedRef.current = isMciLocked; }, [isMciLocked]);
  useEffect(() => { isStagingLockedRef.current = isStagingLocked; }, [isStagingLocked]);

  // 1. 화재 지점(Accident) 마커 제어
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
  }, [kakaoMap, accidentPos, isAccidentLocked, setAccidentPos, setAccidentAddress]);

  // 화점 마커 애니메이션 클래스 제어
  useEffect(() => {
    if (isAccidentLocked) {
      document.body.classList.add('fire-locked');
    } else {
      document.body.classList.remove('fire-locked');
    }
    return () => document.body.classList.remove('fire-locked');
  }, [isAccidentLocked]);

  // 2. MCI(임시의료소) 마커 제어
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
  }, [kakaoMap, mciPos, mciSetupStarted, isMciLocked, setMciPos, setUtilityTab, setShowUtilityModal, setMciFromBadge]);

  // 3. 스테이징(자원집결지) 마커 제어
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
  }, [kakaoMap, stagingPos, stagingSetupStarted, isStagingLocked, setStagingPos, setSelected]);

  return { fireMarkerRef, mciMarkerRef, stagingMarkerRef };
}
