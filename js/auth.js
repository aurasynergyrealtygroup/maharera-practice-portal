/* ============================================================
   auth.js — register & login form handling
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const regForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("formMsg");
      const btn = document.getElementById("submitBtn");
      hideMsg(msg);

      const name = document.getElementById("name").value.trim();
      const mobile = document.getElementById("mobile").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const confirm = document.getElementById("confirmPassword").value;

      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return showMsg(msg, "Enter a valid 10-digit Indian mobile number.");
      }
      if (password.length < 6) {
        return showMsg(msg, "Password must be at least 6 characters.");
      }
      if (password !== confirm) {
        return showMsg(msg, "Passwords do not match.");
      }

      setBtnLoading(btn, true);
      try {
        const data = await api("register", { name, mobile, email, password });
        setSession(data.user, data.token);
        showMsg(msg, "Account created. Redirecting to your dashboard…", "success");
        setTimeout(() => window.location.href = "dashboard.html", 700);
      } catch (err) {
        showMsg(msg, err.message);
      } finally {
        setBtnLoading(btn, false, "Create account");
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("formMsg");
      const btn = document.getElementById("submitBtn");
      hideMsg(msg);

      const mobile = document.getElementById("mobile").value.trim();
      const password = document.getElementById("password").value;

      setBtnLoading(btn, true);
      try {
        const data = await api("login", { mobile, password });
        setSession(data.user, data.token);
        window.location.href = "dashboard.html";
      } catch (err) {
        showMsg(msg, err.message);
      } finally {
        setBtnLoading(btn, false, "Sign in");
      }
    });
  }
});
