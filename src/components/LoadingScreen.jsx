import logo from "../icon.png";

export default function LoadingScreen() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#060d18", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Pretendard', sans-serif", color: "#fff" }}>
      <style>{`
        @keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
        @keyframes pulse{0%{transform:scale(1);opacity:0.9}50%{transform:scale(1.1);opacity:1}100%{transform:scale(1);opacity:0.9}}
      `}</style>
      <div style={{ fontSize: 40, marginBottom: 20, animation: "pulse 2s infinite" }}>🔥</div>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, color: "#ff6030", marginBottom: 8 }}>FIRE COMMAND</div>
      <div style={{ fontSize: 12, color: "#4a7a9b", letterSpacing: 1, fontWeight: 500, marginBottom: 24 }}>CONNECTING TO SUPABASE...</div>
      <div style={{ width: 200, height: 2, background: "#1e3a52", borderRadius: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "30%", height: "100%", background: "linear-gradient(90deg, transparent, #ff6030, transparent)", animation: "load 1.5s infinite" }} />
      </div>
    </div>
  );
}
