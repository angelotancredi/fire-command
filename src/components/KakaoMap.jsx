import { useRef, useEffect } from "react";

export default function KakaoMap({ center, onMapReady }) {
  const containerRef = useRef(null);

  useEffect(() => {
    console.log("KakaoMap: Component mounted. Checking window.kakao...");
    if (!window.kakao) {
      console.error("KakaoMap: window.kakao is not defined. Check if script is loaded in index.html.");
      return;
    }
    if (!window.kakao.maps) {
      console.error("KakaoMap: window.kakao.maps is not defined.");
      return;
    }
    if (!containerRef.current) {
      console.error("KakaoMap: containerRef.current is null.");
      return;
    }

    console.log("KakaoMap: Calling window.kakao.maps.load...");
    window.kakao.maps.load(() => {
      console.log("KakaoMap: window.kakao.maps.load callback executed.");
      try {
        const options = {
          center: new window.kakao.maps.LatLng(center.lat, center.lng),
          level: 3
        };
        const map = new window.kakao.maps.Map(containerRef.current, options);
        map.setMinLevel(0);
        onMapReady(map);
        map.setZoomable(true);
        map.setDraggable(true);
        console.log("KakaoMap: Map instance created successfully.");
      } catch (err) {
        console.error("KakaoMap: Error during map initialization:", err);
      }
    });
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />;
}
