import { useMemo } from "react";
import { getDistance } from "../../constants";

export default function useSortedCenters({ centers, selectedDistrict }) {
  return useMemo(() => {
    if (!selectedDistrict) return centers;

    return [...centers].sort((a, b) => {
      const getPriority = (center) => {
        if (center.name === selectedDistrict.jurisdictional) return 0;
        if (center.name === "구조대") return 1;
        if (center.name === "현장대응단") return 2;
        if (["삼랑진119안전센터", "경남소방본부", "의령지정119안전센터"].includes(center.name)) return 10;
        return 5;
      };

      const prioA = getPriority(a);
      const prioB = getPriority(b);

      if (prioA !== prioB) return prioA - prioB;

      const distA = getDistance(selectedDistrict.center.lat, selectedDistrict.center.lng, a.lat, a.lng);
      const distB = getDistance(selectedDistrict.center.lat, selectedDistrict.center.lng, b.lat, b.lng);
      return distA - distB;
    });
  }, [centers, selectedDistrict]);
}
