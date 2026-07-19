/* ================================================================
   Setup.gs — run setupSheets() ONCE from the Apps Script editor
   (select the function in the dropdown, then click Run).
   Creates every sheet + header row + one default admin login.
   ================================================================ */

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetWithHeaders(ss, "Users",
    ["UserID","Name","Mobile","Email","PasswordHash","Salt","Paid","AllowedAttempts","UsedAttempts","Blocked","CreatedAt"]);

  createSheetWithHeaders(ss, "Questions",
    ["QID","Question","OptionA","OptionB","OptionC","OptionD","Answer","Marks"]);

  createSheetWithHeaders(ss, "Results",
    ["ExamID","UserID","SessionId","Date","Score","Correct","Wrong","Result","AttemptNumber","TimeTakenMinutes"]);

  createSheetWithHeaders(ss, "Payments",
    ["PaymentID","UserID","Amount","Status","Date","RazorpayOrderId","RazorpayPaymentId"]);

  createSheetWithHeaders(ss, "Sessions",
    ["SessionId","UserID","QuestionIds","AnswerKey","StartTime","Used"]);

  createSheetWithHeaders(ss, "AdminUsers",
    ["AdminID","Name","Mobile","PasswordHash","Salt"]);

  createSheetWithHeaders(ss, "ContactMessages",
    ["Date","Name","Email","Message"]);

  // Remove the default blank "Sheet1" if it's still empty
  const blank = ss.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0) ss.deleteSheet(blank);

  seedDefaultAdmin(ss);

  // If QuestionsData.gs (the full 600-question bank) has been added to this
  // project, import it automatically. Otherwise fall back to 10 sample
  // questions so the exam flow can still be tested.
  if (typeof bulkImportQuestions === "function") {
    bulkImportQuestions();
  } else {
    seedSampleQuestions(ss);
  }

  SpreadsheetApp.flush();
  Logger.log("Setup complete. Default admin: mobile 9999999999 / password Admin@123 — change this immediately.");
}

function createSheetWithHeaders(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0F2A3D").setFontColor("#FFFFFF");
  }
}

function seedDefaultAdmin(ss) {
  const sh = ss.getSheetByName("AdminUsers");
  if (sh.getLastRow() > 1) return; // already seeded
  const salt = Utilities.getUuid();
  const password = "Admin@123";
  const hash = hashPassword(password, salt);
  sh.appendRow(["A0001", "Portal Admin", "9999999999", hash, salt]);
}

// Adds a handful of real sample questions so the exam engine can be tested
// immediately. Replace/expand these by editing the Questions sheet directly
// (or use the admin Questions page) until you reach 600 questions — the
// engine works with any number of questions as long as it's >= 50.
function seedSampleQuestions(ss) {
  const sh = ss.getSheetByName("Questions");
  if (sh.getLastRow() > 1) return; // already seeded

  const samples = [
    ["What does RERA stand for?", "Real Estate Regulation Act", "Real Estate Regulatory Authority", "Real Estate Registration Agency", "Rural Estate Regulatory Authority", "B"],
    ["The Real Estate (Regulation and Development) Act was enacted in which year?", "2014", "2015", "2016", "2017", "C"],
    ["Under MahaRERA, a real estate agent must register if they facilitate the sale of a property in which state?", "Any state in India", "Only Maharashtra", "Only Mumbai", "Only Pune", "B"],
    ["What is the validity period of a MahaRERA agent registration certificate?", "1 year", "3 years", "5 years", "Lifetime", "C"],
    ["Under RERA, what percentage of project funds must be kept in a separate escrow account?", "50%", "60%", "70%", "100%", "C"],
    ["Who is the regulatory authority for real estate in Maharashtra?", "MahaRERA", "MHADA", "CIDCO", "SRA", "A"],
    ["An agent who violates RERA provisions is liable to a penalty of up to how much per day?", "₹1,000", "₹5,000", "₹10,000", "₹25,000", "C"],
    ["RERA primarily aims to protect the interests of whom?", "Builders", "Homebuyers", "Banks", "Contractors", "B"],
    ["What must a promoter deposit before advertising a project under RERA?", "Nothing", "A registration application with MahaRERA", "A bank guarantee only", "A tax return", "B"],
    ["Can an unregistered agent legally facilitate a real estate transaction under RERA?", "Yes, always", "No", "Only for resale property", "Only with a lawyer present", "B"]
  ];
  samples.forEach((s, i) => {
    sh.appendRow(["Q" + String(i + 1).padStart(4, "0"), s[0], s[1], s[2], s[3], s[4], s[5], 2]);
  });
  Logger.log("Seeded " + samples.length + " sample questions. Add more via the Questions sheet or admin panel until you have 600 (minimum 50 required to run a test).");
}

/**
 * One-time helper: run this from the Apps Script editor after pasting your
 * Razorpay keys, so payments work. You can also set these under
 * Project Settings > Script Properties in the Apps Script UI instead.
 */
function setRazorpayKeys() {
  PropertiesService.getScriptProperties().setProperties({
    RAZORPAY_KEY_ID: "PASTE_YOUR_RAZORPAY_KEY_ID",
    RAZORPAY_KEY_SECRET: "PASTE_YOUR_RAZORPAY_KEY_SECRET"
  });
  Logger.log("Razorpay keys saved to Script Properties.");
}
