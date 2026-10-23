// Owner, Oct 23: launching the app sat on a black screen while the server got the player ready. This shows at once
// (app/loading.tsx, app/home/loading.tsx): the wordmark over the New York skyline at night
// (public/loading-skyline.webp, darkened so the words read) and a spinning ring.
export function AppLoading({ text = "Loading the city…" }: { text?: string }) {
  return (
    <main className="app-loading" role="status" aria-live="polite">
      <h1 className="studio-mark welcome-mark">Clout City</h1>
      <span className="app-spinner" aria-hidden="true" />
      <p className="app-loading-text">{text}</p>
    </main>
  );
}
