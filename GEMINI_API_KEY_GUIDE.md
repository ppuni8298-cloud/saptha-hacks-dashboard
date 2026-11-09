# Quick Guide: How to Get Your Free Google Gemini API Key

Follow these quick steps to get your Gemini API Key and connect **Gemini 3.1 Flash Lite** to this project.

---

## Direct Link
Click or open this link in your browser:  
👉 **[https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)**

---

## 3 Quick Steps

### 1. Sign in to Google AI Studio
- Open [aistudio.google.com/apikey](https://aistudio.google.com/apikey) in Chrome or any browser.
- Sign in with your standard Google / Gmail account.
- *(It is completely free — no billing or credit card required).*

### 2. Generate the Key
- Click the blue button labeled **"Create API key"** (or "+ Get API Key").
- Select **"Create API key in new project"** (creates one automatically with 1 click).
- Click **Copy** to copy the generated key string (it starts with `AIzaSy...`).

### 3. Paste into `.env`
- Open the `.env` file in this project: [`.env`](.env)
- Look for `GEMINI_API_KEY=""` and paste your key inside the quotation marks:
  ```env
  GEMINI_API_KEY="AIzaSyYourGeneratedApiKeyHere"
  ```
- Save the file (`Ctrl + S`).

---

## Test & Verify Connection

1. Start your local dev server:
   ```powershell
   pnpm dev
   ```
2. In the web app, go to **Settings** in the left menu.
3. Click the **"Test Gemini 3.1 Flash Lite Connection"** button.
4. You will see a green confirmation with your latency (e.g., `210 ms`).

