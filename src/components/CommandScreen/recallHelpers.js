export function applyRecallCleanup({
  itemId,
  itemType,
  setDeployed,
  setWaterSprayLinks,
  setHoseLinks,
  setHydrantCaptureLinks,
  setYCouplingPositions,
  hoseLinks,
  waterSprayLinks // 추가됨
}) {
  const comboKey = `${itemType}_${itemId}`;

  // 1. 기본 철수 (본인 제거)
  setDeployed((prev) => {
    const next = { ...prev };
    delete next[comboKey];
    return next;
  });

  // 2. 차량 철수 시 연쇄 작업
  if (itemType === "vehicle") {
    // 해당 차량에서 뻗어나간 수관들 대상 찾기
    const removedHoseTargets = hoseLinks
      .filter(link => String(link.fromId) === String(itemId))
      .map(link => String(link.toId));

    // 그중 현재 '방수 중'인 대원들 찾기
    const sprayingPersonnelIds = waterSprayLinks
      .filter(s => removedHoseTargets.includes(String(s.personnelId)))
      .map(s => String(s.personnelId));

    // 방수 중인 대원들은 지도에서 함께 제거 (연쇄 철수)
    if (sprayingPersonnelIds.length > 0) {
      setDeployed(prev => {
        const next = { ...prev };
        sprayingPersonnelIds.forEach(pId => {
          delete next[`personnel_${pId}`];
        });
        return next;
      });
    }

    // 방수 중단 처리 (연결된 모든 대상)
    setWaterSprayLinks((prev) =>
      prev.filter((entry) => !removedHoseTargets.includes(String(entry.personnelId)))
    );

    // 수관 제거
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

  // 3. 대원 단독 철수 시
  setWaterSprayLinks((prev) => prev.filter((entry) => String(entry.personnelId) !== String(itemId)));
  setHoseLinks((prev) => prev.filter((entry) => String(entry.toId) !== String(itemId)));
}

export async function removeDeploymentRecord(supabase, id, itemType) {
  await supabase.from("deployments").delete().eq("item_id", id).eq("item_type", itemType);
}

// 여러 레코드를 한 번에 삭제하는 헬퍼 추가
export async function removeMultipleDeploymentRecords(supabase, items) {
  // items: [{id, type}, ...]
  for (const item of items) {
    await supabase.from("deployments").delete().eq("item_id", item.id).eq("item_type", item.type);
  }
}
