import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./lib/supabase";
import { DISTRICTS } from "./constants";
import LoadingScreen from "./components/LoadingScreen";
import DistrictSelector from "./components/DistrictSelector";
import ManageScreen from "./components/ManageScreen";
import CommandScreen from "./components/CommandScreen";

export default function App() {
  const [centers, setCenters] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("command");
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  // 전역 전술 상태
  const [deployed, setDeployed] = useState({});
  const [logs, setLogs] = useState([]);
  const [accidentPos, setAccidentPos] = useState(null);
  const [accidentAddress, setAccidentAddress] = useState("");
  const [isAccidentLocked, setIsAccidentLocked] = useState(false);
  const [hoseLinks, setHoseLinks] = useState([]);
  const [waterSprayLinks, setWaterSprayLinks] = useState([]);
  const [time, setTime] = useState("");

  // UI 유지 상태
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("vehicle");
  const [expandedCenters, setExpandedCenters] = useState({});

  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTime(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase.from("centers").select("*").order("created_at", { ascending: true });
      const { data: p } = await supabase.from("personnel").select("*").order("created_at", { ascending: true });
      const { data: v } = await supabase.from("vehicles").select("*").order("created_at", { ascending: true });
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
            if (item) {
              const compositeKey = `${d.item_type}_${d.item_id}`;
              map[compositeKey] = { ...item, itemType: d.item_type, lat: d.lat, lng: d.lng };
            }
          });
          setDeployed(map);
        }
      }

      const { data: logData } = await supabase.from("situation_logs").select("*").order("created_at", { ascending: false }).limit(50);
      if (logData) setLogs(logData);
      setLoading(false);
    };
    load();

    const logSub = supabase.channel("app-logs-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "situation_logs" }, payload => {
        setLogs(prev => {
          if (prev.some(l => l.id === payload.new.id)) return prev;
          return [payload.new, ...prev].slice(0, 50);
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "situation_logs" }, () => setLogs([]))
      .subscribe();

    const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      supabase.removeChannel(logSub);
    };
  }, []);

  const handleGlobalReset = async () => {
    setLoading(true);
    try {
      await supabase.from("situation_logs").delete().neq("id", 0);
      await supabase.from("deployments").delete().neq("id", 0);
      setSelectedDistrict(null);
      setDeployed({});
      setLogs([]);
      setAccidentPos(null);
      setAccidentAddress("");
      setIsAccidentLocked(false);
      setHoseLinks([]);
      setWaterSprayLinks([]);
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
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${hours}:${minutes}:${seconds}`;
    await supabase.from("situation_logs").insert([{ timestamp, text, type }]);
  }, []);

  const centersWithCoords = useMemo(() => centers.map(c => {
    const districtMatch = DISTRICTS.find(d => d.jurisdictional === c.name);
    return { ...c, lat: districtMatch?.center.lat || 35.2312, lng: districtMatch?.center.lng || 128.8924 };
  }), [centers]);

  if (loading) return <LoadingScreen />;

  return (
    <div style={{ filter: isLight ? "invert(0.9) hue-rotate(180deg)" : "none", background: "#060d18", height: "100vh" }}>
      {!selectedDistrict && <DistrictSelector onSelect={setSelectedDistrict} />}
      {view === "command" ? (
        <CommandScreen
          centers={centersWithCoords} personnel={personnel} vehicles={vehicles}
          selectedDistrict={selectedDistrict} onManage={() => setView("manage")} onGlobalReset={handleGlobalReset}
          deployed={deployed} setDeployed={setDeployed}
          logs={logs} setLogs={setLogs}
          accidentPos={accidentPos} setAccidentPos={setAccidentPos}
          accidentAddress={accidentAddress} setAccidentAddress={setAccidentAddress}
          isAccidentLocked={isAccidentLocked} setIsAccidentLocked={setIsAccidentLocked}
          hoseLinks={hoseLinks} setHoseLinks={setHoseLinks}
          waterSprayLinks={waterSprayLinks} setWaterSprayLinks={setWaterSprayLinks}
          time={time} addLog={addLog}
          selected={selected} setSelected={setSelected}
          activeTab={activeTab} setSideTab={setActiveTab}
          expandedCenters={expandedCenters} setExpandedCenters={setExpandedCenters}
          isLight={isLight}
        />
      ) : (
        <ManageScreen 
          centers={centers} setCenters={setCenters} 
          personnel={personnel} setPersonnel={setPersonnel} 
          vehicles={vehicles} setVehicles={setVehicles} 
          onBack={() => setView("command")} 
          isLight={isLight} setIsLight={setIsLight}
        />
      )}
    </div>
  );
}
