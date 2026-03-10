import logo from "../icon.png";

export default function LoadingScreen() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#262834", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Pretendard', sans-serif" }}>
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
