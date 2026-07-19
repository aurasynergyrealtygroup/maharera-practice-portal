/* ============================================================
   dashboard.js — loads user stats, gates the "Start Practice Test" CTA
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const user = getUser();
  document.getElementById("welcomeName").textContent = user.name.split(" ")[0];

  try {
    const data = await api("dashboard");

    document.getElementById("payStatus").textContent = data.paid ? "Paid" : "Unpaid";
    document.getElementById("payStatus").className = "status-pill " + (data.paid ? "paid" : "unpaid");

    document.getElementById("usedAttempts").textContent = data.usedAttempts;
    document.getElementById("allowedAttempts").textContent = data.allowedAttempts;
    document.getElementById("remainingAttempts").textContent = Math.max(0, data.allowedAttempts - data.usedAttempts);
    document.getElementById("lastScore").textContent = data.lastScore != null ? data.lastScore : "—";

    const startBtn = document.getElementById("startTestBtn");
    const notice = document.getElementById("startNotice");

    if (!data.paid) {
      startBtn.textContent = "Unlock with payment — ₹" + CONFIG.EXAM_FEE_INR;
      startBtn.onclick = () => window.location.href = "pricing.html";
      notice.textContent = "Complete payment to unlock the full 50-question practice test.";
    } else if (data.usedAttempts >= data.allowedAttempts) {
      startBtn.disabled = true;
      startBtn.textContent = "No attempts remaining";
      notice.textContent = "You have used all " + data.allowedAttempts + " attempts. Contact support to request more.";
    } else {
      startBtn.textContent = "Start practice test";
      startBtn.onclick = () => window.location.href = "exam.html";
      notice.textContent = "50 questions · " + CONFIG.TIME_LIMIT_MINUTES + " minutes · Pass mark " + CONFIG.PASS_MARKS + "/100";
    }

    // Recent results table
    const tbody = document.getElementById("resultsBody");
    tbody.innerHTML = "";
    if (!data.results || data.results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="small">No attempts yet. Your results will appear here after your first test.</td></tr>';
    } else {
      data.results.slice().reverse().forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-family:var(--mono)">${r.examId}</td>
          <td>${formatDate(r.date)}</td>
          <td>${r.score} / 100</td>
          <td><span class="tag ${r.result === 'PASS' ? 'green' : 'red'}">${r.result}</span></td>
          <td><a href="result.html?examId=${encodeURIComponent(r.examId)}" class="small">View →</a></td>`;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error(err);
    document.getElementById("dashboardError").textContent = err.message;
    document.getElementById("dashboardError").style.display = "block";
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearSession();
  window.location.href = "login.html";
});
