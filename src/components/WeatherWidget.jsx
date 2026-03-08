import { useState, useEffect } from "react";

const KMA_SERVICE_KEY = ""; // [지휘관님용] 공공데이터포털(data.go.kr)에서 발급받은 '기상청_단기예보' 서비스키를 여기에 붙여넣으세요.

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);

  const fetchWeather = async () => {
    if (!KMA_SERVICE_KEY) {
      setWeather({ temp: "9.2", sky: "맑음", pty: "0", tmn: "-1.0", tmx: "11.5", reh: "22", wsd: "3.5", vec: "북서", pcp: "강수없음" });
      return;
    }

    try {
      const now = new Date();
      const baseDate = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      const hours = [23, 20, 17, 14, 11, 8, 5, 2];
      const curHour = now.getHours();
      const baseHour = (hours.find(h => h <= curHour - 1) || 23).toString().padStart(2, '0') + "00";
      const url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${KMA_SERVICE_KEY}&numOfRows=1000&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseHour}&nx=98&ny=76`;

      const res = await fetch(url);
      const json = await res.json();
      const items = json.response?.body?.items?.item;
      if (!items) return;

      const data = {};
      const targetTime = String(curHour).padStart(2, '0') + "00";
      items.forEach(it => {
        if (it.fcstTime === targetTime) {
          if (it.category === "TMP") data.temp = it.fcstValue;
          if (it.category === "REH") data.reh = it.fcstValue;
          if (it.category === "WSD") data.wsd = it.fcstValue;
          if (it.category === "VEC") {
            const deg = parseInt(it.fcstValue);
            const dirs = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
            data.vec = dirs[Math.floor((deg + 22.5) / 45) % 8];
          }
          if (it.category === "SKY") {
            const codes = { "1": "맑음", "3": "구름많음", "4": "흐림" };
            data.sky = codes[it.fcstValue] || "맑음";
          }
          if (it.category === "PTY") data.pty = it.fcstValue;
          if (it.category === "PCP") data.pcp = it.fcstValue === "강수없음" ? "강수없음" : it.fcstValue;
        }
        if (it.category === "TMN") data.tmn = it.fcstValue;
        if (it.category === "TMX") data.tmx = it.fcstValue;
      });
      setWeather(data);
    } catch (err) {
      console.error("날씨 로드 에러:", err);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 1000 * 60 * 30);
    return () => clearInterval(interval);
  }, []);

  if (!weather) return null;

  const getWeatherIcon = () => {
    if (weather.pty !== "0") return "🌧️";
    if (weather.sky === "흐림") return "☁️";
    if (weather.sky === "구름많음") return "⛅";
    return "☀️";
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, background: "rgba(255,255,255,0.03)", padding: "4px 16px", borderRadius: 12, border: "1px solid #ffffff10" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ fontSize: 24, filter: "drop-shadow(0 0 5px #ffd70044)" }}>{getWeatherIcon()}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#a0c4d8", marginTop: -2 }}>{weather.sky}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "tabular-nums" }}>{weather.temp}°C</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#ff7050" }}>
            <span style={{ color: "#60a5fa" }}>{weather.tmn}°</span> / {weather.tmx}°
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, borderLeft: "1px solid #ffffff15", paddingLeft: 16, height: 28, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 700 }}>강수량</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#a0c4d8" }}>{weather.pcp}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 700 }}>풍향/속</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#a0c4d8" }}>{weather.vec} {weather.wsd}m/s</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 700 }}>습도</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#a0c4d8" }}>{weather.reh}%</span>
        </div>
      </div>
    </div>
  );
}
