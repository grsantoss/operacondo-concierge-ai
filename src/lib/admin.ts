const KEY = "oc.admin.master";

export function isAdminMaster(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function setAdminMaster(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
}
