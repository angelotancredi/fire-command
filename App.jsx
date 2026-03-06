import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mzotdlkxabblgnnznghd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b3RkbGt4YWJibGdubnpuZ2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAyNTgsImV4cCI6MjA4ODI3NjI1OH0.LS6v02asmLf0gfrOxX-Jk18SUCvTeHIX1uIv66OhqSw";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VEHICLE_ICONS = { pump: "🚒", ladder: "🏗️", rescue: "🚐", chemical: "🔴", ambulance: "🚑", tanker: "💧", command: "📡", investigation: "🔍", smoke: "🔦" };
const VEHICLE_LABELS = { pump: "펌프차", ladder: "사다리차", rescue: "구조차", chemical: "화학차", ambulance: "구급차", tanker: "물탱크차", command: "지휘차", investigation: "조사차", smoke: "조연차" };
const RANKS = ["소방사", "소방교", "소방장", "소방위", "소방경", "소방령", "소방정"];
const ROLES = ["팀장", "경방", "기관", "구급", "구조대"];

const DISTRICTS = [
  { name: "삼정동", center: { lat: 35.2312, lng: 128.8924 }, jurisdictional: "삼정119안전센터" },
  { name: "어방동", center: { lat: 35.2442, lng: 128.9056 }, jurisdictional: "삼정119안전센터" },
  { name: "삼방동", center: { lat: 35.2415, lng: 128.9142 }, jurisdictional: "삼정119안전센터" },
  { name: "안동", center: { lat: 35.2355, lng: 128.9188 }, jurisdictional: "삼정119안전센터" },
  { name: "지내동", center: { lat: 35.2288, lng: 128.9255 }, jurisdictional: "삼정119안전센터" },
  { name: "불암동", center: { lat: 35.2244, lng: 128.9288 }, jurisdictional: "삼정119안전센터" },
  { name: "부원동", center: { lat: 35.2288, lng: 128.8855 }, jurisdictional: "동상119안전센터" },
  { name: "봉황동", center: { lat: 35.2305, lng: 128.8788 }, jurisdictional: "동상119안전센터" },
  { name: "서상동", center: { lat: 35.2333, lng: 128.8805 }, jurisdictional: "동상119안전센터" },
  { name: "동상동", center: { lat: 35.2366, lng: 128.8844 }, jurisdictional: "동상119안전센터" },
  { name: "대성동", center: { lat: 35.2411, lng: 128.8788 }, jurisdictional: "북부119안전센터" },
  { name: "내외동", center: { lat: 35.2345, lng: 128.8654 }, jurisdictional: "내외119안전센터" },
  { name: "칠산서부동", center: { lat: 35.2155, lng: 128.8588 }, jurisdictional: "내외119안전센터" },
  { name: "구산동", center: { lat: 35.2512, lng: 128.8744 }, jurisdictional: "북부119안전센터" },
  { name: "삼계동", center: { lat: 35.2712, lng: 128.8712 }, jurisdictional: "북부119안전센터" },
  {
    name: "상동면", center: { lat: 35.3183, lng: 128.9748 }, jurisdictional: "상동119안전센터",
    subDistricts: [
      { name: "매리", lat: 35.3090, lng: 128.9890 },
      { name: "대감리", lat: 35.3183, lng: 128.9748 },
      { name: "감노리", lat: 35.3134, lng: 128.9954 },
      { name: "여차리", lat: 35.3180, lng: 128.9980 },
      { name: "우계리", lat: 35.3180, lng: 128.9610 },
      { name: "묵방리", lat: 35.3140, lng: 128.9480 }
    ]
  },
  {
    name: "생림면", center: { lat: 35.3412, lng: 128.8543 }, jurisdictional: "생림119안전센터",
    subDistricts: [
      { name: "나전리", lat: 35.3344, lng: 128.8677 },
      { name: "도요리", lat: 35.3512, lng: 128.8812 },
      { name: "마사리", lat: 35.3612, lng: 128.8412 },
      { name: "봉림리", lat: 35.3455, lng: 128.8343 },
      { name: "사촌리", lat: 35.3312, lng: 128.8443 },
      { name: "생림리", lat: 35.3412, lng: 128.8543 },
      { name: "생철리", lat: 35.3488, lng: 128.8512 },
      { name: "안양리", lat: 35.3588, lng: 128.8612 }
    ]
  },
  {
    name: "대동면", center: { lat: 35.2755, lng: 128.9588 }, jurisdictional: "대동119안전센터",
    subDistricts: [
      { name: "괴정리", lat: 35.2555, lng: 128.9588 },
      { name: "대감리", lat: 35.2676, lng: 128.9806 },
      { name: "덕산리", lat: 35.2755, lng: 128.9688 },
      { name: "수안리", lat: 35.2455, lng: 128.9788 },
      { name: "예안리", lat: 35.2855, lng: 128.9488 },
      { name: "월촌리", lat: 35.2655, lng: 128.9655 },
      { name: "조눌리", lat: 35.2788, lng: 128.9611 },
      { name: "주동리", lat: 35.2855, lng: 128.9788 },
      { name: "주중리", lat: 35.2822, lng: 128.9722 },
      { name: "초정리", lat: 35.2755, lng: 128.9588 }
    ]
  },
];

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const DistrictSelector = ({ onSelect }) => {
  const [selectedMain, setSelectedMain] = useState(null);

  const modalStyle = {
    position: 'fixed', inset: 0, background: 'rgba(6, 13, 24, 0.9)', backdropFilter: 'blur(15px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
  };

  const containerStyle = {
    background: '#0e1925', border: '1px solid #1e3a52', borderRadius: 24, padding: 32,
    maxWidth: 600, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 20px rgba(255, 69, 0, 0.1)'
  };

  const gridStyle = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginTop: 24
  };

  const buttonStyle = (active) => ({
    background: active ? 'linear-gradient(135deg, #ff4500, #ff8c00)' : '#0d1f30',
    border: `1px solid ${active ? '#ff4500' : '#1e3a52'}`,
    borderRadius: 12, padding: '16px 12px', color: active ? '#fff' : '#7ec8e3',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
    textAlign: 'center', boxShadow: active ? '0 10px 20px rgba(255, 69, 0, 0.3)' : 'none'
  });

  return (
    <div style={modalStyle}>
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#ff6030', fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>ADMINISTRATIVE DISTRICT</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#fff' }}>작전 구역을 선택하세요</div>
        </div>

        {!selectedMain ? (
          <div style={gridStyle}>
            {DISTRICTS.map(d => (
              <button key={d.name} onClick={() => d.subDistricts ? setSelectedMain(d) : onSelect(d)} style={buttonStyle(false)}>
                {d.name}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0d1f30', padding: '12px 16px', borderRadius: 12, marginBottom: 16 }}>
              <button onClick={() => setSelectedMain(null)} style={{ background: 'none', border: 'none', color: '#7ec8e3', cursor: 'pointer', fontSize: 14 }}>← 이전</button>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{selectedMain.name} 상세 구역</div>
            </div>
            <div style={gridStyle}>
              {selectedMain.subDistricts.map(s => (
                <button key={s.name} onClick={() => onSelect({ ...selectedMain, name: `${selectedMain.name} ${s.name}`, center: { lat: s.lat, lng: s.lng } })} style={buttonStyle(false)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const KakaoMap = ({ center, onMapReady }) => {
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
};

function LoadingScreen() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#060d18", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Pretendard', sans-serif", gap: 16 }}>
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

function ManageScreen({ centers, setCenters, personnel, setPersonnel, vehicles, setVehicles, onBack }) {
  const [tab, setTab] = useState("centers");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cForm, setCForm] = useState({ name: "", color: "#FF4500" });
  const [pForm, setPForm] = useState({ name: "", role: "경방", center_id: "", vehicle_id: "" });
  const [vForm, setVForm] = useState({ name: "", type: "pump", center_id: "" });

  const showMsg = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 2500); };

  const addCenter = async () => {
    if (!cForm.name.trim()) return showMsg("센터 이름을 입력하세요", false);
    setLoading(true);
    const { data, error } = await supabase.from("centers").insert([cForm]).select().single();
    setLoading(false);
    if (error) return showMsg("오류: " + error.message, false);
    setCenters(prev => [...prev, data]);
    setCForm({ name: "", color: "#FF4500" });
    showMsg("센터가 추가됐어요");
  };

  const deleteCenter = async (id) => {
    if (!window.confirm("삭제하면 해당 센터의 대원/차량도 삭제돼요. 계속할까요?")) return;
    const { error } = await supabase.from("centers").delete().eq("id", id);
    if (error) return showMsg("오류: " + error.message, false);
    setCenters(prev => prev.filter(c => c.id !== id));
    setPersonnel(prev => prev.filter(p => p.center_id !== id));
    setVehicles(prev => prev.filter(v => v.center_id !== id));
    showMsg("삭제됐어요");
  };

  const addPersonnel = async () => {
    if (!pForm.name.trim()) return showMsg("이름을 입력하세요", false);
    if (!pForm.center_id) return showMsg("소속 센터를 선택하세요", false);
    setLoading(true);
    const payload = { ...pForm, vehicle_id: pForm.vehicle_id || null };
    const { data, error } = await supabase.from("personnel").insert([payload]).select().single();
    setLoading(false);
    if (error) return showMsg("오류: " + error.message, false);
    setPersonnel(prev => [...prev, data]);
    setPForm({ name: "", role: "경방", center_id: pForm.center_id, vehicle_id: "" });
    showMsg("대원이 추가됐어요");
  };

  const deletePersonnel = async (id) => {
    const { error } = await supabase.from("personnel").delete().eq("id", id);
    if (error) return showMsg("오류: " + error.message, false);
    setPersonnel(prev => prev.filter(p => p.id !== id));
    showMsg("삭제됐어요");
  };

  const updateCenterColor = async (id, color) => {
    const { error } = await supabase.from("centers").update({ color }).eq("id", id);
    if (error) return showMsg("오류: " + error.message, false);
    setCenters(prev => prev.map(c => c.id === id ? { ...c, color } : c));
    showMsg("색상이 수정되었어요");
  };

  const addVehicle = async () => {
    if (!vForm.name.trim()) return showMsg("차량명을 입력하세요", false);
    if (!vForm.center_id) return showMsg("소속 센터를 선택하세요", false);
    setLoading(true);
    const { data, error } = await supabase.from("vehicles").insert([{ ...vForm, plate: "" }]).select().single();
    setLoading(false);
    if (error) return showMsg("오류: " + error.message, false);
    setVehicles(prev => [...prev, data]);
    setVForm({ name: "", type: "pump", center_id: vForm.center_id });
    showMsg("차량이 추가됐어요");
  };

  const deleteVehicle = async (id) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return showMsg("오류: " + error.message, false);
    setVehicles(prev => prev.filter(v => v.id !== id));
    showMsg("삭제됐어요");
  };

  const inp = { background: "#0d1f30", border: "1px solid #1e3a52", borderRadius: 6, color: "#e8eef5", padding: "8px 12px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const btnAdd = { background: "linear-gradient(135deg, #ff4500, #ff6030)", border: "none", borderRadius: 6, color: "#fff", padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
  const btnDel = { background: "transparent", border: "1px solid #ff450066", borderRadius: 4, color: "#ff7050", padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 500 };

  return (
    <div style={{ width: "100%", height: "100vh", background: "#060d18", display: "flex", flexDirection: "column", fontFamily: "'Pretendard', sans-serif", color: "#e8eef5" }}>
      <div style={{ height: 60, background: "#0e1925", borderBottom: "1px solid #1e3a52", display: "flex", alignItems: "center", padding: "0 20px", gap: 16, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 8, color: "#7ec8e3", padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← 지휘 화면으로</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>데이터 관리 센터</div>
        {msg && <div style={{ background: msg.ok ? "#1a3a1a" : "#3a1a1a", border: `1px solid ${msg.ok ? "#2d6a2d" : "#ff4500"}`, borderRadius: 8, padding: "6px 14px", color: msg.ok ? "#4ade80" : "#ff7050", fontSize: 13, fontWeight: 600 }}>{msg.text}</div>}
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #1e3a52", flexShrink: 0, background: "#080f1a" }}>
        {[{ key: "centers", label: "🏢 센터" }, { key: "vehicles", label: "🚒 차량" }, { key: "personnel", label: "👤 대원" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "12px 28px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === t.key ? "#ff4500" : "transparent"}`, color: tab === t.key ? "#ff7050" : "#4a7a9b", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: 1 }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "centers" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 640, width: "100%", padding: 24, overflow: "hidden" }}>
            <div style={{ flexShrink: 0, marginBottom: 20, background: "#0d1f30", borderRadius: 10, padding: 20, border: "1px solid #1e3a52" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7ec8e3", marginBottom: 14 }}>새 센터 추가</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input value={cForm.name} onChange={e => setCForm(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === "Enter" && addCenter()} placeholder="센터 이름 (예: 삼정119안전센터)" style={{ ...inp, flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: "#4a7a9b" }}>색상</span>
                  <input type="color" value={cForm.color} onChange={e => setCForm(p => ({ ...p, color: e.target.value }))} style={{ width: 36, height: 36, border: "none", background: "none", cursor: "pointer" }} />
                </div>
                <button onClick={addCenter} disabled={loading} style={btnAdd}>추가</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
              {centers.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0d1f2d", border: "1px solid #1e3a52", borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
                  <input
                    type="color"
                    value={c.color}
                    onChange={e => updateCenterColor(c.id, e.target.value)}
                    style={{ width: 20, height: 20, border: "none", background: "none", cursor: "pointer", padding: 0, borderRadius: "50%", flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{c.name}</span>
                  <button onClick={() => deleteCenter(c.id)} style={btnDel}>삭제</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "vehicles" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 720, width: "100%", padding: 24, overflow: "hidden" }}>
            <div style={{ flexShrink: 0, marginBottom: 20, background: "#0d1f30", borderRadius: 10, padding: 20, border: "1px solid #1e3a52" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7ec8e3", marginBottom: 14 }}>새 차량 추가</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select value={vForm.center_id} onChange={e => setVForm(v => ({ ...v, center_id: e.target.value }))} style={{ ...inp, width: 160 }}>
                  <option value="">소속 센터 선택</option>
                  {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={vForm.type} onChange={e => setVForm(v => ({ ...v, type: e.target.value }))} style={{ ...inp, width: 130 }}>{Object.entries(VEHICLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <input value={vForm.name} onChange={e => setVForm(v => ({ ...v, name: e.target.value }))} placeholder="차량명 (예: 생림펌프)" style={{ ...inp, width: 220 }} />
                <button onClick={addVehicle} disabled={loading} style={btnAdd}>추가</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
              {centers.map(c => {
                const vlist = vehicles.filter(v => v.center_id === c.id);
                if (!vlist.length) return null;
                return (
                  <div key={c.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#0d1f2d", borderRadius: "8px 8px 0 0", border: "1px solid #1e3a52", borderBottom: "none" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.name}</span>
                    </div>
                    <div style={{ border: "1px solid #1e3a52", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                      {vlist.map((v, i) => (
                        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: i % 2 === 0 ? "#0a1828" : "#0d1f2d", borderBottom: i < vlist.length - 1 ? "1px solid #1e3a5244" : "none" }}>
                          <span style={{ fontSize: 20 }}>{VEHICLE_ICONS[v.type]}</span>
                          <span style={{ width: 110, fontSize: 13, fontWeight: 600 }}>{v.name}</span>
                          <span style={{ flex: 1, fontSize: 11, color: "#7ec8e3" }}>{VEHICLE_LABELS[v.type]}</span>
                          <button onClick={() => deleteVehicle(v.id)} style={btnDel}>삭제</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === "personnel" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 720, width: "100%", padding: 24, overflow: "hidden" }}>
            <div style={{ flexShrink: 0, marginBottom: 20, background: "#0d1f30", borderRadius: 10, padding: 20, border: "1px solid #1e3a52" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7ec8e3", marginBottom: 14 }}>새 대원 추가</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <select value={pForm.center_id} onChange={e => setPForm(p => ({ ...p, center_id: e.target.value, vehicle_id: "" }))} style={{ ...inp, width: 160 }}>
                  <option value="">소속 센터 선택</option>
                  {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={pForm.vehicle_id} onChange={e => setPForm(p => ({ ...p, vehicle_id: e.target.value }))} style={{ ...inp, width: 150 }}>
                  <option value="">탑승 차량 선택</option>
                  {vehicles.filter(v => v.center_id === pForm.center_id).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <select value={pForm.role} onChange={e => setPForm(p => ({ ...p, role: e.target.value }))} style={{ ...inp, width: 100 }}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
                <input value={pForm.name} onChange={e => setPForm(p => ({ ...p, name: e.target.value }))} placeholder="이름" style={{ ...inp, width: 130 }} />
                <button onClick={addPersonnel} disabled={loading} style={btnAdd}>추가</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
              {centers.map(c => {
                const mList = personnel.filter(p => p.center_id === c.id);
                if (!mList.length) return null;
                return (
                  <div key={c.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#0d1f2d", borderRadius: "8px 8px 0 0", border: "1px solid #1e3a52", borderBottom: "none" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.name}</span>
                    </div>
                    <div style={{ border: "1px solid #1e3a52", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                      {mList.map((p, i) => {
                        const v = vehicles.find(veh => veh.id === p.vehicle_id);
                        return (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: i % 2 === 0 ? "#0a1828" : "#0d1f2d", borderBottom: i < mList.length - 1 ? "1px solid #1e3a5244" : "none" }}>
                            <span style={{ fontSize: 18 }}>👤</span>
                            <span style={{ width: 140, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</span>
                            <span style={{ width: 100, fontSize: 11, color: "#7ec8e3", whiteSpace: "nowrap" }}>{v ? v.name : "미배정"}</span>
                            <span style={{ flex: 1, fontSize: 11, color: "#4a7a9b" }}>{p.role}</span>
                            <button onClick={() => deletePersonnel(p.id)} style={btnDel}>삭제</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CommandScreen({
  centers, personnel, vehicles, selectedDistrict, onManage, onGlobalReset,
  deployed, setDeployed,
  logs, setLogs,
  accidentPos, setAccidentPos,
  accidentAddress, setAccidentAddress,
  isAccidentLocked, setIsAccidentLocked,
  hoseLinks, setHoseLinks,
  time, addLog,
  selected, setSelected,
  activeTab, setSideTab,
  expandedCenters, setExpandedCenters
}) {
  const [kakaoMap, setKakaoMap] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [history, setHistory] = useState([]);
  const [showConfirm, setShowConfirm] = useState(null);
  const fireMarkerRef = useRef(null);
  const suppressionCircleRef = useRef(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGlobalResetInit, setShowGlobalResetInit] = useState(false);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const dragPayloadRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // 클릭 지점과 마커 중심 간의 픽셀 오프셋
  const dragStartPosRef = useRef(null);
  const hoseLinesRef = useRef([]); // 수관 Polyline 인스턴스 보관
  const [dragPos, setDragPos] = useState(null);
  const [hoseDragSource, setHoseDragSource] = useState(null); // 수관 연장 시작 차량 ID

  const saveDeployment = async (itemId, itemType, lat, lng) => {
    try {
      await supabase
        .from("deployments")
        .upsert({ item_id: itemId, item_type: itemType, lat, lng }, { onConflict: "item_id" });
    } catch (err) {
      console.error("Save deployment failed:", err);
    }
  };

  const sortedCenters = useMemo(() => {
    if (!selectedDistrict) return centers;
    return [...centers].sort((a, b) => {
      if (a.name === selectedDistrict.jurisdictional) return -1;
      if (b.name === selectedDistrict.jurisdictional) return 1;
      const distA = getDistance(selectedDistrict.center.lat, selectedDistrict.center.lng, a.lat, a.lng);
      const distB = getDistance(selectedDistrict.center.lat, selectedDistrict.center.lng, b.lat, b.lng);
      return distA - distB;
    });
  }, [centers, selectedDistrict]);

  useEffect(() => {
    if (kakaoMap && selectedDistrict) {
      try {
        const moveLatLon = new window.kakao.maps.LatLng(selectedDistrict.center.lat, selectedDistrict.center.lng);
        // 지도가 이미 그 위치가 아니라면 이동
        const currentCenter = kakaoMap.getCenter();
        if (getDistance(currentCenter.getLat(), currentCenter.getLng(), selectedDistrict.center.lat, selectedDistrict.center.lng) > 0.001) {
          kakaoMap.panTo(moveLatLon);
        }
        // 구역 변경 시 화점 위치 초기화 (좌표가 다를 때만)
        if (!accidentPos || accidentPos.lat !== selectedDistrict.center.lat) {
          setAccidentPos(selectedDistrict.center);
          setIsAccidentLocked(false);
          addLog(`${selectedDistrict.name} 작전 구역 설정`, "info");
        }
      } catch (err) { console.error("Map panTo error:", err); }
    }
  }, [kakaoMap, selectedDistrict]);

  useEffect(() => {
    if (selectedDistrict && sortedCenters.length > 0) {
      const initial = {};
      sortedCenters.forEach(c => {
        initial[c.id] = c.name === selectedDistrict.jurisdictional;
      });
      setExpandedCenters(initial);
    }
  }, [selectedDistrict, sortedCenters]);

  // 마커 오버레이 동기화
  useEffect(() => {
    if (!kakaoMap || !window.kakao || !window.kakao.maps) return;

    try {
      // 기존 오버레이 제거
      overlaysRef.current.forEach(o => {
        if (o) o.setMap(null);
      });
      overlaysRef.current = [];

      Object.values(deployed).forEach(item => {
        // 좌표 유효성 검사 (NaN 또는 0/undefined 방지)
        if (!item.lat || !item.lng || isNaN(item.lat) || isNaN(item.lng)) return;

        const c = centers.find(center => center.id === item.center_id);
        const color = c?.color || "#ff4500";
        const isSelected = selected === item.id;

        const content = document.createElement("div");
        content.style.cursor = "pointer";
        content.style.position = "relative";
        content.style.zIndex = isSelected ? "1000" : "10";

        const markerHtml = `
          <div style="background: ${item.itemType === 'vehicle' ? '#1e2a3a' : '#2a1a1a'}; 
                      border: 2px solid ${isSelected ? '#fff' : color}; 
                      border-radius: ${item.itemType === 'vehicle' ? '8px' : '50%'}; 
                      padding: 6px; display: flex; gap: 4px; align-items: center; 
                      box-shadow: ${isSelected ? '0 0 20px ' + color : '0 4px 12px rgba(0,0,0,0.5)'}; 
                      white-space: nowrap; pointer-events: auto; user-select: none;
                      transition: all 0.2s;">
            <span style="font-size: 16px;">${item.itemType === 'vehicle' ? VEHICLE_ICONS[item.type] : "👤"}</span>
            <span style="font-size: 11px; font-weight: 600; color: #fff;">${item.name}</span>
          </div>
        `;
        content.innerHTML = markerHtml;

        // 마커 mouseup/touchend 리스너 삭제 (글로벌 onUp에서 통합 처리)
        // const toggleSelect = (e) => { ... } <- 제거됨

        // 마커 mousedown/touchstart → 드래그 준비 (오프셋 보정)
        const startDrag = (e) => {
          e.stopPropagation();
          const touch = e.touches ? e.touches[0] : e;
          const pos = { x: touch.clientX, y: touch.clientY };
          dragStartPosRef.current = pos;

          // 마커 중심의 현재 화면 좌표 계산 (오프셋 보정용 정보만 보관)
          if (mapRef.current && kakaoMap) {
            const rect = mapRef.current.getBoundingClientRect();
            const cp = kakaoMap.getProjection().containerPointFromCoords(
              new window.kakao.maps.LatLng(item.lat, item.lng)
            );
            dragOffsetRef.current = {
              x: touch.clientX - (rect.left + cp.x),
              y: touch.clientY - (rect.top + cp.y)
            };
          } else {
            dragOffsetRef.current = { x: 0, y: 0 };
          }
          dragPayloadRef.current = { ...item, isMoving: true };
          // setDragging은 여기서 하지 않음 -> onMove에서 임계값 확인 후 수행
        };

        content.addEventListener('mousedown', startDrag);
        content.addEventListener('touchstart', startDrag);

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(item.lat, item.lng),
          content: content,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: isSelected ? 2000 : 1000,
          clickable: true
        });
        overlay.setMap(kakaoMap);
        overlaysRef.current.push(overlay);
      });

      // 선택된 유닛 전용 팝업 오버레이 소환
      if (selected && deployed[selected]) {
        const item = deployed[selected];
        const popupDiv = document.createElement("div");

        // 차량일 경우 전술 관제 팝업 디자인
        if (item.itemType === "vehicle") {
          popupDiv.style.cssText = `
            background: linear-gradient(145deg, #0e1e2e, #16263a);
            border: 1px solid #ff4500;
            border-radius: 14px;
            padding: 0;
            min-width: 220px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.9);
            position: relative;
            color: #fff;
            margin-bottom: 25px;
            overflow: hidden;
            font-family: 'Pretendard', sans-serif;
          `;

          // 헤더 (차량명)
          const header = document.createElement("div");
          header.style.cssText = "background: #1a2a3a; padding: 12px 16px; border-bottom: 1px solid #ff450033; display: flex; align-items: center; gap: 8px;";
          header.innerHTML = `<span style="font-size: 20px;">${VEHICLE_ICONS[item.type]}</span> <span style="font-weight: 700; font-size: 15px;">${item.name}</span>`;
          popupDiv.appendChild(header);

          // 대원 리스트 영역
          const crewList = document.createElement("div");
          crewList.style.cssText = "padding: 12px; max-height: 180px; overflow-y: auto;";
          const vehicleCrew = personnel.filter(p => p.vehicle_id === item.id);

          if (vehicleCrew.length > 0) {
            const crewTitle = document.createElement("div");
            crewTitle.style.cssText = "font-size: 11px; color: #7ec8e3; margin-bottom: 8px; font-weight: 600;";
            crewTitle.innerText = `탑승 대원 (${vehicleCrew.length}명)`;
            crewList.appendChild(crewTitle);

            vehicleCrew.forEach(p => {
              const crewItem = document.createElement("div");
              crewItem.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: #0a1828; border-radius: 6px; margin-bottom: 4px; border: 1px solid #1e3a52; cursor: grab;";
              crewItem.innerHTML = `<span style="font-size: 14px;">👤</span> <span style="font-size: 13px;">${p.name}</span> <span style="font-size: 10px; color: #4a7a9b; border: 1px solid #1e3a52; padding: 1px 4px; border-radius: 4px;">${p.role}</span>`;

              // 대원 개별 드래그 배치 로직
              crewItem.onmousedown = (e) => {
                e.preventDefault(); e.stopPropagation();
                // 기존 startDrag 로직과 유사하게 처리
                const touch = e.touches ? e.touches[0] : e;
                dragStartPosRef.current = { x: touch.clientX, y: touch.clientY };
                dragPayloadRef.current = { ...p, itemType: "personnel", isMoving: false };
                dragOffsetRef.current = { x: 0, y: 0 }; // 팝업 내 드래그는 오프셋 0으로 시작
                setSelected(null); // 드래그 시작 시 차량 팝업 닫기
              };

              crewList.appendChild(crewItem);
            });
          } else {
            crewList.innerHTML = `<div style="font-size: 12px; color: #4a7a9b; text-align: center; padding: 10px;">탑승 대원 없음</div>`;
          }
          popupDiv.appendChild(crewList);

          // 액션 버튼 영역
          const actions = document.createElement("div");
          actions.style.cssText = "padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 6px; background: rgba(0,0,0,0.2);";

          const hoseBtn = document.createElement("button");
          hoseBtn.innerText = "🔌 수관 연장 (드래그)";
          hoseBtn.style.cssText = "width: 100%; padding: 10px 0; background: #007bff; border: none; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: crosshair;";

          const startHoseDrag = (e) => {
            e.stopPropagation();
            const touch = e.touches ? e.touches[0] : e;
            setHoseDragSource(item.id);
            setDragPos({ x: touch.clientX, y: touch.clientY });
            setSelected(null); // 연장 모드 시작 시 팝업 닫기
          };

          hoseBtn.onmousedown = startHoseDrag;
          hoseBtn.ontouchstart = startHoseDrag;
          actions.appendChild(hoseBtn);

          const recallBtn = document.createElement("button");
          recallBtn.innerText = "🚨 현장 철수";
          recallBtn.style.cssText = "width: 100%; padding: 8px 0; background: #3a1a1a; border: 1px solid #ff450066; color: #ff7050; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;";
          recallBtn.onclick = (e) => {
            e.stopPropagation();
            setShowConfirm({ id: item.id, name: item.name });
          };
          actions.appendChild(recallBtn);

          popupDiv.appendChild(actions);

        } else {
          // 대원 및 기타 유닛 팝업 디자인 (기존 스타일 유지)
          popupDiv.style.cssText = `
            background: linear-gradient(135deg, #0e1e2e, #16263a);
            border: 1px solid #ff4500;
            border-radius: 12px;
            padding: 16px;
            min-width: 180px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            position: relative;
            color: #fff;
            text-align: center;
            margin-bottom: 20px;
          `;

          const title = document.createElement("div");
          title.style.cssText = "font-size: 16px; font-weight: 700; margin-bottom: 4px;";
          title.innerText = item.name;
          popupDiv.appendChild(title);

          const sub = document.createElement("div");
          sub.style.cssText = "font-size: 11px; color: #7ec8e3; margin-bottom: 12px;";
          sub.innerText = item.itemType === "vehicle" ? VEHICLE_LABELS[item.type] : item.role;
          popupDiv.appendChild(sub);

          const recallBtn = document.createElement("button");
          recallBtn.innerText = "🚨 현장 철수";
          recallBtn.style.cssText = `
            width: 100%; padding: 10px 0; background: #3a1a1a; border: 1px solid #ff4500;
            color: #ff7050; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;
          `;
          recallBtn.onclick = (e) => {
            e.stopPropagation();
            setShowConfirm({ id: item.id, name: item.name });
          };
          popupDiv.appendChild(recallBtn);
        }

        // 공통: 닫기 버튼
        const closeBtn = document.createElement("div");
        closeBtn.innerText = "✕";
        closeBtn.style.cssText = "position: absolute; top: 10px; right: 12px; color: #4a7a9b; cursor: pointer; font-size: 16px; z-index: 10;";
        closeBtn.onclick = (e) => { e.stopPropagation(); setSelected(null); };
        popupDiv.appendChild(closeBtn);

        // 공통: 화살표 꼬리
        const arrow = document.createElement("div");
        arrow.style.cssText = "position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #ff4500;";
        popupDiv.appendChild(arrow);

        const popupOverlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(item.lat, item.lng),
          content: popupDiv,
          yAnchor: 1.1,
          zIndex: 10000,
          clickable: true
        });
        popupOverlay.setMap(kakaoMap);
        overlaysRef.current.push(popupOverlay);
      }
    } catch (err) {
      console.error("Overlay sync error:", err);
    }
  }, [kakaoMap, deployed, selected]);


  // document 레벨 마우스 핸들러 (카카오맵 이벤트 흡수 우회 + 오프셋 보정)
  useEffect(() => {
    const onMove = (e) => {
      const touch = e.touches ? e.touches[0] : e;

      // 1. 수관 연장 드래그 중인 경우
      if (hoseDragSource) {
        setDragPos({ x: touch.clientX, y: touch.clientY });
        return;
      }

      if (!dragPayloadRef.current) return;

      // 2. 일반 유닛 드래그 임계값 체크
      if (!dragging && dragStartPosRef.current) {
        const dist = Math.sqrt(
          Math.pow(touch.clientX - dragStartPosRef.current.x, 2) +
          Math.pow(touch.clientY - dragStartPosRef.current.y, 2)
        );
        if (dist > 5) {
          setDragging(dragPayloadRef.current);
        }
      }

      if (dragging) {
        setDragPos({ x: touch.clientX, y: touch.clientY });
      }
    };
    const onUp = async (e) => {
      const touch = e.changedTouches ? e.changedTouches[0] : e;

      // 1. 수관 연장 드롭 처리
      if (hoseDragSource && mapRef.current && kakaoMap) {
        const rect = mapRef.current.getBoundingClientRect();
        const point = new window.kakao.maps.Point(touch.clientX - rect.left, touch.clientY - rect.top);
        const latlng = kakaoMap.getProjection().coordsFromContainerPoint(point);

        if (latlng) {
          // 인근 차량 탐색 (임계값 내)
          const targetVehicleId = Object.keys(deployed).find(id => {
            const d = deployed[id];
            if (d.itemType !== 'vehicle' || id === hoseDragSource) return false;
            const dist = getDistance(latlng.getLat(), latlng.getLng(), d.lat, d.lng);
            return dist < 0.05; // 약 50m 이내
          });

          if (targetVehicleId) {
            setHoseLinks(prev => [
              ...prev.filter(l => !(l.fromId === hoseDragSource && l.toId === targetVehicleId)),
              { id: Date.now(), fromId: hoseDragSource, toId: targetVehicleId }
            ]);
            const fromName = deployed[hoseDragSource]?.name || "차량";
            const toName = deployed[targetVehicleId]?.name || "차량";
            addLog(`${fromName} → ${toName} 수관 연장됨`, "info");
          }
        }
        setHoseDragSource(null);
        setDragPos(null);
        return;
      }

      const data = dragPayloadRef.current;
      if (!data) {
        // 드래그가 시작되지 않았거나 수관 드래그가 취소된 경우
        setHoseDragSource(null);
        setDragPos(null);
        return;
      }

      // 2. 일반 유닛 드롭 처리
      // 만약 드래그가 발생하지 않았다면 (=임계값을 넘지 않았다면) 클릭으로 간주
      if (!dragging) {
        setSelected(prev => (prev && prev.toString()) === data.id.toString() ? null : data.id);
      } else if (mapRef.current && kakaoMap) {
        // 실제 드래그가 발생한 경우 드롭 로직 수행
        const rect = mapRef.current.getBoundingClientRect();
        const isOverMap = touch.clientX >= rect.left && touch.clientX <= rect.right
          && touch.clientY >= rect.top && touch.clientY <= rect.bottom;

        if (isOverMap) {
          try {
            const adjustedX = touch.clientX - dragOffsetRef.current.x - rect.left;
            const adjustedY = touch.clientY - dragOffsetRef.current.y - rect.top;
            const point = new window.kakao.maps.Point(adjustedX, adjustedY);
            const latlng = kakaoMap.getProjection().coordsFromContainerPoint(point);
            if (latlng) {
              const lat = latlng.getLat(), lng = latlng.getLng();
              if (!isNaN(lat) && !isNaN(lng)) {
                setDeployed(prev => ({ ...prev, [data.id]: { ...(prev[data.id] || data), lat, lng, itemType: data.itemType } }));
                await saveDeployment(data.id, data.itemType, lat, lng);
                addLog(`${data.name} ${data.isMoving ? "위치 이동" : "현장 배치"}`, data.isMoving ? "move" : "deploy");
              }
            }
          } catch (err) { console.error(err); }
        }
      }

      dragPayloadRef.current = null;
      dragStartPosRef.current = null;
      dragOffsetRef.current = { x: 0, y: 0 };
      setDragging(null);
      setDragPos(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [kakaoMap, dragging, hoseDragSource, deployed]);

  // 화점(Accident Point) 마커 및 반경 표시관리
  useEffect(() => {
    if (!kakaoMap || !accidentPos || !window.kakao || !window.kakao.maps) return;

    // 좌표 유효성 정밀 체크 (브라우저 블랙아웃 방지)
    if (isNaN(accidentPos.lat) || isNaN(accidentPos.lng)) {
      console.error("Invalid accidentPos coordinates:", accidentPos);
      return;
    }

    try {
      const pos = new window.kakao.maps.LatLng(accidentPos.lat, accidentPos.lng);

      // 화점 마커 (불꽃)
      if (!fireMarkerRef.current) {
        const marker = new window.kakao.maps.Marker({
          position: pos,
          draggable: !isAccidentLocked,
          image: new window.kakao.maps.MarkerImage(
            'https://cdn-icons-png.flaticon.com/512/785/785116.png', // 불꽃 아이콘
            new window.kakao.maps.Size(45, 45),
            { offset: new window.kakao.maps.Point(22, 45) }
          )
        });

        window.kakao.maps.event.addListener(marker, 'dragend', () => {
          const latlng = marker.getPosition();
          const nextPos = { lat: latlng.getLat(), lng: latlng.getLng() };
          if (!isNaN(nextPos.lat) && !isNaN(nextPos.lng)) {
            setAccidentPos(nextPos);
          }
        });

        marker.setMap(kakaoMap);
        fireMarkerRef.current = marker;
      } else {
        fireMarkerRef.current.setPosition(pos);
        fireMarkerRef.current.setDraggable(!isAccidentLocked);
        fireMarkerRef.current.setMap(kakaoMap); // 맵 인스턴스 동기화
      }

      // 진압 반경 (Suppression Circle)
      if (!suppressionCircleRef.current) {
        const circle = new window.kakao.maps.Circle({
          center: pos,
          radius: 100,
          strokeWeight: 2,
          strokeColor: '#ff4500',
          strokeOpacity: 0.8,
          strokeStyle: 'dashed',
          fillColor: '#ff4500',
          fillOpacity: 0.15
        });
        suppressionCircleRef.current = circle;
      }
      suppressionCircleRef.current.setCenter(pos);
      suppressionCircleRef.current.setMap(isAccidentLocked ? null : kakaoMap);

      // 주소 변환 (Geocoder)
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(accidentPos.lng, accidentPos.lat, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const addr = result[0].road_address ? result[0].road_address.address_name : result[0].address.address_name;
          setAccidentAddress(addr);
        } else {
          // 주소를 찾을 수 없는 지역(산, 바다 등)일 경우 좌표라도 표시
          setAccidentAddress(`주소 미확인지 지역 (${accidentPos.lat.toFixed(4)}, ${accidentPos.lng.toFixed(4)})`);
          console.warn("Geocoder failed for:", accidentPos, "Status:", status);
        }
      });
    } catch (err) {
      console.error("Fire marker sync error:", err);
      setAccidentAddress("시스템 오류 (주소 변환 실패)");
    }

  }, [kakaoMap, accidentPos, isAccidentLocked]);

  const moveToMyLocation = () => {
    if (!navigator.geolocation) return alert("GPS를 지원하지 않는 브라우저입니다.");
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setAccidentPos({ lat: latitude, lng: longitude });
      kakaoMap.panTo(new window.kakao.maps.LatLng(latitude, longitude));
      addLog("현재 위치로 사고 지점 이동 (GPS)", "info");
    });
  };

  const handleSaveLogs = () => {
    if (logs.length === 0) return alert("저장할 기록이 없습니다.");
    try {
      const csvRows = ["\uFEFF시간,유형,내용"];
      logs.forEach(log => {
        const cleanText = log.text.replace(/"/g, '""');
        csvRows.push(`${log.timestamp},${log.type},"${cleanText}"`);
      });
      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `현장활동기록_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 100);
    } catch (err) {
      alert("저장 중 오류가 발생했습니다: " + err.message);
    }
  };

  const handleResetLogs = async () => {
    const { error } = await supabase.from("situation_logs").delete().not("id", "is", null);
    if (error) alert("초기화 실패: " + error.message);
    else setLogs([]);
    setShowResetConfirm(false);
  };

  const removeDeployment = async (itemId) => {
    await supabase.from("deployments").delete().eq("item_id", itemId);
  };

  // 수관(Hose) Polyline 렌더링 엔진
  useEffect(() => {
    if (!kakaoMap || !window.kakao) return;

    // 기존 수관 제거
    hoseLinesRef.current.forEach(line => line.setMap(null));
    hoseLinesRef.current = [];

    // 1. 확정된 수관들 렌더링
    hoseLinks.forEach(link => {
      const from = deployed[link.fromId];
      const to = deployed[link.toId];
      if (from && to) {
        const line = new window.kakao.maps.Polyline({
          path: [
            new window.kakao.maps.LatLng(from.lat, from.lng),
            new window.kakao.maps.LatLng(to.lat, to.lng)
          ],
          strokeWeight: 4,
          strokeColor: '#007bff',
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          zIndex: 50 // 마커(1000)보다는 낮게, 지도보다는 높게
        });
        line.setMap(kakaoMap);
        hoseLinesRef.current.push(line);
      }
    });

    // 2. 드래그 중인 수관 프리뷰 렌더링
    if (hoseDragSource && dragPos && deployed[hoseDragSource] && mapRef.current) {
      const from = deployed[hoseDragSource];
      const rect = mapRef.current.getBoundingClientRect();
      const point = new window.kakao.maps.Point(dragPos.x - rect.left, dragPos.y - rect.top);
      const latlng = kakaoMap.getProjection().coordsFromContainerPoint(point);

      if (latlng) {
        const previewLine = new window.kakao.maps.Polyline({
          path: [
            new window.kakao.maps.LatLng(from.lat, from.lng),
            latlng
          ],
          strokeWeight: 3,
          strokeColor: '#007bff',
          strokeOpacity: 0.6,
          strokeStyle: 'dashed',
          zIndex: 51
        });
        previewLine.setMap(kakaoMap);
        hoseLinesRef.current.push(previewLine);
      }
    }
  }, [kakaoMap, hoseLinks, deployed, hoseDragSource, dragPos]);

  const deployedIds = new Set(Object.keys(deployed));

  const handleDragStart = useCallback((e, item, type) => {
    try {
      const payload = { ...item, itemType: type };
      e.dataTransfer.effectAllowed = "move";
      // 브라우저 호환성을 위해 더미 텍스트만 넣고 실제 데이터는 Ref로 관리합니다.
      e.dataTransfer.setData("text/plain", "dummy");
      dragPayloadRef.current = payload;
      setDragging(payload);
    } catch (err) {
      addLog(`DragStart 에러: ${err.message}`, "error");
    }
  }, []);

  const handleMapDrop = useCallback(async (e) => {
    e.preventDefault();
    if (!mapRef.current || !kakaoMap) return;

    // React 상태나 브라우저의 dataTransfer에 의존하지 않고 Ref에서 직접 데이터를 꺼냅니다.
    const data = dragPayloadRef.current;

    if (!data) {
      addLog(`Drop 실패: 전달된 데이터가 없습니다.`, "error");
      return;
    }

    try {
      const rect = mapRef.current.getBoundingClientRect();
      const point = new window.kakao.maps.Point(e.clientX - rect.left, e.clientY - rect.top);
      const projection = kakaoMap.getProjection();
      const latlng = projection.coordsFromContainerPoint(point);

      if (!latlng) {
        addLog(`Drop 실패: 좌표 변환 불가`, "error");
        return;
      }

      const lat = latlng.getLat();
      const lng = latlng.getLng();

      if (isNaN(lat) || isNaN(lng)) return;

      setDeployed(prev => ({ ...prev, [data.id]: { ...data, lat, lng } }));
      await saveDeployment(data.id, data.itemType, lat, lng);
      addLog(`${data.name} 배치됨`, "deploy");
    } catch (err) {
      console.error("Drop error:", err);
    } finally {
      setDragging(null);
    }
  }, [dragging, kakaoMap]);

  const confirmRecall = async () => {
    if (!showConfirm) return;
    setDeployed(prev => { const next = { ...prev }; delete next[showConfirm.id]; return next; });
    await removeDeployment(showConfirm.id);
    addLog(`${showConfirm.name} 철수 완료`, "recall");
    setShowConfirm(null);
    setSelected(null);
  };

  const center = (id) => centers.find(c => c.id === id);
  const personnelDeployedCount = Object.values(deployed).filter(d => d.itemType === "personnel").length;
  const vehicleDeployedCount = Object.values(deployed).filter(d => d.itemType === "vehicle").length;

  return (
    <div style={{ width: "100%", height: "100vh", background: "#060d18", display: "flex", flexDirection: "column", fontFamily: "'Pretendard', sans-serif", color: "#e8eef5", overflow: "hidden" }}>
      <div style={{ height: 60, background: "linear-gradient(90deg, #0e1925, #091420)", borderBottom: "1px solid #1e3a52", display: "flex", alignItems: "center", padding: "0 24px", gap: 24, flexShrink: 0, boxShadow: "0 4px 20px #000000aa", zIndex: 100 }}>
        <div
          onClick={() => setShowGlobalResetInit(true)}
          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 8, transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#ffffff08"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ fontSize: 32, filter: "drop-shadow(0 0 10px #ff450088)" }}>🔥</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "#ff6030" }}>FIRE COMMAND</div>
            <div style={{ fontSize: 10, color: "#4a7a9b", letterSpacing: 1, fontWeight: 500 }}>TABLET DISPATCHER PRO</div>
          </div>
        </div>
        <div style={{ background: "#ff450015", border: "1px solid #ff450040", borderRadius: 8, padding: "6px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff4500", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 14, color: "#ff7050", fontWeight: 600 }}>LIVE</span>
          <span style={{ fontSize: 13, color: "#a0c4d8", marginLeft: 4 }}>{selectedDistrict?.name || "알 수 없는 지역"} 화재 출동</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 24, alignItems: "center" }}>
          <button onClick={onManage} style={{ background: "linear-gradient(135deg, #1e3a52, #112233)", border: "1px solid #2a6a8a", borderRadius: 8, color: "#7ec8e3", padding: "10px 20px", cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><span>⚙</span> 설정</button>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#7ec8e3", fontVariantNumeric: "tabular-nums", letterSpacing: 2 }}>{time}</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: 300, background: "#0a1420", borderRight: "1px solid #1e3a52", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#7ec8e3", letterSpacing: 1 }}>🏢 현장 투입 조직</div>
            <div style={{ fontSize: 12, color: "#4a7a9b", fontWeight: 500 }}>
              차량: <span style={{ color: "#60a5fa" }}>{vehicleDeployedCount}대</span>, 대원: <span style={{ color: "#4ade80" }}>{personnelDeployedCount}명</span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {sortedCenters.map(c => {
              const pCount = Object.values(deployed).filter(d => d.itemType === "personnel" && d.center_id === c.id).length;
              const vCount = Object.values(deployed).filter(d => d.itemType === "vehicle" && d.center_id === c.id).length;
              if (pCount === 0 && vCount === 0) return null;
              return (
                <div key={c.id} style={{ marginBottom: 16, background: "#0d1f30", border: `1px solid ${c.color}44`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: `${c.color}15`, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.name} {selectedDistrict?.jurisdictional === c.name && " [관할]"}</div>
                  </div>
                  <div style={{ padding: "10px 14px", display: "flex", gap: 12 }}>
                    <div><div style={{ fontSize: 10, color: "#4a7a9b" }}>차량</div><div style={{ fontSize: 16, fontWeight: 600 }}>{vCount}대</div></div>
                    <div><div style={{ fontSize: 10, color: "#4a7a9b" }}>대원</div><div style={{ fontSize: 16, fontWeight: 600 }}>{pCount}명</div></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "16px 20px", borderTop: "1px solid #1e3a52", background: "#0e1925", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ff6030" }}>📜 활동 기록</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowResetConfirm(true)} style={{ background: "#3a1a1a", border: "1px solid #ff450066", borderRadius: 4, color: "#ff7050", padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>초기화</button>
              <button onClick={handleSaveLogs} style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 4, color: "#7ec8e3", padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>저장</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", background: "#060d18", padding: "8px 0" }}>
            {logs.map(log => (
              <div key={log.id} style={{ padding: "8px 16px", borderBottom: "1px solid #1e3a5222", fontSize: 11 }}>
                <span style={{ color: "#4a7a9b", marginRight: 8 }}>{log.timestamp}</span>
                <span style={{ color: log.type === "recall" ? "#ff7050" : "#7ec8e3" }}>{log.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div ref={mapRef} style={{ flex: 1, position: "relative", background: "#060d18" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {selectedDistrict && <KakaoMap key={selectedDistrict.name} center={selectedDistrict.center} onMapReady={setKakaoMap} />}
          </div>

          {/* 사고 지점 정보 및 컨트롤 바 */}
          {accidentPos && (
            <div style={{ position: "absolute", top: 20, left: 20, right: 20, zIndex: 1000, display: "flex", gap: 10, pointerEvents: "none" }}>
              <div style={{
                flex: 1, background: "rgba(14, 25, 37, 0.95)", border: "1px solid #ff4500", borderRadius: 12, padding: "12px 20px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: 12, pointerEvents: "auto", backdropFilter: "blur(4px)"
              }}>
                <div style={{ fontSize: 24, animation: isAccidentLocked ? "none" : "pulse 1.5s infinite" }}>🔥</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#ff6030", fontWeight: 700, letterSpacing: 1 }}>CURRENT FIRE LOCATION</div>
                  <div style={{ fontSize: 15, fontWeight: 200, color: "#fff" }}>
                    {accidentAddress || "좌표 확인 중..."}
                  </div>
                </div>
                <button
                  onClick={() => setIsAccidentLocked(!isAccidentLocked)}
                  style={{
                    background: isAccidentLocked ? "#ff4500" : "transparent",
                    border: "1px solid #ff4500", borderRadius: 8, color: isAccidentLocked ? "#fff" : "#ff4500",
                    padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "0.2s"
                  }}
                >
                  {isAccidentLocked ? "🔓 위치 고정 해제" : "🔒 화재 지점 확정"}
                </button>
                <button
                  onClick={moveToMyLocation}
                  style={{
                    background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 8, color: "#7ec8e3",
                    padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer"
                  }}
                >
                  📍 내 위치로 (GPS)
                </button>
              </div>
            </div>
          )}

          {dragging && dragPos && mapRef.current && (() => {
            const rect = mapRef.current.getBoundingClientRect();
            const isOver = dragPos.x >= rect.left && dragPos.x <= rect.right && dragPos.y >= rect.top && dragPos.y <= rect.bottom;
            return isOver ? (
              <div style={{
                position: "fixed",
                left: dragPos.x - dragOffsetRef.current.x,
                top: dragPos.y - dragOffsetRef.current.y,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none", zIndex: 9999,
                background: dragging.itemType === "vehicle" ? "#1e2a3a" : "#2a1a1a",
                border: "2px dashed #ff4500",
                borderRadius: dragging.itemType === "vehicle" ? 8 : "50%",
                padding: "6px 10px", display: "flex", gap: 6, alignItems: "center",
                boxShadow: "0 4px 20px rgba(255,69,0,0.6)", opacity: 0.9
              }}>
                <span style={{ fontSize: 16 }}>{dragging.itemType === "vehicle" ? VEHICLE_ICONS[dragging.type] : "👤"}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{dragging.name}</span>
              </div>
            ) : null;
          })()}
        </div>
        <div style={{ width: 340, background: "#080f1a", borderLeft: "1px solid #1e3a52", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", background: "#0e1925" }}>
            {[{ k: "vehicle", l: "🚒 차량" }, { k: "personnel", l: "👤 대원" }].map(t => (
              <button key={t.k} onClick={() => setSideTab(t.k)} style={{ flex: 1, padding: "20px 0", background: activeTab === t.k ? "#1a3a52" : "transparent", border: "none", borderBottom: `2px solid ${activeTab === t.k ? "#ff4500" : "transparent"}`, color: activeTab === t.k ? "#fff" : "#4a7a9b", fontSize: 18, fontWeight: 700 }}>{t.l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {sortedCenters.map(c => {
              const list = (activeTab === "personnel" ? personnel : vehicles).filter(x => x.center_id === c.id && !deployedIds.has(x.id));
              if (!list.length) return null;
              const isExpanded = expandedCenters[c.id];
              return (
                <div key={c.id} style={{ marginBottom: 16 }}>
                  <div onClick={() => setExpandedCenters(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                    style={{ fontSize: 14, color: c.color, fontWeight: 700, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "4px 0" }}>
                    <span>{c.name}</span>
                    <span style={{ fontSize: 10 }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                  {isExpanded && list.map(x => (
                    <div key={x.id}
                      onMouseDown={e => {
                        e.preventDefault();
                        dragOffsetRef.current = { x: 0, y: 0 }; // 새 배치는 오프셋 없음
                        dragPayloadRef.current = { ...x, itemType: activeTab };
                        setDragging({ ...x, itemType: activeTab });
                        setDragPos({ x: e.clientX, y: e.clientY });
                      }}
                      style={{ background: "#112233", border: "1px solid #1e3a52", borderRadius: 8, padding: "8px 12px", marginBottom: 6, cursor: "grab", display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
                      <span style={{ fontSize: 20 }}>{activeTab === "personnel" ? "👤" : VEHICLE_ICONS[x.type]}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{x.name}</span>
                        <span style={{ fontSize: 11, color: "#4a7a9b", marginLeft: "auto" }}>{activeTab === "personnel" ? x.role : VEHICLE_LABELS[x.type]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
        @keyframes pulseEmergency { 0%, 100% { box-shadow: 0 0 10px #ef4444; border-color: #ef4444; } 50% { box-shadow: 0 0 30px #ef4444; border-color: #ff8080; } }
      `}</style>
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => setShowConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1e2e", border: "1px solid #ff4500aa", borderRadius: 12, padding: "24px 28px", minWidth: 260, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>{showConfirm.name} 철수하시겠습니까?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(null)} style={{ flex: 1, padding: "8px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#fff" }}>취소</button>
              <button onClick={confirmRecall} style={{ flex: 1, padding: "8px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 6, color: "#ff7050" }}>확인</button>
            </div>
          </div>
        </div>
      )}
      {showResetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => setShowResetConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1e2e", border: "1px solid #ff4500aa", borderRadius: 12, padding: "24px 28px", minWidth: 260, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>기록을 초기화하시겠습니까?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: "8px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 6, color: "#fff" }}>취소</button>
              <button onClick={handleResetLogs} style={{ flex: 1, padding: "8px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 6, color: "#ff7050" }}>초기화</button>
            </div>
          </div>
        </div>
      )}
      {showGlobalResetInit && (
        <div style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, backdropFilter: "blur(8px)" }} onClick={() => setShowGlobalResetInit(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0e1e2e", border: "2px solid #ff4500", borderRadius: 16, padding: "32px", maxWidth: 320, width: "90%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>시작 화면으로 돌아갈까요?</div>
            <div style={{ fontSize: 13, color: "#a0c4d8", lineHeight: 1.6, marginBottom: 24 }}>현재 진행 중인 모든 배치 정보와<br />활동 기록이 삭제되고 초기화됩니다.</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowGlobalResetInit(false)} style={{ flex: 1, padding: "12px 0", background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer" }}>취소</button>
              <button onClick={() => { onGlobalReset(); setShowGlobalResetInit(false); }} style={{ flex: 1, padding: "12px 0", background: "#3a1a1a", border: "1px solid #ff4500", borderRadius: 8, color: "#ff7050", fontWeight: 700, cursor: "pointer" }}>전체 초기화</button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

export default function App() {
  const [centers, setCenters] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("command");
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  // 리프팅된 전술 상태
  const [deployed, setDeployed] = useState({});
  const [logs, setLogs] = useState([]);
  const [accidentPos, setAccidentPos] = useState(null);
  const [accidentAddress, setAccidentAddress] = useState("");
  const [isAccidentLocked, setIsAccidentLocked] = useState(false);
  const [hoseLinks, setHoseLinks] = useState([]);
  const [time, setTime] = useState("");

  // 추가로 리프팅된 UI 유지 상태
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("vehicle");
  const [expandedCenters, setExpandedCenters] = useState({});

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      const { data: c } = await supabase.from("centers").select("*");
      const { data: p } = await supabase.from("personnel").select("*");
      const { data: v } = await supabase.from("vehicles").select("*");
      if (c) setCenters(c);
      if (p) setPersonnel(p);
      if (v) setVehicles(v);

      if (p && v) {
        const { data: deployData } = await supabase.from("deployments").select("*");
        if (deployData) {
          const map = {};
          deployData.forEach(d => {
            const item = d.item_type === "personnel"
              ? p.find(px => px.id === d.item_id)
              : v.find(vx => vx.id === d.item_id);
            if (item) map[d.item_id] = { ...item, itemType: d.item_type, lat: d.lat, lng: d.lng };
          });
          setDeployed(map);
        }
      }

      const { data: logData } = await supabase.from("situation_logs").select("*").order("created_at", { ascending: false }).limit(50);
      if (logData) setLogs(logData);

      setLoading(false);
    };
    fetch();

    const logSub = supabase.channel("app-logs-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "situation_logs" }, payload => {
        setLogs(prev => {
          if (prev.some(l => l.id === payload.new.id)) return prev;
          return [payload.new, ...prev].slice(0, 50);
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "situation_logs" }, () => setLogs([]))
      .subscribe();

    // 브라우저 새로고침 시 경고 (실수 방지)
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      supabase.removeChannel(logSub);
    };
  }, []);

  const handleGlobalReset = async () => {
    setLoading(true);
    try {
      await supabase.from("situation_logs").delete().not("id", "is", null);
      await supabase.from("deployments").delete().not("item_id", "is", null);

      // 상위 상태 초기화
      setSelectedDistrict(null);
      setDeployed({});
      setLogs([]);
      setAccidentPos(null);
      setAccidentAddress("");
      setIsAccidentLocked(false);
      setHoseLinks([]);
      setSelected(null);
      setActiveTab("vehicle");
      setExpandedCenters({});
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setLoading(false);
    }
  };

  const addLog = useCallback(async (text, type = "info") => {
    const timestamp = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const newLog = { timestamp, text, type };
    await supabase.from("situation_logs").insert([newLog]);
  }, []);

  if (loading) return <LoadingScreen />;

  const centersWithCoords = centers.map(c => {
    const districtMatch = DISTRICTS.find(d => d.jurisdictional === c.name);
    return {
      ...c,
      lat: districtMatch?.center.lat || 35.2312,
      lng: districtMatch?.center.lng || 128.8924
    };
  });

  return (
    <>
      {!selectedDistrict && <DistrictSelector onSelect={setSelectedDistrict} />}
      {view === "command" ? (
        <CommandScreen
          centers={centersWithCoords}
          personnel={personnel}
          vehicles={vehicles}
          selectedDistrict={selectedDistrict}
          onManage={() => setView("manage")}
          onGlobalReset={handleGlobalReset}
          // 리프팅된 상태 전달
          deployed={deployed} setDeployed={setDeployed}
          logs={logs} setLogs={setLogs}
          accidentPos={accidentPos} setAccidentPos={setAccidentPos}
          accidentAddress={accidentAddress} setAccidentAddress={setAccidentAddress}
          isAccidentLocked={isAccidentLocked} setIsAccidentLocked={setIsAccidentLocked}
          hoseLinks={hoseLinks} setHoseLinks={setHoseLinks}
          time={time}
          addLog={addLog}
          selected={selected} setSelected={setSelected}
          activeTab={activeTab} setSideTab={setActiveTab}
          expandedCenters={expandedCenters} setExpandedCenters={setExpandedCenters}
        />
      ) : (
        <ManageScreen centers={centers} setCenters={setCenters} personnel={personnel} setPersonnel={setPersonnel} vehicles={vehicles} setVehicles={setVehicles} onBack={() => setView("command")} />
      )}
    </>
  );
}
