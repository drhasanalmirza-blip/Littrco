const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const SCORE_THRESHOLD = 0.5;

export async function verifyRecaptcha(token: string | undefined, action: string): Promise<{ success: boolean; score?: number; error?: string }> {
  if (!RECAPTCHA_SECRET) {
    console.warn("RECAPTCHA_SECRET_KEY not configured, skipping verification");
    return { success: true };
  }

  if (!token) {
    console.warn(`reCAPTCHA token missing for action: ${action} — allowing through`);
    return { success: true };
  }

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`,
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: "reCAPTCHA verification failed" };
    }

    if (data.action && data.action !== action) {
      return { success: false, error: "reCAPTCHA action mismatch" };
    }

    if (data.score !== undefined && data.score < SCORE_THRESHOLD) {
      return { success: false, score: data.score, error: "Request blocked by spam protection" };
    }

    return { success: true, score: data.score };
  } catch (err) {
    console.error("reCAPTCHA verification error:", err);
    return { success: true };
  }
}
