import { useEffect, useState } from "react";

export default function useMapViewport({ kakaoMap, mapRef, windowKakao }) {
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [mapZoom, setMapZoom] = useState(3);

  useEffect(() => {
    if (!kakaoMap || !windowKakao) return;

    const handleZoomChanged = () => setMapZoom(kakaoMap.getLevel());
    windowKakao.maps.event.addListener(kakaoMap, "zoom_changed", handleZoomChanged);

    return () => windowKakao.maps.event.removeListener(kakaoMap, "zoom_changed", handleZoomChanged);
  }, [kakaoMap, windowKakao]);

  useEffect(() => {
    if (!mapRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMapSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });

    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, [mapRef]);

  useEffect(() => {
    if (kakaoMap) {
      kakaoMap.relayout();
    }
  }, [mapSize, kakaoMap]);

  return {
    mapSize,
    mapZoom
  };
}
