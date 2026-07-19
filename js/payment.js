/* ============================================================
   payment.js — Razorpay checkout + server-side verification
   Requires https://checkout.razorpay.com/v1/checkout.js on the page
   ============================================================ */

document.getElementById("payBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("payBtn");
  const msg = document.getElementById("payMsg");
  hideMsg(msg);

  if (!getUser()) {
    window.location.href = "login.html?next=pricing.html";
    return;
  }

  setBtnLoading(btn, true);
  try {
    // 1) Ask backend to create a Razorpay order (keeps the amount server-side & trusted)
    const order = await api("createOrder", { amountInr: CONFIG.EXAM_FEE_INR });

    // 2) Open Razorpay Checkout
    const rzp = new Razorpay({
      key: CONFIG.RAZORPAY_KEY,
      amount: order.amount,
      currency: "INR",
      name: "MahaRERA Practice Portal",
      description: "Practice test access — 5 attempts",
      order_id: order.orderId,
      prefill: { name: getUser().name, contact: getUser().mobile, email: getUser().email },
      theme: { color: "#0F2A3D" },
      handler: async function (response) {
        try {
          await api("verifyPayment", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          });
          showMsg(msg, "Payment verified! Redirecting to your dashboard…", "success");
          setTimeout(() => window.location.href = "dashboard.html", 900);
        } catch (err) {
          showMsg(msg, "Payment received but verification failed: " + err.message + ". Contact support with your payment ID.");
        }
      },
      modal: {
        ondismiss: function () { setBtnLoading(btn, false, "Pay ₹" + CONFIG.EXAM_FEE_INR + " & unlock"); }
      }
    });
    rzp.on("payment.failed", function (resp) {
      showMsg(msg, "Payment failed: " + resp.error.description);
      setBtnLoading(btn, false, "Pay ₹" + CONFIG.EXAM_FEE_INR + " & unlock");
    });
    rzp.open();
  } catch (err) {
    showMsg(msg, err.message);
    setBtnLoading(btn, false, "Pay ₹" + CONFIG.EXAM_FEE_INR + " & unlock");
  }
});
