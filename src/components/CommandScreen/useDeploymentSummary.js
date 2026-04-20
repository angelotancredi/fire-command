import { useMemo } from "react";

export default function useDeploymentSummary({ deployed, personnel }) {
  return useMemo(() => {
    const deployedIds = new Set(Object.keys(deployed));
    const vehicleDeployedIds = Object.values(deployed)
      .filter((entry) => entry.itemType === "vehicle")
      .map((entry) => entry.id);

    const totalPersonnelIds = new Set();
    Object.values(deployed).forEach((entry) => {
      if (entry.itemType === "personnel") {
        totalPersonnelIds.add(entry.id.toString());
      }
    });

    const vehicleDeployedIdSet = new Set(vehicleDeployedIds.map((id) => id.toString()));
    personnel.forEach((person) => {
      if (vehicleDeployedIdSet.has(person.vehicle_id?.toString())) {
        totalPersonnelIds.add(person.id.toString());
      }
    });

    return {
      deployedIds,
      vehicleDeployedIds,
      vehicleDeployedIdSet,
      personnelDeployedCount: totalPersonnelIds.size,
      vehicleDeployedCount: vehicleDeployedIds.length
    };
  }, [deployed, personnel]);
}
