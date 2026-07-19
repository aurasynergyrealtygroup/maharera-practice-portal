/* ============================================================
   app.js — shared config + API helper
   MahaRERA Practice Portal
   ============================================================ */

// 1) Paste your deployed Google Apps Script Web App URL below.
//    Deploy > New deployment > Web app > Execute as: Me > Access: Anyone
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzyO9W8SBtilPN9lkNaziwnqnXMlQhNU8mxuxQQfE2kYce5-724EsdGm424MNbf2E7w/exec",
  RAZORPAY_KEY: "PASTE_YOUR_RAZORPAY_KEY_ID_HERE",
  EXAM_FEE_INR: 600,
  TOTAL_QUESTIONS: 25,
  MARKS_PER_QUESTION: 2,
  PASS_MARKS: 20,
  TIME_LIMIT_MINUTES: 60,
  MAX_ATTEMPTS: 5
};

/**
 * Calls the Apps Script backend.
 * Apps Script web apps only reliably accept GET + POST (no custom headers/CORS preflight),
 * so every action is sent as a POST with a JSON body, and Apps Script routes on `action`.
 */
async function api(action, payload = {}) {
  if (!CONFIG.API_URL || CONFIG.API_URL.startsWith("PASTE_")) {
    throw new Error("Backend not configured yet — set CONFIG.API_URL in js/app.js");
  }
  const body = { action, ...payload, token: getToken() || "" };
  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    // text/plain avoids a CORS preflight against Apps Script, which doesn't handle OPTIONS
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data.data;
}

// ---- Session helpers (client-side only; server re-validates token on every call) ----
function setSession(user, token) {
  localStorage.setItem("mrp_user", JSON.stringify(user));
  localStorage.setItem("mrp_token", token);
}
function getUser() {
  try { return JSON.parse(localStorage.getItem("mrp_user")); } catch (e) { return null; }
}
function getToken() { return localStorage.getItem("mrp_token"); }
function clearSession() {
  localStorage.removeItem("mrp_user");
  localStorage.removeItem("mrp_token");
}
function requireAuth(redirectTo = "login.html") {
  if (!getUser() || !getToken()) window.location.href = redirectTo;
}

// ---- UI helpers ----
function showMsg(el, text, type = "error") {
  el.textContent = text;
  el.className = "form-msg " + type;
  el.style.display = "block";
}
function hideMsg(el) { el.style.display = "none"; }

function setBtnLoading(btn, loading, labelWhenIdle) {
  if (loading) {
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spin"></span> Working…';
  } else {
    btn.disabled = false;
    btn.textContent = labelWhenIdle || btn.dataset.label || btn.textContent;
  }
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch (e) { return iso; }
}

// Highlight active nav link based on current file
document.addEventListener("DOMContentLoaded", () => {
  const page = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a[data-nav]").forEach(a => {
    if (a.getAttribute("data-nav") === page) a.style.color = "var(--gold-soft)";
  });
  // Reflect logged-in state on public pages if a #navAuthSlot exists
  const slot = document.getElementById("navAuthSlot");
  if (slot) {
    const user = getUser();
    if (user) {
      slot.innerHTML = `<a href="dashboard.html">${user.name.split(" ")[0]}</a><a href="dashboard.html" class="nav-cta">Dashboard</a>`;
    }
  }
});
