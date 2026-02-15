declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = "6Lc3uWwsAAAAAG2ZYfb28rydWGFV_oZ5IvcTNA7k";

export function useRecaptcha() {
  const executeRecaptcha = async (action: string): Promise<string | null> => {
    try {
      if (!window.grecaptcha) {
        console.warn("reCAPTCHA not loaded");
        return null;
      }

      return new Promise((resolve) => {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(SITE_KEY, { action });
            resolve(token);
          } catch (err) {
            console.error("reCAPTCHA execute error:", err);
            resolve(null);
          }
        });
      });
    } catch (err) {
      console.error("reCAPTCHA error:", err);
      return null;
    }
  };

  return { executeRecaptcha };
}
