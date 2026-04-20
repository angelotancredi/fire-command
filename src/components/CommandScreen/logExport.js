export function exportLogsAsCsv(logs) {
  if (!logs || logs.length === 0) {
    alert("저장할 기록이 없습니다.");
    return;
  }

  try {
    const csvRows = ["\uFEFF시간,유형,내용"];
    logs.forEach((log) => {
      const row = [
        log.timestamp,
        log.type || "정보",
        log.text.replace(/,/g, " ") // CSV 쉼표 오류 방지
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `현장활동기록_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Export failed:", err);
    alert("저장 중 오류가 발생했습니다: " + err.message);
  }
}
