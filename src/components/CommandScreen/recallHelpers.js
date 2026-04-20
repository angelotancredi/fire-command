export function applyRecallCleanup({
  itemId,
  itemType,
  setDeployed,
  setWaterSprayLinks,
  setHoseLinks,
  setHydrantCaptureLinks,
  setYCouplingPositions
}) {
  const comboKey = `${itemType}_${itemId}`;

  setDeployed((prev) => {
    const next = { ...prev };
    delete next[comboKey];
    return next;
  });

  setWaterSprayLinks((prev) =>
    prev.filter((entry) => entry.vehicleId !== itemId && entry.personnelId !== itemId)
  );

  if (itemType === "vehicle") {
    setHoseLinks((prev) => prev.filter((entry) => entry.fromId !== itemId));
    setHydrantCaptureLinks((prev) => prev.filter((entry) => entry.vehicleId !== itemId));
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

  setHoseLinks((prev) => prev.filter((entry) => entry.toId !== itemId));
}

export async function removeDeploymentRecord(supabase, id, itemType) {
  await supabase.from("deployments").delete().eq("item_id", id).eq("item_type", itemType);
}
