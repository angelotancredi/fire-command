export default function LoadingScreen() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#000000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Pretendard', sans-serif", gap: 24 }}>
      <div style={{ fontSize: 120, animation: "pulse 2s ease-in-out infinite", filter: "drop-shadow(0 0 20px rgba(255,100,0,0.4))" }}>🔥</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#ff6030", letterSpacing: 4, textShadow: "0 0 10px rgba(255,96,48,0.3)" }}>FIRE COMMAND</div>
      <div style={{ fontSize: 13, color: "#4a7a9b", letterSpacing: 1, opacity: 0.8 }}>데이터 불러오는 중...</div>
      <div style={{ width: 240, height: 2, background: "#1a1a1a", borderRadius: 2, overflow: "hidden", marginTop: 12 }}>
        <div style={{ width: "60%", height: "100%", background: "linear-gradient(90deg,#ff4500,#ff8c00)", borderRadius: 2, animation: "load 1.5s ease-in-out infinite" }} />
      </div>
      <style>{`
        @keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
        @keyframes pulse{0%{transform:scale(1);opacity:0.9}50%{transform:scale(1.1);opacity:1}100%{transform:scale(1);opacity:0.9}}
        input[type="color"] { -webkit-appearance: none; border: none; cursor: pointer; background: none; padding: 0; border-radius: 50%; overflow: hidden; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; border-radius: 50%; }
        input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
        input[type="color"]::-moz-color-swatch { border: none; border-radius: 50%; }
      `}</style>
    </div>
  );
}
