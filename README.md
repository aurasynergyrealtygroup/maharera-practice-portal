# MahaRERA Practice Test Portal

A full practice-exam portal: register → pay ₹600 → sit timed 50-question mocks (5 attempts) → instant scoring → admin panel.

**Stack:** static HTML/CSS/JS frontend (deploy anywhere, e.g. Cloudflare Pages) + Google Apps Script backend + Google Sheets as the database + Razorpay for payment.

---

## 1. Set up the Google Sheet + backend

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet. Name it e.g. **MahaRERA Practice DB**.
2. In the sheet, open **Extensions → Apps Script**. This opens the script editor bound to your sheet.
3. Delete the default `Code.gs` content. Create **three** script files matching the files in the `gas/` folder of this project:
   - `Code.gs` — paste the contents of `gas/Code.gs`
   - `Setup.gs` — paste the contents of `gas/Setup.gs`
   - `QuestionsData.gs` — paste the contents of `gas/QuestionsData.gs` (this is the full 600-question MahaRERA bank, extracted from the source PDF, already formatted as question + 4 options + correct answer)
4. In the Apps Script editor, select the function dropdown at the top, choose **setupSheets**, and click **Run**. Approve the permission prompts (this script only touches the spreadsheet it's bound to).
   - This creates all required sheets (`Users`, `Questions`, `Results`, `Payments`, `Sessions`, `AdminUsers`, `ContactMessages`) with headers.
   - It seeds **one default admin login**: mobile `9999999999`, password `Admin@123`. **Change this password immediately** after your first admin login (there's no "change admin password" UI yet — edit the `AdminUsers` sheet's `PasswordHash`/`Salt` by re-running a small script, or just treat this as a placeholder and restrict who has the sheet).
   - Because `QuestionsData.gs` is present, `setupSheets()` automatically runs `bulkImportQuestions()` for you — all **600 questions with their options and correct answers** are written into the `Questions` sheet in one batch. (If you ever need to re-import — e.g. after editing the source data — just run `bulkImportQuestions()` again from the function dropdown; it clears and rewrites the sheet, so it's safe to re-run.)
   - Prefer to load questions by hand instead? Skip `QuestionsData.gs` and paste `gas/questions_600.csv` (also included in this package) directly into the `Questions` sheet via **File → Import → Insert new sheet**, then copy the rows into `Questions`, or add/edit through **Admin → Questions** on the site. The exam engine works with any bank size ≥ 25 questions.
5. **Deploy the web app:** top-right **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize again if asked, and copy the **Web app URL** (ends in `/exec`).

## 2. Connect the frontend to the backend

Open `js/app.js` and paste your Apps Script URL:

```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXXXXXX/exec",
  ...
};
```

## 3. Set up Razorpay (payments)

1. Create a [Razorpay](https://razorpay.com) account and grab your **Key ID** and **Key Secret** from Settings → API Keys.
2. In `js/app.js`, set `RAZORPAY_KEY` to your **Key ID** (public, safe for the browser).
3. In the Apps Script editor, open `Setup.gs`, paste your Key ID and Key Secret into `setRazorpayKeys()`, and run that function once from the editor — this stores them securely as Script Properties (never exposed to the browser). You can also set them under **Project Settings → Script Properties** directly instead.

Without this step, `pricing.html` will show "Payments are not configured yet."

## 4. Deploy the frontend (Cloudflare Pages)

1. Push this folder to a GitHub repository (everything **except** the `gas/` folder needs to be servable — you can leave `gas/` in the repo, it's just not linked from any page).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick the repo.
3. Build settings: **no build command**, output directory `/` (this is a static site, nothing to build).
4. Deploy. Cloudflare gives you a `*.pages.dev` URL immediately; add a custom domain under the project's **Custom domains** tab if you have one.

That's it — hosting is free, SSL is automatic.

## 5. Admin panel

Visit `/admin/login.html` on your deployed site. Default login: mobile `9999999999`, password `Admin@123`.

From there you can manage:
- **Users** — view accounts, reset/grant attempts, block/unblock
- **Questions** — add, edit, delete (or bulk-edit the `Questions` sheet directly)
- **Payments** — view and export payment history
- **Results** — pass/fail analytics, export CSV

## 6. Exam rules (all configurable)

| Setting | Value | Where to change |
|---|---|---|
| Question bank size | 600 (global pool) | `gas/QuestionsData.gs` / `Questions` sheet |
| Questions per attempt | 25, randomly drawn from the full 600-question bank each time | `CFG.TOTAL_QUESTIONS` in `Code.gs` and `CONFIG.TOTAL_QUESTIONS` in `js/app.js` |
| Marks per question | 2 | `CFG.MARKS_PER_QUESTION` |
| Maximum score | 50 | derived: `TOTAL_QUESTIONS × MARKS_PER_QUESTION` |
| Passing score | 20 / 50 (40%) | `CFG.PASS_MARKS` |
| Time limit | 60 minutes | `CFG.TIME_LIMIT_MINUTES` |
| Attempts per user (after payment) | 5 | `CFG.DEFAULT_ATTEMPTS_ON_PAYMENT` |
| Fee | ₹600 | `CFG.EXAM_FEE_PAISE` and `CONFIG.EXAM_FEE_INR` |

**How the 25-from-600 selection works:** `doStartExam()` in `Code.gs` reads every row of the `Questions` sheet — the entire global bank, start to end — shuffles it, and takes the first 25. So each attempt is a fresh, independent random draw from all 600 questions, not from a fixed slice or a rotating block.

Keep the two copies (`Code.gs` server-side, `app.js` client-side) in sync — the server is the source of truth for scoring; the client copy is only used for display text.

## 7. Folder structure

```
maharera-practice/
├── index.html            Homepage
├── register.html          Sign up
├── login.html              Sign in
├── dashboard.html          User dashboard, attempt history
├── exam.html                Timed 50-question test
├── result.html               Score + pass/fail
├── pricing.html              ₹600 checkout (Razorpay)
├── profile.html               Account + change password
├── contact.html                 Contact form
├── admin/
│   ├── login.html
│   ├── dashboard.html      Overview stats
│   ├── users.html            User management
│   ├── questions.html         Question bank CRUD
│   ├── payments.html           Payment history
│   └── results.html             Results & analytics
├── css/style.css             Shared design system
├── js/
│   ├── app.js                  Config + API helper (EDIT THIS FIRST)
│   ├── auth.js                  Register/login forms
│   ├── dashboard.js               Dashboard data
│   ├── exam.js                     Exam engine (timer, navigation, submit)
│   ├── payment.js                   Razorpay checkout
│   └── admin.js                      Admin session helpers
└── gas/
    ├── Code.gs               Backend API (paste into Apps Script)
    ├── Setup.gs                One-time sheet + admin + question import
    ├── QuestionsData.gs          Full 600-question bank (paste into Apps Script)
    └── questions_600.csv           Same 600 questions, for manual sheet import
```

## 8. Security notes

- Passwords are stored as salted SHA-256 hashes, never plaintext.
- Session tokens are stateless HMAC-signed strings (no session sheet to manage) and expire after 7 days (users) / 1 day (admin).
- Exam answer keys never reach the browser — only question text and options are sent; scoring happens entirely server-side in `Code.gs`.
- Payment amounts are set server-side (`CFG.EXAM_FEE_PAISE`) and verified via Razorpay's HMAC signature — the browser cannot alter the charged amount.
- The default admin password (`Admin@123`) is a placeholder. Treat the spreadsheet itself as sensitive (it holds password hashes) and don't share edit access broadly.
