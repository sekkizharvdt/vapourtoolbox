/** Module-level cache — shared across all PDF dialogs in the same browser session */
let cachedLogoDataUri: string | null = null;

/** Fetch /logo.png and return it as a base64 data URI for @react-pdf/renderer */
export async function fetchLogoAsDataUri(): Promise<string | undefined> {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) {
      console.warn(
        `[logoUtils] Failed to fetch /logo.png: ${response.status} ${response.statusText}`
      );
      return undefined;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoDataUri = reader.result as string;
        resolve(cachedLogoDataUri);
      };
      reader.onerror = () => {
        console.warn('[logoUtils] FileReader failed to read logo blob');
        resolve(undefined);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[logoUtils] Error fetching logo:', err);
    return undefined;
  }
}
