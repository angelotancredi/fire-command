export function runMciDeconstruction({
  setMciPos,
  setMciSetupStarted,
  setIsMciLocked,
  setSelected,
  addLog
}) {
  setMciPos(null);
  setMciSetupStarted(false);
  setIsMciLocked(false);
  setSelected(null);
  addLog("임시의료소 해체 완료", "recall");
}

export function runStagingDeconstruction({
  setStagingPos,
  setStagingSetupStarted,
  setIsStagingLocked,
  setSelected,
  addLog
}) {
  setStagingPos(null);
  setStagingSetupStarted(false);
  setIsStagingLocked(false);
  setSelected(null);
  addLog("자원집결지 해체 완료", "recall");
}
