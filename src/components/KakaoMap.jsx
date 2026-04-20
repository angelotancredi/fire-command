import { useEffect, useRef, useState } from "react";

const KAKAO_SDK_URL = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=f26e585f8772dcc5b2cea00080bdc8c3&libraries=services&autoload=false";

let kakaoLoaderPromise = null;

function loadKakaoMapsSdk() {
  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao);
  }

  if (kakaoLoaderPromise) {
    return kakaoLoaderPromise;
  }

  kakaoLoaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk.js"]');

    const handleReady = () => {
      if (window.kakao?.maps) {
        resolve(window.kakao);
        return;
      }

      reject(new Error("Kakao Maps SDK loaded, but window.kakao.maps is unavailable."));
    };

    const handleError = () => {
      reject(new Error("Failed to load Kakao Maps SDK script."));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleReady, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });

      // If the browser already finished loading the script before listeners were attached,
      // check again on the next tick so we can continue without a hard refresh.
      setTimeout(handleReady, 0);
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.onload = handleReady;
    script.onerror = handleError;
    document.head.appendChild(script);
  }).catch((error) => {
    kakaoLoaderPromise = null;
    throw error;
  });

  return kakaoLoaderPromise;
}

export default function KakaoMap({ center, onMapReady }) {
  const containerRef = useRef(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    console.log("KakaoMap: Preparing Kakao Maps SDK...");

    loadKakaoMapsSdk()
      .then((kakao) => {
        if (cancelled) return;

        if (!containerRef.current) {
          throw new Error("Map container is unavailable.");
        }

        console.log("KakaoMap: Calling window.kakao.maps.load...");
        kakao.maps.load(() => {
          if (cancelled || !containerRef.current) return;

          console.log("KakaoMap: window.kakao.maps.load callback executed.");
          try {
            const options = {
              center: new kakao.maps.LatLng(center.lat, center.lng),
              level: 3
            };
            const map = new kakao.maps.Map(containerRef.current, options);
            map.setMinLevel(0);
            onMapReady(map);
            map.setZoomable(true);
            map.setDraggable(true);
            setLoadError("");
            console.log("KakaoMap: Map instance created successfully.");
          } catch (err) {
            console.error("KakaoMap: Error during map initialization:", err);
            setLoadError(err.message || "Kakao map initialization failed.");
          }
        });
      })
      .catch((error) => {
        console.error("KakaoMap: SDK load failed:", error);
        if (!cancelled) {
          setLoadError(error.message || "Kakao Maps SDK failed to load.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, onMapReady]);

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
      {loadError ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 10,
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(27, 31, 59, 0.92)",
            color: "#fff",
            fontSize: 14,
            lineHeight: 1.45,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)"
          }}
        >
          카카오 지도를 불러오지 못했습니다.
          <br />
          {loadError}
        </div>
      ) : null}
    </>
  );
}
