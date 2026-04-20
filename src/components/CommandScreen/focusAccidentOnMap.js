export function focusAccidentOnMap(kakaoMap, accidentPos) {
  if (!kakaoMap || !accidentPos || !window.kakao?.maps) return;

  setTimeout(() => {
    kakaoMap.relayout();
    const moveLatLng = new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng);
    kakaoMap.setCenter(moveLatLng);
    kakaoMap.panTo(moveLatLng);
    kakaoMap.setLevel(2);
  }, 50);
}
