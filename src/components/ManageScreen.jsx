import { useState } from "react";
import { supabase } from "../lib/supabase";
import { VEHICLE_ICONS, VEHICLE_LABELS, ROLES } from "../constants";

export default function ManageScreen({ centers, setCenters, personnel, setPersonnel, vehicles, setVehicles, onBack }) {
  const [tab, setTab] = useState("centers");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cForm, setCForm] = useState({ name: "", color: "#FF4500" });
  const [pForm, setPForm] = useState({ name: "", role: "경방", center_id: "", vehicle_id: "" });
  const [vForm, setVForm] = useState({ name: "", type: "pump", center_id: "", water_capacity: 3000 });
  const [editingVehicle, setEditingVehicle] = useState(null);

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
                  <input type="color" value={c.color} onChange={e => updateCenterColor(c.id, e.target.value)} style={{ width: 20, height: 20, border: "none", background: "none", cursor: "pointer", padding: 0, borderRadius: "50%", flexShrink: 0 }} />
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
                          <span style={{ width: 80, fontSize: 11, color: "#4ade80" }}>{v.water_capacity}L</span>
                          <span style={{ flex: 1, fontSize: 11, color: "#7ec8e3" }}>{VEHICLE_LABELS[v.type]}</span>
                          <div style={{ display: "flex", gap: 6 }}>
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
                            <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
                              <button onClick={() => movePersonnel(i, -1, mList)} disabled={i === 0} style={{ ...btnDel, padding: "4px 8px", opacity: i === 0 ? 0.3 : 1, border: "1px solid #4a7a9b" }}>▲</button>
                              <button onClick={() => movePersonnel(i, 1, mList)} disabled={i === mList.length - 1} style={{ ...btnDel, padding: "4px 8px", opacity: i === mList.length - 1 ? 0.3 : 1, border: "1px solid #4a7a9b" }}>▼</button>
                            </div>
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
