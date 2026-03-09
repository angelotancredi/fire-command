import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";

export default function WeatherWidget({ lat, lng, locationName }) {
  const [weather, setWeather] = useState(null);
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // WMO Weather Interpretation Codes (WMO 기준 기상 코드 해석)
  const getWeatherInfo = (code) => {
    if (code === 0) return { icon: "☀️", label: "맑음" };
    if ([1, 2, 3].includes(code)) return { icon: "⛅", label: "구름조금" };
    if ([45, 48].includes(code)) return { icon: "🌫️", label: "안개" };
    if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", label: "이슬비" };
    if ([61, 63, 65, 66, 67].includes(code)) return { icon: "🌧️", label: "비" };
    if ([71, 73, 75, 77].includes(code)) return { icon: "❄️", label: "눈" };
    if ([80, 81, 82].includes(code)) return { icon: "🌦️", label: "소나기" };
    if ([95, 96, 99].includes(code)) return { icon: "⛈️", label: "뇌우" };
    return { icon: "☁️", label: "흐림" };
  };

  const fetchWeather = async () => {
    if (!lat || !lng) return;
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability,relative_humidity_2m,wind_speed_10m&timezone=Asia%2FSeoul&forecast_days=3`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.current) {
        const currentInfo = getWeatherInfo(data.current.weather_code);

        setWeather({
          temp: Math.round(data.current.temperature_2m),
          sky: currentInfo.label,
          icon: currentInfo.icon,
          reh: data.current.relative_humidity_2m,
          wsd: (data.current.wind_speed_10m / 3.6).toFixed(1), // km/h -> m/s
          pcp: data.current.precipitation,
          tmn: Math.round(Math.min(...data.hourly.temperature_2m.slice(0, 24))),
          tmx: Math.round(Math.max(...data.hourly.temperature_2m.slice(0, 24)))
        });

        const hourly = data.hourly;
        const now = new Date();
        const parsed = [];

        for (let i = 0; i < 48; i += 3) {
          const time = new Date(hourly.time[i]);
          const dayDiff = Math.floor((time.getTime() - new Date(now.toDateString()).getTime()) / (1000 * 60 * 60 * 24));
          const info = getWeatherInfo(hourly.weather_code[i]);

          parsed.push({
            hour: time.getHours(),
            day: dayDiff.toString(),
            temp: Math.round(hourly.temperature_2m[i]),
            sky: info.label,
            icon: info.icon,
            pcp: hourly.precipitation_probability[i] + "%",
            reh: hourly.relative_humidity_2m[i],
            wsd: (hourly.wind_speed_10m[i] / 3.6).toFixed(1)
          });
        }
        setForecasts(parsed);
      }
    } catch (err) {
      console.error("Weather fetch fail:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const timer = setInterval(fetchWeather, 600000);
    return () => clearInterval(timer);
  }, [lat, lng]);

  if (!weather && !loading) return <div style={{ color: "#4a7a9b", fontSize: 12 }}>⚠️ 날씨 확인 불가</div>;
  if (!weather) return <div style={{ color: "#4a7a9b", fontSize: 12 }}>⏳ 로딩 중...</div>;

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        style={{
          display: "flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,0.03)",
          padding: "4px 14px", borderRadius: 12, border: "1px solid #ffffff10", cursor: "pointer",
          transition: "all 0.2s"
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 22 }}>{weather.icon}</span>
          <span style={{ fontSize: 10, color: "#a0c4d8", fontWeight: 600 }}>{weather.sky}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{weather.temp}°C</span>
          <span style={{ fontSize: 13, color: "#ff7050" }}>
            <span style={{ color: "#60a5fa" }}>{weather.tmn}</span> / {weather.tmx}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, borderLeft: "1px solid #ffffff15", paddingLeft: 12, fontSize: 11, color: "#4a7a9b" }}>
          <div>강수 <b>{weather.pcp}mm</b></div>
          <div>풍속 <b>{weather.wsd}m/s</b></div>
          <div>습도 <b>{weather.reh}%</b></div>
        </div>
      </div>
      {showModal && (
        <WeatherModal
          forecasts={forecasts}
          locationName={locationName}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// 모달을 body 상단으로 포탈링하여 스태킹 컨텍스트 탈출
const WeatherModal = ({ forecasts, locationName, onClose }) => {
  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 999999,
        backdropFilter: "blur(15px)"
      }}
      onClick={onClose}
    >
      <div
        style={{ width: 900, background: "#0a1420", borderRadius: 16, border: "1px solid #1e3a52", padding: 30, position: "relative", boxShadow: "0 30px 70px rgba(0,0,0,0.9)" }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#4a7a9b", fontSize: 24, cursor: "pointer" }}>✕</button>

        <h2 style={{ margin: "0 0 24px 0", color: "#fff", fontSize: 22, fontWeight: 300 }}>
          시간별 상세 예보({locationName || "현장"})
          <span style={{ fontSize: 14, color: "#7ec8e3", fontWeight: 300, marginLeft: 12 }}>
            Open-Meteo 실시간 정보
          </span>
        </h2>

        <div style={{ display: "flex", overflowX: "auto", paddingBottom: 12, border: "1px solid #1e3a5244", borderRadius: 12, background: "#080f1a", minHeight: 220 }}>
          {forecasts.map((f, i) => (
            <div key={i} style={{ minWidth: 100, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 10px", borderRight: "1px solid #1e3a5222" }}>
              <div style={{ fontSize: 11, color: f.day === "0" ? "#7ec8e3" : f.day === "1" ? "#ff7050" : "#a0c4d8", fontWeight: 600, marginBottom: 10 }}>
                {f.day === "0" ? "오늘" : f.day === "1" ? "내일" : "모레"}
              </div>
              <div style={{ fontSize: 15, fontWeight: 300, color: "#fff", marginBottom: 14 }}>{f.hour}시</div>
              <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 300, color: "#fff" }}>{f.temp}°</div>

              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#ffffff", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <img src="/src/assets/icons/rain.svg" alt="rain" style={{ width: 18, height: 18 }} />
                  <span>{f.pcp}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <span style={{ fontSize: 14 }}>💧</span>
                  <span>{f.reh}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <img src="/src/assets/icons/windy.svg" alt="wind" style={{ width: 18, height: 18 }} />
                  <span>{f.wsd}m/s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: "#4a7a9b", textAlign: "right" }}>* 기상 아이콘은 실시간 기상 데이터를 기반으로 시각화되었습니다.</p>
      </div>
    </div>,
    document.body
  );
};
