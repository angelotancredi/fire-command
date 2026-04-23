export function applyRecallCleanup({
  itemId,
  itemType,
  setDeployed,
  setWaterSprayLinks,
  setHoseLinks,
  setHydrantCaptureLinks,
  setYCouplingPositions,
  hoseLinks // 추가됨
}) {
  const comboKey = `${itemType}_${itemId}`;

  // 1. 철수하는 차량/대원 제거
  setDeployed((prev) => {
    const next = { ...prev };
    delete next[comboKey];
    return next;
  });

  // 2. 차량 철수 시 연쇄 작업
  if (itemType === "vehicle") {
    // 해당 차량에서 뻗어나간 수관들 찾기
    const removedHoseTargets = hoseLinks
      .filter(link => String(link.fromId) === String(itemId))
      .map(link => String(link.toId));

    // 해당 수관들을 통해 방수 중이던 대원들의 방수 중단
    setWaterSprayLinks((prev) =>
      prev.filter((entry) => !removedHoseTargets.includes(String(entry.personnelId)))
    );

    // 해당 차량의 수관 연결 제거
    setHoseLinks((prev) => prev.filter((entry) => String(entry.fromId) !== String(itemId)));
    
    // 소화전 점령 해제
    setHydrantCaptureLinks((prev) => prev.filter((entry) => String(entry.vehicleId) !== String(itemId)));
    
    // Y커플링 제거
    setYCouplingPositions((prev) => {
      const next = { ...prev };
      delete next[itemId];
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${itemId}_`)) {
          delete next[key];
        }
      });
      return next;
    });
    return;
  }

  // 3. 대원 철수 시 (본인 방수 중단 및 본인에게 오는 수관 제거)
  setWaterSprayLinks((prev) => prev.filter((entry) => String(entry.personnelId) !== String(itemId)));
  setHoseLinks((prev) => prev.filter((entry) => String(entry.toId) !== String(itemId)));
}

export async function removeDeploymentRecord(supabase, id, itemType) {
  await supabase.from("deployments").delete().eq("item_id", id).eq("item_type", itemType);
}
