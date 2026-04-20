export async function resetSituationLogs({ supabase, setLogs, setShowResetConfirm }) {
  const { error } = await supabase.from("situation_logs").delete().not("id", "is", null);
  if (error) {
    alert("초기화 실패: " + error.message);
  } else {
    setLogs([]);
  }
  setShowResetConfirm(false);
}
