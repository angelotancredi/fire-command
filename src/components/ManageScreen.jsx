import { useState } from "react";
import { supabase } from "../lib/supabase";
import { VEHICLE_ICONS, VEHICLE_LABELS, ROLES, UI_CONFIG } from "../constants";

export default function ManageScreen({ centers, setCenters, personnel, setPersonnel, vehicles, setVehicles, onBack, isLight = false, setIsLight = () => {}, initialTab = "centers" }) {
  const [tab, setTab] = useState(initialTab || "centers");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cForm, setCForm] = useState({ name: "", color: "#FF4500" });
  const [pForm, setPForm] = useState({ name: "", role: "경방", center_id: "", vehicle_id: "" });
  const [vForm, setVForm] = useState({ name: "", type: "pump", center_id: "", water_capacity: 3000 });
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingPersonnel, setEditingPersonnel] = useState(null);

  const [targets, setTargets] = useState([]);
  const [tForm, setTForm] = useState({ name: "", address: "", lat: null, lng: null, center_id: "", info: { characteristics: "", vulnerabilities: "" } });
  const [editingTarget, setEditingTarget] = useState(null);

  const fetchTargets = async () => {
    const { data } = await supabase.from("target_objects").select("*").order("name");
    if (data) setTargets(data);
  };

  useState(() => {
    fetchTargets();
  }, []);

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

  const moveCenter = async (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === centers.length - 1) return;
    const current = centers[index];
    const target = centers[index + direction];
    const tempCreatedAt = current.created_at;
    const targetCreatedAt = target.created_at;
    setCenters(prev => {
      const next = [...prev];
      next[index] = { ...current, created_at: targetCreatedAt };
      next[index + direction] = { ...target, created_at: tempCreatedAt };
      return next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
    await Promise.all([
      supabase.from("centers").update({ created_at: targetCreatedAt }).eq("id", current.id),
      supabase.from("centers").update({ created_at: tempCreatedAt }).eq("id", target.id)
    ]);
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
  
  const startEditPersonnel = (p) => {
    setEditingPersonnel(p);
    setPForm({ name: p.name, role: p.role, center_id: p.center_id, vehicle_id: p.vehicle_id || "" });
  };

  const cancelEditPersonnel = () => {
    setEditingPersonnel(null);
    setPForm({ name: "", role: "경방", center_id: pForm.center_id, vehicle_id: "" });
  };

  const updatePersonnel = async () => {
    if (!pForm.name.trim()) return showMsg("이름을 입력하세요", false);
    if (!pForm.center_id) return showMsg("소속 센터를 선택하세요", false);
    setLoading(true);
    const payload = { ...pForm, vehicle_id: pForm.vehicle_id || null };
    const { error } = await supabase.from("personnel").update(payload).eq("id", editingPersonnel.id);
    setLoading(false);
    if (error) return showMsg("오류: " + error.message, false);
    setPersonnel(prev => prev.map(p => p.id === editingPersonnel.id ? { ...p, ...payload } : p));
    setEditingPersonnel(null);
    setPForm({ name: "", role: "경방", center_id: pForm.center_id, vehicle_id: "" });
    showMsg("대원 정보가 수정되었어요");
  };

  const deletePersonnel = async (id) => {
    const { error } = await supabase.from("personnel").delete().eq("id", id);
    if (error) return showMsg("오류: " + error.message, false);
    setPersonnel(prev => prev.filter(p => p.id !== id));
    showMsg("삭제됐어요");
  };

  const movePersonnel = async (index, direction, mList) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === mList.length - 1) return;
    const current = mList[index];
    const target = mList[index + direction];
    const tempCreatedAt = current.created_at;
    const targetCreatedAt = target.created_at;
    setPersonnel(prev => {
      const next = [...prev];
      const curIdx = next.findIndex(p => p.id === current.id);
      const tgtIdx = next.findIndex(p => p.id === target.id);
      next[curIdx] = { ...current, created_at: targetCreatedAt };
      next[tgtIdx] = { ...target, created_at: tempCreatedAt };
      return next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
    await Promise.all([
      supabase.from("personnel").update({ created_at: targetCreatedAt }).eq("id", current.id),
      supabase.from("personnel").update({ created_at: tempCreatedAt }).eq("id", target.id)
    ]);
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
    setVForm({ name: "", type: "pump", center_id: vForm.center_id, water_capacity: 3000 });
    showMsg("차량이 추가됐어요");
  };

  const startEditVehicle = (v) => {
    setEditingVehicle(v);
    setVForm({ name: v.name, type: v.type, center_id: v.center_id, water_capacity: v.water_capacity });
  };

  const cancelEditVehicle = () => {
    setEditingVehicle(null);
    setVForm({ name: "", type: "pump", center_id: vForm.center_id, water_capacity: 3000 });
  };

  const updateVehicle = async () => {
    if (!vForm.name.trim()) return showMsg("차량명을 입력하세요", false);
    if (!vForm.center_id) return showMsg("소속 센터를 선택하세요", false);
    setLoading(true);
    const { error } = await supabase.from("vehicles").update({ ...vForm }).eq("id", editingVehicle.id);
    setLoading(false);
    if (error) return showMsg("오류: " + error.message, false);
    setVehicles(prev => prev.map(v => v.id === editingVehicle.id ? { ...v, ...vForm } : v));
    setEditingVehicle(null);
    setVForm({ name: "", type: "pump", center_id: vForm.center_id, water_capacity: 3000 });
    showMsg("차량 정보가 수정되었어요");
  };

  const deleteVehicle = async (id) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return showMsg("오류: " + error.message, false);
    setVehicles(prev => prev.filter(v => v.id !== id));
    showMsg("삭제됐어요");
  };

  const moveVehicle = async (index, direction, vList) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === vList.length - 1) return;
    const current = vList[index];
    const target = vList[index + direction];
    const tempCreatedAt = current.created_at;
    const targetCreatedAt = target.created_at;
    setVehicles(prev => {
      const next = [...prev];
      const curIdx = next.findIndex(v => v.id === current.id);
      const tgtIdx = next.findIndex(v => v.id === target.id);
      next[curIdx] = { ...current, created_at: targetCreatedAt };
      next[tgtIdx] = { ...target, created_at: tempCreatedAt };
      return next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
    await Promise.all([
      supabase.from("vehicles").update({ created_at: targetCreatedAt }).eq("id", current.id),
      supabase.from("vehicles").update({ created_at: tempCreatedAt }).eq("id", target.id)
    ]);
  };

  const addTarget = async () => {
    if (!tForm.name.trim()) return showMsg("대상물 이름을 입력하세요", false);
    setLoading(true);
    const { data: inserted, error } = await supabase.from("target_objects").insert([{
      name: tForm.name,
      address: tForm.address,
      lat: tForm.lat,
      lng: tForm.lng,
      center_id: tForm.center_id || null,
      info: tForm.info
    }]).select().single();
    if (error) {
      setLoading(false);
      return showMsg("오류: " + error.message, false);
    }
    await fetchTargets();
    setLoading(false);
    setTForm({ name: "", address: "", lat: null, lng: null, center_id: "", info: { characteristics: "", vulnerabilities: "" } });
    showMsg("대상물이 추가됐어요");
  };

  const updateTarget = async () => {
    if (!tForm.name.trim()) return showMsg("대상물 이름을 입력하세요", false);
    setLoading(true);
    const { error } = await supabase.from("target_objects").update({ 
      name: tForm.name, 
      address: tForm.address, 
      lat: tForm.lat,
      lng: tForm.lng,
      center_id: tForm.center_id || null,
      info: tForm.info 
    }).eq("id", editingTarget.id);
    setLoading(false);
    if (error) return showMsg("오류: " + error.message, false);
    setTargets(prev => prev.map(t => t.id === editingTarget.id ? { ...t, ...tForm } : t));
    await fetchTargets();
    setEditingTarget(null);
    setTForm({ name: "", address: "", lat: null, lng: null, center_id: "", info: { characteristics: "", vulnerabilities: "" } });
    showMsg("대상물 정보가 수정되었어요");
  };

  const deleteTarget = async (id, name) => {
    if (!window.confirm(`대상물 "${name}"을(를) 삭제하시겠습니까?\n모든 관련 전술 스냅샷도 함께 삭제됩니다.`)) return;
    setLoading(true);
    await supabase.from("tactical_snapshots").delete().eq("target_id", id);
    const { error } = await supabase.from("target_objects").delete().eq("id", id);
    setLoading(false);
    if (error) return showMsg("오류: " + error.message, false);
    setTargets(prev => prev.filter(t => t.id !== id));
    showMsg("삭제됐어요");
  };

  const startEditTarget = (t) => {
    setEditingTarget(t);
    setTForm({ name: t.name, address: t.address, lat: t.lat, lng: t.lng, center_id: t.center_id || "", info: t.info || { characteristics: "", vulnerabilities: "" } });
  };

  const searchAddress = () => {
    if (!tForm.address.trim()) return showMsg("주소를 입력하세요", false);
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return showMsg("지도 서비스를 불러오는 중입니다", false);
    setLoading(true);
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(tForm.address, (result, status) => {
      setLoading(false);
      if (status === window.kakao.maps.services.Status.OK) {
        setTForm(prev => ({ ...prev, lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) }));
        showMsg("좌표를 확인했습니다 (Geocoding 완료)");
      } else {
        showMsg("주소를 찾을 수 없습니다", false);
      }
    });
  };

  const inp = { background: "#0d1f30", border: "1px solid #1e3a52", borderRadius: 6, color: "#e8eef5", padding: "8px 12px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "'Pretendard', sans-serif" };
  const btnAdd = { background: "linear-gradient(135deg, #ff4500, #ff6030)", border: "none", borderRadius: 6, color: "#fff", padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 };
  const btnDel = { background: "transparent", border: "1px solid #ff450066", borderRadius: 4, color: "#ff7050", padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 500 };

  return (
    <div style={{ width: "100%", height: "100vh", background: isLight ? "#f0f4f8" : "#060d18", display: "flex", flexDirection: "column", fontFamily: "'Pretendard', sans-serif", color: isLight ? "#1a2a3a" : "#e8eef5", filter: isLight ? "invert(1) hue-rotate(180deg)" : "none" }}>
      <div style={{ height: 60, background: "#0e1925", borderBottom: "1px solid #1e3a52", display: "flex", alignItems: "center", padding: "0 20px", gap: 16, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "#1a3a52", border: "1px solid #2a6a8a", borderRadius: 8, color: "#7ec8e3", padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← 지휘 화면으로</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>데이터 관리 센터 (v2.1)</div>
        {msg && <div style={{ background: msg.ok ? "#1a3a1a" : "#3a1a1a", border: `1px solid ${msg.ok ? "#2d6a2d" : "#ff4500"}`, borderRadius: 8, padding: "6px 14px", color: msg.ok ? "#4ade80" : "#ff7050", fontSize: 13, fontWeight: 600 }}>{msg.text}</div>}
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 좌측 사이드바 메뉴 */}
        <div style={{ width: 220, background: "#080f1a", borderRight: "1px solid #1e3a52", display: "flex", flexDirection: "column", padding: "20px 0" }}>
          {[
            { key: "centers", icon: "🏢", label: "센터 관리" },
            { key: "vehicles", icon: "🚒", label: "차량 관리" },
            { key: "personnel", icon: <img src="/icons/fireman.svg" alt="대원" style={{ width: 22, height: 22 }} />, label: "대원 관리" },
            { key: "targets", icon: "🏢", label: "진압전술관리" },
            { key: "settings", icon: "⚙️", label: "시스템 설정" }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                width: "100%",
                padding: "16px 24px",
                background: tab === t.key ? "linear-gradient(90deg, #1e3a52, transparent)" : "transparent",
                border: "none",
                borderLeft: `4px solid ${tab === t.key ? "#ff4500" : "transparent"}`,
                color: tab === t.key ? "#ff7050" : "#4a7a9b",
                fontSize: 18,
                fontWeight: 700,
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center"
              }}
            >
              <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 12, fontSize: 20 }}>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}

          {/* 하단 고정: 모드 변경 */}
          <div style={{ flex: 1 }} />
          <div style={{ borderTop: "1px solid #1e3a5244", paddingTop: 12 }}>
            <button
              onClick={() => setTab("theme")}
              style={{
                width: "100%", padding: "16px 24px",
                background: tab === "theme" ? "linear-gradient(90deg, #1e3a52, transparent)" : "transparent",
                border: "none",
                borderLeft: `4px solid ${tab === "theme" ? "#7ec8e3" : "transparent"}`,
                color: tab === "theme" ? "#7ec8e3" : "#4a7a9b",
                fontSize: 18, fontWeight: 700, textAlign: "left", cursor: "pointer",
                transition: "all 0.2s", display: "flex", alignItems: "center"
              }}
            >
              <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 12, fontSize: 20 }}>
                {isLight ? "☀️" : "🌙"}
              </span>
              모드 변경
            </button>
          </div>
        </div>

        {/* 우측 콘텐츠 영역 */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#060d18" }}>
          {tab === "centers" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 640, width: "100%", padding: 24, overflow: "hidden" }}>
              <div style={{ flexShrink: 0, marginBottom: 20, background: "#0d1f30", borderRadius: 10, padding: 20, border: "1px solid #1e3a52" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#7ec8e3", marginBottom: 14 }}>새 센터 추가</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input value={cForm.name} onChange={e => setCForm(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === "Enter" && addCenter()} placeholder={`센터 이름 (예: ${UI_CONFIG.exampleCenter})`} style={{ ...inp, flex: 1 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: "#4a7a9b" }}>색상</span>
                    <input type="color" value={cForm.color} onChange={e => setCForm(p => ({ ...p, color: e.target.value }))} style={{ width: 36, height: 36, border: "none", background: "none", cursor: "pointer" }} />
                  </div>
                  <button onClick={addCenter} disabled={loading} style={btnAdd}>추가</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                {centers.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0d1f2d", border: "1px solid #1e3a52", borderRadius: 8, padding: "12px 16px", marginBottom: 8 }}>
                    <input type="color" value={c.color} onChange={e => updateCenterColor(c.id, e.target.value)} style={{ width: 20, height: 20, border: "none", background: "none", cursor: "pointer", padding: 0, borderRadius: "50%", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{c.name.replace(UI_CONFIG.stationName + " ", "")}</span>
                    <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
                      <button onClick={() => moveCenter(i, -1)} disabled={i === 0} style={{ ...btnDel, padding: "4px 8px", opacity: i === 0 ? 0.3 : 1, border: "1px solid #4a7a9b" }}>▲</button>
                      <button onClick={() => moveCenter(i, 1)} disabled={i === centers.length - 1} style={{ ...btnDel, padding: "4px 8px", opacity: i === centers.length - 1 ? 0.3 : 1, border: "1px solid #4a7a9b" }}>▼</button>
                    </div>
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
                    {centers.map(c => <option key={c.id} value={c.id}>{c.name.replace(UI_CONFIG.stationName + " ", "")}</option>)}
                  </select>
                  <select value={vForm.type} onChange={e => {
                    const t = e.target.value;
                    const isWaterless = ["ambulance", "command", "investigation", "ladder", "rescue", "smoke", "bus"].includes(t);
                    setVForm(v => ({ ...v, type: t, water_capacity: isWaterless ? 0 : (v.water_capacity || 3000) }));
                  }} style={{ ...inp, width: 130 }}>
                    {Object.entries(VEHICLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <input value={vForm.name} onChange={e => setVForm(v => ({ ...v, name: e.target.value }))} placeholder={`차량명 (예: ${UI_CONFIG.exampleVehicle})`} style={{ ...inp, width: 220 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#4a7a9b", whiteSpace: "nowrap" }}>용수(L)</span>
                    <input type="number" value={vForm.water_capacity} onChange={e => setVForm(v => ({ ...v, water_capacity: parseInt(e.target.value) || 0 }))} style={{ ...inp, width: 80 }} />
                  </div>
                  {editingVehicle ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={updateVehicle} disabled={loading} style={{ ...btnAdd, background: "linear-gradient(135deg, #007bff, #0056b3)" }}>수정 완료</button>
                      <button onClick={cancelEditVehicle} style={{ ...btnDel, padding: "8px 14px" }}>취소</button>
                    </div>
                  ) : (
                    <button onClick={addVehicle} disabled={loading} style={btnAdd}>추가</button>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                {centers.map(c => {
                  const vlist = vehicles.filter(v => String(v.center_id) === String(c.id));
                  if (!vlist.length) return null;
                  return (
                    <div key={c.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#0d1f2d", borderRadius: "8px 8px 0 0", border: "1px solid #1e3a52", borderBottom: "none" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                        <span style={{ fontSize: 14, fontWeight: 500, color: c.color }}>{c.name.replace(UI_CONFIG.stationName + " ", "")}</span>
                      </div>
                      <div style={{ border: "1px solid #1e3a52", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                        {vlist.map((v, i) => (
                          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: i % 2 === 0 ? "#0a1828" : "#0d1f2d", borderBottom: i < vlist.length - 1 ? "1px solid #1e3a5244" : "none" }}>
                            <span style={{ fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                              {VEHICLE_ICONS[v.type]?.startsWith("/") ? (
                                <img src={VEHICLE_ICONS[v.type]} alt={v.type} style={{ width: "100%", height: "100%" }} />
                              ) : (
                                VEHICLE_ICONS[v.type]
                              )}
                            </span>
                            <span style={{ width: 110, fontSize: 13, fontWeight: 600 }}>{v.name}</span>
                            <span style={{ width: 80, fontSize: 11, color: "#4ade80" }}>{v.water_capacity > 0 ? `${v.water_capacity}L` : ""}</span>
                            <span style={{ flex: 1, fontSize: 11, color: "#7ec8e3" }}>{VEHICLE_LABELS[v.type]}</span>
                            <div style={{ display: "flex", gap: 6 }}>
                              <div style={{ display: "flex", gap: 4, marginRight: 4 }}>
                                <button onClick={() => moveVehicle(i, -1, vlist)} disabled={i === 0} style={{ ...btnDel, padding: "4px 8px", opacity: i === 0 ? 0.3 : 1, border: "1px solid #4a7a9b", color: "#4a7a9b" }}>▲</button>
                                <button onClick={() => moveVehicle(i, 1, vlist)} disabled={i === vlist.length - 1} style={{ ...btnDel, padding: "4px 8px", opacity: i === vlist.length - 1 ? 0.3 : 1, border: "1px solid #4a7a9b", color: "#4a7a9b" }}>▼</button>
                              </div>
                              <button onClick={() => startEditVehicle(v)} style={{ ...btnDel, color: "#7ec8e3", borderColor: "#7ec8e366" }}>수정</button>
                              <button onClick={() => deleteVehicle(v.id)} style={btnDel}>삭제</button>
                            </div>
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
                    {centers.map(c => <option key={c.id} value={c.id}>{c.name.replace(UI_CONFIG.stationName + " ", "")}</option>)}
                  </select>
                  <select value={pForm.vehicle_id} onChange={e => setPForm(p => ({ ...p, vehicle_id: e.target.value }))} style={{ ...inp, width: 150 }}>
                    <option value="">탑승 차량 선택</option>
                    {vehicles.filter(v => String(v.center_id) === String(pForm.center_id)).map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <select value={pForm.role} onChange={e => setPForm(p => ({ ...p, role: e.target.value }))} style={{ ...inp, width: 100 }}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
                  <input value={pForm.name} onChange={e => setPForm(p => ({ ...p, name: e.target.value }))} placeholder="이름" style={{ ...inp, width: 130 }} />
                  {editingPersonnel ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={updatePersonnel} disabled={loading} style={{ ...btnAdd, background: "linear-gradient(135deg, #007bff, #0056b3)" }}>수정 완료</button>
                      <button onClick={cancelEditPersonnel} style={{ ...btnDel, padding: "8px 14px" }}>취소</button>
                    </div>
                  ) : (
                    <button onClick={addPersonnel} disabled={loading} style={btnAdd}>추가</button>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                {centers.map(c => {
                  const mList = personnel.filter(p => String(p.center_id) === String(c.id));
                  if (!mList.length) return null;
                  return (
                    <div key={c.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#0d1f2d", borderRadius: "8px 8px 0 0", border: "1px solid #1e3a52", borderBottom: "none" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                        <span style={{ fontSize: 14, fontWeight: 500, color: c.color }}>{c.name.replace(UI_CONFIG.stationName + " ", "")}</span>
                      </div>
                      <div style={{ border: "1px solid #1e3a52", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                        {mList.map((p, i) => {
                          const v = vehicles.find(veh => String(veh.id) === String(p.vehicle_id));
                          return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: i % 2 === 0 ? "#0a1828" : "#0d1f2d", borderBottom: i < mList.length - 1 ? "1px solid #1e3a5244" : "none" }}>
                              <span style={{ fontSize: 18, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <img src="/icons/fireman.svg" alt="대원" style={{ width: "100%", height: "100%" }} />
                              </span>
                              <span style={{ width: 140, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</span>
                              <span style={{ width: 100, fontSize: 11, color: "#7ec8e3", whiteSpace: "nowrap" }}>{v ? v.name : "미배정"}</span>
                              <span style={{ flex: 1, fontSize: 11, color: "#4a7a9b" }}>{p.role}</span>
                              <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
                                <button onClick={() => movePersonnel(i, -1, mList)} disabled={i === 0} style={{ ...btnDel, padding: "4px 8px", opacity: i === 0 ? 0.3 : 1, border: "1px solid #4a7a9b" }}>▲</button>
                                <button onClick={() => movePersonnel(i, 1, mList)} disabled={i === mList.length - 1} style={{ ...btnDel, padding: "4px 8px", opacity: i === mList.length - 1 ? 0.3 : 1, border: "1px solid #4a7a9b" }}>▼</button>
                              </div>
                              <button onClick={() => startEditPersonnel(p)} style={{ ...btnDel, color: "#7ec8e3", borderColor: "#7ec8e366" }}>수정</button>
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
          {tab === "targets" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 800, width: "100%", padding: 24, overflow: "hidden" }}>
              <div style={{ flexShrink: 0, marginBottom: 20, background: "#0d1f30", borderRadius: 10, padding: 20, border: "1px solid #1e3a52" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#7ec8e3", marginBottom: 14 }}>{editingTarget ? "대상물 정보 수정" : "새 대상물 추가"}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input value={tForm.name} onChange={e => setTForm(p => ({ ...p, name: e.target.value }))} placeholder={`대상물 이름 (예: ${UI_CONFIG.exampleTarget})`} style={{ ...inp, flex: 1 }} />
                    <select value={tForm.center_id} onChange={e => setTForm(p => ({ ...p, center_id: e.target.value }))} style={{ ...inp, width: 140 }}>
                      <option value="">관할 센터 선택</option>
                      {centers.filter(c => !c.name.includes('구조대') && !c.name.includes('현장대응단')).map(c => <option key={c.id} value={c.id}>{c.name.replace(UI_CONFIG.stationName + " ", "")}</option>)}
                    </select>
                    <div style={{ flex: 1.5, display: "flex", gap: 6 }}>
                      <input value={tForm.address} onChange={e => setTForm(p => ({ ...p, address: e.target.value }))} placeholder="주소" style={inp} />
                      <button onClick={searchAddress} style={{ ...btnDel, color: "#7ec8e3", borderColor: "#7ec8e366", flexShrink: 0 }}>좌표 찾기</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ flex: 1, fontSize: 11, color: tForm.lat ? "#4ade80" : "#ff7050" }}>
                      {tForm.lat ? `📍 좌표가 설정되었습니다 (${tForm.lat.toFixed(4)}, ${tForm.lng.toFixed(4)})` : "⚠️ '좌표 찾기'를 눌러주세요"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <textarea 
                      value={tForm.info.characteristics} 
                      onChange={e => setTForm(p => ({ ...p, info: { ...p.info, characteristics: e.target.value } }))} 
                      placeholder="대상물 특성 (예: 샌드위치 패널, 7층 규모)" 
                      style={{ ...inp, height: 60, resize: "none", lineHeight: "1.6", padding: "10px 12px" }} 
                    />
                    <textarea 
                      value={tForm.info.vulnerabilities} 
                      onChange={e => setTForm(p => ({ ...p, info: { ...p.info, vulnerabilities: e.target.value } }))} 
                      placeholder="위험 요소 (예: 옥내저장소 위치, 소방차 진입로 확인)" 
                      style={{ ...inp, height: 60, resize: "none", lineHeight: "1.6", padding: "10px 12px" }} 
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    {editingTarget ? (
                      <>
                        <button onClick={updateTarget} disabled={loading} style={{ ...btnAdd, background: "linear-gradient(135deg, #007bff, #0056b3)" }}>수정 완료</button>
                        <button onClick={() => { setEditingTarget(null); setTForm({ name: "", address: "", info: { characteristics: "", vulnerabilities: "" } }); }} style={btnDel}>취소</button>
                      </>
                    ) : (
                      <button onClick={addTarget} disabled={loading} style={btnAdd}>대상물 등록</button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                {targets.map((t, i) => (
                    <div key={t.id} style={{ background: "#0d1f2d", border: "1px solid #1e3a52", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflow: "hidden" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: "#7ec8e3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220, marginLeft: 4 }}>{t.address}</div>
                          
                          {t.center_id && (() => {
                            const center = centers.find(c => c.id === t.center_id);
                            return center ? (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: center.color + "15", border: `1px solid ${center.color}44`, padding: "2px 8px", borderRadius: 4, marginLeft: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: center.color }} />
                                <span style={{ fontSize: 12, fontWeight: 300, color: center.color, letterSpacing: -0.5 }}>{center.name.replace(UI_CONFIG.stationName + " ", "")}</span>
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => startEditTarget(t)} style={{ ...btnDel, padding: "4px 10px", fontSize: 11, color: "#7ec8e3", borderColor: "#7ec8e366" }}>수정</button>
                          <button onClick={() => deleteTarget(t.id, t.name)} style={{ ...btnDel, padding: "4px 10px", fontSize: 11 }}>삭제</button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.03)" }}>
                          <div style={{ fontSize: 10, color: "#4a7a9b", marginBottom: 2, fontWeight: 600 }}>특성</div>
                          <div style={{ fontSize: 12, lineHeight: "1.4", color: "#e8eef5" }}>{t.info?.characteristics || "-"}</div>
                        </div>
                        <div style={{ background: "rgba(255,112,80,0.03)", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,112,80,0.05)" }}>
                          <div style={{ fontSize: 10, color: "#ff7050", marginBottom: 2, fontWeight: 600 }}>위험요소</div>
                          <div style={{ fontSize: 12, lineHeight: "1.4", color: "#e8eef5" }}>{t.info?.vulnerabilities || "-"}</div>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}
          {tab === "settings" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 640, width: "100%", padding: 24, overflow: "hidden" }}>
              <div style={{ background: "#0d1f30", borderRadius: 10, padding: 24, border: "1px solid #1e3a52" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#ff7050", marginBottom: 20 }}>⚙️ 시스템 설정</div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#7ec8e3", marginBottom: 8 }}>기상청 날씨누리 행정동 코드 (10자리)</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      defaultValue={localStorage.getItem("weather_zone_code") || UI_CONFIG.weatherCode}
                      id="weather-zone-input"
                      placeholder={`예: ${UI_CONFIG.weatherCode}`}
                      style={inp}
                    />
                    <button
                      onClick={() => {
                        const val = document.getElementById("weather-zone-input").value;
                        if (val.length !== 10) return showMsg("올바른 10자리 코드를 입력하세요", false);
                        localStorage.setItem("weather_zone_code", val);
                        showMsg("설정이 저장되었습니다. 앱을 새로고침 하세요.");
                      }}
                      style={btnAdd}
                    >
                      저장
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "#4a7a9b", marginTop: 8, lineHeight: 1.5 }}>
                    * 날씨누리(weather.go.kr) RSS 서비스에서 지역을 검색한 후 URL의 'zone' 파라미터 값을 확인하세요.<br />
                    * 저장 후 브라우저를 새로고침해야 변경된 날씨 정보가 반영됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "theme" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                  🎨 테마 설정
                </div>
                <div style={{ fontSize: 13, color: "#4a7a9b", marginBottom: 36, lineHeight: 1.8 }}>
                  라이트 모드 기능은 현재 준비 중입니다.
                </div>

                {/* 토글 버튼 (비활성화) */}
                <div
                  style={{
                    display: "inline-flex", alignItems: "center",
                    background: "#0d1f30", border: "1px solid #1e3a52",
                    borderRadius: 60, padding: 5, cursor: "not-allowed",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    opacity: 0.6
                  }}
                >
                  <div style={{
                    padding: "14px 32px", borderRadius: 60, fontSize: 15, fontWeight: 700,
                    background: "linear-gradient(135deg, #1e3a52, #0d2a40)",
                    color: "#7ec8e3",
                    border: "1px solid #2a6a8a",
                    whiteSpace: "nowrap"
                  }}>🌙 다크 모드</div>
                  <div style={{
                    padding: "14px 32px", borderRadius: 60, fontSize: 15, fontWeight: 700,
                    background: "transparent",
                    color: "#4a7a9b",
                    border: "1px solid transparent",
                    whiteSpace: "nowrap"
                  }}>☀️ 라이트 모드</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
