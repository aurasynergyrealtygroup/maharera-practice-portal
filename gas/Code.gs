/* ================================================================
   MahaRERA Practice Portal — Backend (Google Apps Script)
   Deploy: Deploy > New deployment > Web app
           Execute as: Me | Who has access: Anyone
   Then paste the /exec URL into js/app.js -> CONFIG.API_URL
   ================================================================ */

// ---------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------
const CFG = {
  TOTAL_QUESTIONS: 50,
  MARKS_PER_QUESTION: 2,
  PASS_MARKS: 40,
  TIME_LIMIT_MINUTES: 60,
  DEFAULT_ATTEMPTS_ON_PAYMENT: 5,
  EXAM_FEE_PAISE: 30000, // ₹300.00 in paise
  TOKEN_TTL_HOURS: 24 * 7,      // user tokens valid 7 days
  ADMIN_TOKEN_TTL_HOURS: 24     // admin tokens valid 1 day
};

const SHEETS = {
  USERS: "Users",
  QUESTIONS: "Questions",
  RESULTS: "Results",
  PAYMENTS: "Payments",
  SESSIONS: "Sessions",
  ADMINS: "AdminUsers",
  CONTACT: "ContactMessages"
};

// ---------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: "Invalid request." });
  }

  const action = body.action;
  try {
    let data;
    switch (action) {
      // ---- Public / auth ----
      case "register":        data = doRegister(body); break;
      case "login":            data = doLogin(body); break;
      case "contactMessage":   data = doContactMessage(body); break;

      // ---- Authenticated user actions ----
      case "dashboard":        data = withUser(body, doDashboard); break;
      case "startExam":        data = withUser(body, doStartExam); break;
      case "submitExam":       data = withUser(body, doSubmitExam); break;
      case "getResult":        data = withUser(body, doGetResult); break;
      case "changePassword":   data = withUser(body, doChangePassword); break;
      case "createOrder":      data = withUser(body, doCreateOrder); break;
      case "verifyPayment":    data = withUser(body, doVerifyPayment); break;

      // ---- Admin actions ----
      case "adminLogin":            data = doAdminLogin(body); break;
      case "adminOverview":         data = withAdmin(body, doAdminOverview); break;
      case "adminListUsers":        data = withAdmin(body, doAdminListUsers); break;
      case "adminResetAttempts":    data = withAdmin(body, doAdminResetAttempts); break;
      case "adminGrantAttempt":     data = withAdmin(body, doAdminGrantAttempt); break;
      case "adminSetBlocked":       data = withAdmin(body, doAdminSetBlocked); break;
      case "adminListQuestions":    data = withAdmin(body, doAdminListQuestions); break;
      case "adminAddQuestion":      data = withAdmin(body, doAdminAddQuestion); break;
      case "adminUpdateQuestion":   data = withAdmin(body, doAdminUpdateQuestion); break;
      case "adminDeleteQuestion":   data = withAdmin(body, doAdminDeleteQuestion); break;
      case "adminListPayments":     data = withAdmin(body, doAdminListPayments); break;
      case "adminListResults":      data = withAdmin(body, doAdminListResults); break;

      default:
        return jsonOut({ ok: false, error: "Unknown action: " + action });
    }
    return jsonOut({ ok: true, data: data });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message || String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------
// AUTH WRAPPERS
// ---------------------------------------------------------------
function withUser(body, fn) {
  const userId = verifyToken(body.token, "U");
  if (!userId) throw new Error("Your session has expired. Please sign in again.");
  return fn(body, userId);
}
function withAdmin(body, fn) {
  const adminId = verifyToken(body.adminToken, "A");
  if (!adminId) throw new Error("Admin session expired. Please sign in again.");
  return fn(body, adminId);
}

// ---------------------------------------------------------------
// TOKENS (stateless, HMAC-signed — no session sheet needed)
// ---------------------------------------------------------------
function getSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("SECRET_KEY");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("SECRET_KEY", secret);
  }
  return secret;
}
function makeToken(id, prefix, ttlHours) {
  const expires = Date.now() + ttlHours * 3600 * 1000;
  const payload = prefix + ":" + id + ":" + expires;
  const sig = sign(payload);
  return Utilities.base64EncodeWebSafe(payload + ":" + sig);
}
function verifyToken(token, expectedPrefix) {
  if (!token) return null;
  try {
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [prefix, id, expires, sig] = parts;
    if (prefix !== expectedPrefix) return null;
    if (Date.now() > Number(expires)) return null;
    const expectedSig = sign(prefix + ":" + id + ":" + expires);
    if (expectedSig !== sig) return null;
    return id;
  } catch (e) { return null; }
}
function sign(payload) {
  const raw = Utilities.computeHmacSha256Signature(payload, getSecret());
  return raw.map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join("");
}
function hashPassword(password, salt) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ":" + salt);
  return raw.map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join("");
}

// ---------------------------------------------------------------
// SHEET HELPERS
// ---------------------------------------------------------------
function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error("Missing sheet: " + name + ". Run setupSheets() once from the Apps Script editor.");
  return sh;
}
function readRows(name) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  return values.map((row, i) => {
    const obj = { _row: i + 2 }; // actual sheet row number (1-based, +1 for header)
    headers.forEach((h, idx) => obj[h] = row[idx]);
    return obj;
  });
}
function appendRow(name, obj, headerOrder) {
  const sh = sheet(name);
  const row = headerOrder.map(h => (obj[h] !== undefined ? obj[h] : ""));
  sh.appendRow(row);
}
function updateRowByField(name, matchField, matchValue, updates) {
  const sh = sheet(name);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const colIndex = headers.indexOf(matchField);
  if (colIndex === -1) throw new Error("Field not found: " + matchField);
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][colIndex]) === String(matchValue)) {
      Object.keys(updates).forEach(key => {
        const c = headers.indexOf(key);
        if (c !== -1) sh.getRange(r + 1, c + 1).setValue(updates[key]);
      });
      return true;
    }
  }
  return false;
}
function newId(prefix) {
  return prefix + Utilities.getUuid().split("-")[0].toUpperCase();
}

// ================================================================
// USER AUTH
// ================================================================
function doRegister(body) {
  const name = (body.name || "").trim();
  const mobile = (body.mobile || "").trim();
  const email = (body.email || "").trim();
  const password = body.password || "";

  if (!name || !mobile || !email || !password) throw new Error("All fields are required.");
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error("Enter a valid 10-digit mobile number.");

  const users = readRows(SHEETS.USERS);
  if (users.some(u => String(u.Mobile) === mobile)) {
    throw new Error("An account with this mobile number already exists. Please sign in.");
  }

  const salt = Utilities.getUuid();
  const userId = newId("U");
  appendRow(SHEETS.USERS, {
    UserID: userId, Name: name, Mobile: mobile, Email: email,
    PasswordHash: hashPassword(password, salt), Salt: salt,
    Paid: "No", AllowedAttempts: 0, UsedAttempts: 0, Blocked: "No",
    CreatedAt: new Date().toISOString()
  }, ["UserID","Name","Mobile","Email","PasswordHash","Salt","Paid","AllowedAttempts","UsedAttempts","Blocked","CreatedAt"]);

  const token = makeToken(userId, "U", CFG.TOKEN_TTL_HOURS);
  return { user: { userId, name, mobile, email }, token };
}

function doLogin(body) {
  const mobile = (body.mobile || "").trim();
  const password = body.password || "";
  const users = readRows(SHEETS.USERS);
  const u = users.find(x => String(x.Mobile) === mobile);
  if (!u) throw new Error("No account found with that mobile number.");
  if (String(u.Blocked) === "Yes") throw new Error("This account has been blocked. Contact support.");
  if (hashPassword(password, u.Salt) !== u.PasswordHash) throw new Error("Incorrect password.");

  const token = makeToken(u.UserID, "U", CFG.TOKEN_TTL_HOURS);
  return { user: { userId: u.UserID, name: u.Name, mobile: u.Mobile, email: u.Email }, token };
}

function doChangePassword(body, userId) {
  const users = readRows(SHEETS.USERS);
  const u = users.find(x => x.UserID === userId);
  if (!u) throw new Error("User not found.");
  if (hashPassword(body.currentPassword || "", u.Salt) !== u.PasswordHash) {
    throw new Error("Current password is incorrect.");
  }
  const newSalt = Utilities.getUuid();
  updateRowByField(SHEETS.USERS, "UserID", userId, {
    PasswordHash: hashPassword(body.newPassword, newSalt),
    Salt: newSalt
  });
  return { updated: true };
}

function doContactMessage(body) {
  appendRow(SHEETS.CONTACT, {
    Date: new Date().toISOString(),
    Name: (body.name || "").trim(),
    Email: (body.email || "").trim(),
    Message: (body.message || "").trim()
  }, ["Date","Name","Email","Message"]);
  return { sent: true };
}

// ================================================================
// DASHBOARD
// ================================================================
function doDashboard(body, userId) {
  const u = readRows(SHEETS.USERS).find(x => x.UserID === userId);
  if (!u) throw new Error("User not found.");
  const results = readRows(SHEETS.RESULTS).filter(r => r.UserID === userId);
  const lastScore = results.length ? results[results.length - 1].Score : null;

  return {
    paid: String(u.Paid) === "Yes",
    allowedAttempts: Number(u.AllowedAttempts) || 0,
    usedAttempts: Number(u.UsedAttempts) || 0,
    lastScore: lastScore,
    results: results.map(r => ({ examId: r.ExamID, date: r.Date, score: r.Score, result: r.Result }))
  };
}

// ================================================================
// EXAM ENGINE
// ================================================================
function doStartExam(body, userId) {
  const u = readRows(SHEETS.USERS).find(x => x.UserID === userId);
  if (!u) throw new Error("User not found.");
  if (String(u.Paid) !== "Yes") throw new Error("Please complete payment to start a practice test.");
  if (Number(u.UsedAttempts) >= Number(u.AllowedAttempts)) throw new Error("You have used all your attempts.");

  // Reads the ENTIRE Questions sheet — every row from the first question to
  // the last (global pool, currently up to 600) — shuffles it, then takes
  // the first CFG.TOTAL_QUESTIONS (25). Every attempt draws fresh from the
  // full global bank, not just a subset or a fixed block.
  const allQuestions = readRows(SHEETS.QUESTIONS);
  if (allQuestions.length < CFG.TOTAL_QUESTIONS) {
    throw new Error("Question bank is not fully set up yet. Please contact support.");
  }
  const picked = shuffle(allQuestions).slice(0, CFG.TOTAL_QUESTIONS);

  const sessionId = newId("S");
  const answerKey = {};
  picked.forEach(q => answerKey[q.QID] = q.Answer);

  appendRow(SHEETS.SESSIONS, {
    SessionId: sessionId, UserID: userId,
    QuestionIds: picked.map(q => q.QID).join(","),
    AnswerKey: JSON.stringify(answerKey),
    StartTime: new Date().toISOString(),
    Used: "No"
  }, ["SessionId","UserID","QuestionIds","AnswerKey","StartTime","Used"]);

  return {
    sessionId,
    timeLimitMinutes: CFG.TIME_LIMIT_MINUTES,
    questions: picked.map(q => ({
      qid: q.QID, question: q.Question,
      optionA: q.OptionA, optionB: q.OptionB, optionC: q.OptionC, optionD: q.OptionD
    }))
  };
}

function doSubmitExam(body, userId) {
  const sessions = readRows(SHEETS.SESSIONS);
  const session = sessions.find(s => s.SessionId === body.sessionId && s.UserID === userId);
  if (!session) throw new Error("Exam session not found.");
  if (String(session.Used) === "Yes") throw new Error("This exam session has already been submitted.");

  const answerKey = JSON.parse(session.AnswerKey);
  const submitted = body.answers || {};
  let correct = 0, wrong = 0;
  Object.keys(answerKey).forEach(qid => {
    if (submitted[qid]) {
      if (submitted[qid] === answerKey[qid]) correct++; else wrong++;
    }
  });
  const score = correct * CFG.MARKS_PER_QUESTION;
  const result = score >= CFG.PASS_MARKS ? "PASS" : "FAIL";

  const startTime = new Date(session.StartTime).getTime();
  const timeTakenMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));

  const u = readRows(SHEETS.USERS).find(x => x.UserID === userId);
  const attemptNumber = Number(u.UsedAttempts) + 1;
  const examId = newId("E");

  appendRow(SHEETS.RESULTS, {
    ExamID: examId, UserID: userId, SessionId: session.SessionId,
    Date: new Date().toISOString(), Score: score, Correct: correct, Wrong: wrong,
    Result: result, AttemptNumber: attemptNumber, TimeTakenMinutes: timeTakenMinutes
  }, ["ExamID","UserID","SessionId","Date","Score","Correct","Wrong","Result","AttemptNumber","TimeTakenMinutes"]);

  updateRowByField(SHEETS.SESSIONS, "SessionId", session.SessionId, { Used: "Yes" });
  updateRowByField(SHEETS.USERS, "UserID", userId, { UsedAttempts: attemptNumber });

  return { examId, score, correct, wrong, result };
}

function doGetResult(body, userId) {
  const r = readRows(SHEETS.RESULTS).find(x => x.ExamID === body.examId && x.UserID === userId);
  if (!r) throw new Error("Result not found.");
  return {
    examId: r.ExamID, date: r.Date, score: r.Score, correct: r.Correct, wrong: r.Wrong,
    result: r.Result, attemptNumber: r.AttemptNumber, timeTakenMinutes: r.TimeTakenMinutes
  };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ================================================================
// PAYMENTS (Razorpay)
// ================================================================
function doCreateOrder(body, userId) {
  const props = PropertiesService.getScriptProperties();
  const keyId = props.getProperty("RAZORPAY_KEY_ID");
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");

  case "contactMessage":   data = doContactMessage(body); break;
  case "checkConfig":      data = doCheckConfig(); break;


  if (!keyId || !keySecret) throw new Error("Payments are not configured yet. Contact support.");

  const receipt = "rcpt_" + userId + "_" + Date.now();
  const res = UrlFetchApp.fetch("https://api.razorpay.com/v1/orders", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Basic " + Utilities.base64Encode(keyId + ":" + keySecret) },
    payload: JSON.stringify({ amount: CFG.EXAM_FEE_PAISE, currency: "INR", receipt: receipt }),
    muteHttpExceptions: true
  });
  const order = JSON.parse(res.getContentText());
  if (!order.id) throw new Error("Could not create payment order. Please try again.");
  return { orderId: order.id, amount: order.amount };
}
function doCheckConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    paymentsConfigured: !!(props.getProperty("RAZORPAY_KEY_ID") && props.getProperty("RAZORPAY_KEY_SECRET"))
  };
}
function doVerifyPayment(body, userId) {
  const props = PropertiesService.getScriptProperties();
  const keySecret = props.getProperty("RAZORPAY_KEY_SECRET");
  const payload = body.razorpay_order_id + "|" + body.razorpay_payment_id;
  const expectedSig = Utilities.computeHmacSha256Signature(payload, keySecret)
    .map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join("");

  if (expectedSig !== body.razorpay_signature) throw new Error("Payment signature verification failed.");

  const u = readRows(SHEETS.USERS).find(x => x.UserID === userId);
  const newAllowed = Math.max(Number(u.AllowedAttempts) || 0, CFG.DEFAULT_ATTEMPTS_ON_PAYMENT);
  updateRowByField(SHEETS.USERS, "UserID", userId, { Paid: "Yes", AllowedAttempts: newAllowed });

  appendRow(SHEETS.PAYMENTS, {
    PaymentID: body.razorpay_payment_id, UserID: userId, Amount: CFG.EXAM_FEE_PAISE / 100,
    Status: "Paid", Date: new Date().toISOString(),
    RazorpayOrderId: body.razorpay_order_id, RazorpayPaymentId: body.razorpay_payment_id
  }, ["PaymentID","UserID","Amount","Status","Date","RazorpayOrderId","RazorpayPaymentId"]);

  return { verified: true };
}

// ================================================================
// ADMIN
// ================================================================
function doAdminLogin(body) {
  const mobile = (body.mobile || "").trim();
  const password = body.password || "";
  const admins = readRows(SHEETS.ADMINS);
  const a = admins.find(x => String(x.Mobile) === mobile);
  if (!a) throw new Error("Invalid admin credentials.");
  if (hashPassword(password, a.Salt) !== a.PasswordHash) throw new Error("Invalid admin credentials.");
  const token = makeToken(a.AdminID, "A", CFG.ADMIN_TOKEN_TTL_HOURS);
  return { admin: { name: a.Name, mobile: a.Mobile }, token };
}

function doAdminOverview() {
  const users = readRows(SHEETS.USERS);
  const results = readRows(SHEETS.RESULTS);
  const passed = results.filter(r => r.Result === "PASS").length;
  const recent = results.slice(-10).reverse().map(r => {
    const u = users.find(x => x.UserID === r.UserID);
    return { name: u ? u.Name : r.UserID, examId: r.ExamID, date: r.Date, score: r.Score, result: r.Result };
  });
  return {
    totalUsers: users.length,
    paidUsers: users.filter(u => String(u.Paid) === "Yes").length,
    totalAttempts: results.length,
    passRate: results.length ? Math.round((passed / results.length) * 100) : 0,
    recent
  };
}

function doAdminListUsers() {
  return readRows(SHEETS.USERS).map(u => ({
    userId: u.UserID, name: u.Name, mobile: u.Mobile, email: u.Email,
    paid: String(u.Paid) === "Yes", allowedAttempts: Number(u.AllowedAttempts) || 0,
    usedAttempts: Number(u.UsedAttempts) || 0, blocked: String(u.Blocked) === "Yes"
  }));
}
function doAdminResetAttempts(body) {
  updateRowByField(SHEETS.USERS, "UserID", body.userId, { UsedAttempts: 0 });
  return { updated: true };
}
function doAdminGrantAttempt(body) {
  const u = readRows(SHEETS.USERS).find(x => x.UserID === body.userId);
  if (!u) throw new Error("User not found.");
  updateRowByField(SHEETS.USERS, "UserID", body.userId, { AllowedAttempts: Number(u.AllowedAttempts) + 1 });
  return { updated: true };
}
function doAdminSetBlocked(body) {
  updateRowByField(SHEETS.USERS, "UserID", body.userId, { Blocked: body.blocked ? "Yes" : "No" });
  return { updated: true };
}

function doAdminListQuestions() {
  return readRows(SHEETS.QUESTIONS).map(q => ({
    qid: q.QID, question: q.Question, optionA: q.OptionA, optionB: q.OptionB,
    optionC: q.OptionC, optionD: q.OptionD, answer: q.Answer
  }));
}
function doAdminAddQuestion(body) {
  const qid = newId("Q");
  appendRow(SHEETS.QUESTIONS, {
    QID: qid, Question: body.question, OptionA: body.optionA, OptionB: body.optionB,
    OptionC: body.optionC, OptionD: body.optionD, Answer: body.answer, Marks: CFG.MARKS_PER_QUESTION
  }, ["QID","Question","OptionA","OptionB","OptionC","OptionD","Answer","Marks"]);
  return { qid };
}
function doAdminUpdateQuestion(body) {
  updateRowByField(SHEETS.QUESTIONS, "QID", body.qid, {
    Question: body.question, OptionA: body.optionA, OptionB: body.optionB,
    OptionC: body.optionC, OptionD: body.optionD, Answer: body.answer
  });
  return { updated: true };
}
function doAdminDeleteQuestion(body) {
  const sh = sheet(SHEETS.QUESTIONS);
  const values = sh.getDataRange().getValues();
  const qidCol = values[0].indexOf("QID");
  for (let r = 1; r < values.length; r++) {
    if (values[r][qidCol] === body.qid) { sh.deleteRow(r + 1); return { deleted: true }; }
  }
  throw new Error("Question not found.");
}

function doAdminListPayments() {
  const users = readRows(SHEETS.USERS);
  const payments = readRows(SHEETS.PAYMENTS).map(p => {
    const u = users.find(x => x.UserID === p.UserID);
    return { paymentId: p.PaymentID, name: u ? u.Name : p.UserID, amount: p.Amount, status: p.Status, date: p.Date };
  });
  const successCount = payments.filter(p => p.status === "Paid").length;
  const totalCollected = payments.filter(p => p.status === "Paid").reduce((s, p) => s + Number(p.amount), 0);
  const now = new Date();
  const thisMonth = payments.filter(p => {
    const d = new Date(p.date);
    return p.status === "Paid" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + Number(p.amount), 0);
  return { payments: payments.reverse(), successCount, totalCollected, thisMonth };
}

function doAdminListResults() {
  const users = readRows(SHEETS.USERS);
  const results = readRows(SHEETS.RESULTS).map(r => {
    const u = users.find(x => x.UserID === r.UserID);
    return { examId: r.ExamID, name: u ? u.Name : r.UserID, date: r.Date, score: r.Score, result: r.Result };
  });
  const passed = results.filter(r => r.result === "PASS").length;
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + Number(r.score), 0) / results.length) : 0;
  return { results: results.reverse(), total: results.length, passed, failed: results.length - passed, avgScore };
}
