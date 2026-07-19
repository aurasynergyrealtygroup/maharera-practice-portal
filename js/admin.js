/* ============================================================
   admin.js — admin session helpers (separate token namespace from user auth)
   ============================================================ */

function setAdminSession(admin, token) {
  localStorage.setItem("mrp_admin", JSON.stringify(admin));
  localStorage.setItem("mrp_admin_token", token);
}
function getAdmin() {
  try { return JSON.parse(localStorage.getItem("mrp_admin")); } catch (e) { return null; }
}
function getAdminToken() { return localStorage.getItem("mrp_admin_token"); }
function clearAdminSession() {
  localStorage.removeItem("mrp_admin");
  localStorage.removeItem("mrp_admin_token");
}
function requireAdminAuth() {
  if (!getAdmin() || !getAdminToken()) window.location.href = "login.html";
}

async function adminApi(action, payload = {}) {
  if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("PASTE_")) {
    throw new Error("Backend not configured yet — set CONFIG.API_URL in js/app.js");
  }
  const body = { action, ...payload, adminToken: getAdminToken() || "" };
  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Something went wrong.");
  return data.data;
}

document.addEventListener("DOMContentLoaded", () => {
  const admin = getAdmin();
  const nameSlot = document.getElementById("adminName");
  if (nameSlot && admin) nameSlot.textContent = admin.name || admin.mobile;

  document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
    clearAdminSession();
    window.location.href = "login.html";
  });

  const page = window.location.pathname.split("/").pop() || "dashboard.html";
  document.querySelectorAll(".admin-side a[data-nav]").forEach(a => {
    a.classList.toggle("active", a.getAttribute("data-nav") === page);
  });
});
