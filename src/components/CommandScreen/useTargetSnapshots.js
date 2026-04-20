import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function useTargetSnapshots({
  deployed,
  hoseLinks,
  waterSprayLinks,
  accidentPos,
  accidentAddress,
  hydrantVisible,
  hydrantRadius,
  hydrantCaptureLinks,
  mciPos,
  isMciLocked,
  stagingPos,
  isStagingLocked,
  siameseLinks,
  yCouplingPositions,
  setDeployed,
  setHoseLinks,
  setWaterSprayLinks,
  setAccidentPos,
  setAccidentAddress,
  setHydrantVisible,
  setHydrantCaptureLinks,
  setMciPos,
  setIsMciLocked,
  setStagingPos,
  setIsStagingLocked,
  setSiameseLinks,
  setYCouplingPositions,
  addLog
}) {
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);

  useEffect(() => {
    const fetchTargets = async () => {
      const { data } = await supabase.from("target_objects").select("*").order("name");
      if (data) setTargets(data);
    };

    fetchTargets();
  }, []);

  const fetchSnapshots = async (targetId) => {
    const { data } = await supabase
      .from("tactical_snapshots")
      .select("*")
      .eq("target_id", targetId)
      .order("created_at", { ascending: false });

    if (data) setSnapshots(data);
  };

  const handleSaveSnapshot = async (targetId, name) => {
    setIsSavingSnapshot(true);

    const snapshotData = {
      deployed,
      hoseLinks,
      waterSprayLinks,
      accidentPos,
      accidentAddress,
      hydrantVisible,
      hydrantRadius,
      hydrantCaptureLinks,
      mciPos,
      isMciLocked,
      stagingPos,
      isStagingLocked,
      siameseLinks,
      yCouplingPositions
    };

    const { error } = await supabase.from("tactical_snapshots").insert([{
      target_id: targetId,
      name: name || `${new Date().toLocaleString()} 배치`,
      data: snapshotData
    }]);

    if (!error) {
      addLog(`전술 스냅샷 저장 완료: ${name}`, "info");
      fetchSnapshots(targetId);
    }

    setIsSavingSnapshot(false);
  };

  const actualDeleteSnapshot = async (snapshotId, name) => {
    try {
      const { error } = await supabase.from("tactical_snapshots").delete().eq("id", snapshotId);
      if (!error) {
        addLog(`스냅샷 삭제 완료: ${name}`, "info");
        setSnapshots((prev) => prev.filter((snapshot) => snapshot.id !== snapshotId));
      }
    } catch (err) {
      console.error("Delete snapshot failed:", err);
    }
  };

  const actualDeleteTarget = async (targetId, name) => {
    try {
      await supabase.from("tactical_snapshots").delete().eq("target_id", targetId);
      const { error } = await supabase.from("target_objects").delete().eq("id", targetId);
      if (!error) {
        addLog(`대상물 삭제 완료: ${name}`, "info");
        setTargets((prev) => prev.filter((target) => target.id !== targetId));
        if (selectedTarget?.id === targetId) setSelectedTarget(null);
      }
    } catch (err) {
      console.error("Delete target failed:", err);
    }
  };

  const handleLoadSnapshot = (snapshot) => {
    const { data } = snapshot;

    setDeployed(data.deployed || {});
    setHoseLinks(data.hoseLinks || []);
    setWaterSprayLinks(data.waterSprayLinks || []);
    setAccidentPos(data.accidentPos);
    setAccidentAddress(data.accidentAddress);
    setHydrantVisible(data.hydrantVisible || false);
    setHydrantCaptureLinks(data.hydrantCaptureLinks || []);
    setMciPos(data.mciPos || null);
    setIsMciLocked(data.isMciLocked || false);
    setStagingPos(data.stagingPos || null);
    setIsStagingLocked(data.isStagingLocked || false);
    setSiameseLinks(data.siameseLinks || []);
    setYCouplingPositions(data.yCouplingPositions || {});
    addLog(`스냅샷 불러오기 완료: ${snapshot.name}`, "info");
  };

  return {
    targets,
    setTargets,
    selectedTarget,
    setSelectedTarget,
    snapshots,
    setSnapshots,
    isSavingSnapshot,
    setIsSavingSnapshot,
    fetchSnapshots,
    handleSaveSnapshot,
    actualDeleteSnapshot,
    actualDeleteTarget,
    handleLoadSnapshot
  };
}
