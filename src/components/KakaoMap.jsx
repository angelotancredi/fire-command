import { useRef, useEffect } from "react";

export default function KakaoMap({ center, onMapReady }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!window.kakao || !window.kakao.maps || !containerRef.current) return;

    window.kakao.maps.load(() => {
      const options = {
        center: new window.kakao.maps.LatLng(center.lat, center.lng),
        level: 3
      };
      const map = new window.kakao.maps.Map(containerRef.current, options);
      onMapReady(map);
      map.setZoomable(true);
      map.setDraggable(true);
    });
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />;
}
