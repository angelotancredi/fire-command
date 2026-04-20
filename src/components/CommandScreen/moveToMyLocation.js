export function moveToMyLocation({
  kakaoMap,
  setAccidentPos,
  addLog
}) {
  if (!navigator.geolocation) {
    return alert("GPS를 지원하지 않는 브라우저입니다.");
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const newPos = { lat, lng };
      setAccidentPos(newPos);

      const moveLatLng = new window.kakao.maps.LatLng(lat, lng);
      kakaoMap.setCenter(moveLatLng);
      kakaoMap.setLevel(3);

      addLog("현재 위치로 사고 지점 이동 (고정밀 GPS)", "info");
    },
    (err) => {
      console.error(err);
      let msg = "위치를 가져올 수 없습니다.";
      if (err.code === 1) msg = "위치 정보 권한이 거부되었습니다.";
      else if (err.code === 2) msg = "위치 정보를 사용할 수 없습니다.";
      else if (err.code === 3) msg = "요청 시간이 초과되었습니다.";
      alert(msg);
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );
}
