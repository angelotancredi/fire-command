export default function LoadingScreen() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#1a1f2c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Pretendard', sans-serif", gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔥</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#ff6030", letterSpacing: 2 }}>FIRE COMMAND</div>
      <div style={{ fontSize: 12, color: "#4a7a9b", letterSpacing: 1 }}>데이터 불러오는 중...</div>
      <div style={{ width: 200, height: 3, background: "#1a3a52", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
        <div style={{ width: "60%", height: "100%", background: "linear-gradient(90deg,#ff4500,#ff8c00)", borderRadius: 2, animation: "load 1.2s ease-in-out infinite" }} />
      </div>
      <style>{`
        @keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
        @keyframes pulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.2);opacity:0.7}100%{transform:scale(1);opacity:1}}
        input[type="color"] { -webkit-appearance: none; border: none; cursor: pointer; background: none; padding: 0; border-radius: 50%; overflow: hidden; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; border-radius: 50%; }
        input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
        input[type="color"]::-moz-color-swatch { border: none; border-radius: 50%; }
      `}</style>
    </div>
  );
}
