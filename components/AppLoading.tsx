import { LoadingTip } from "./LoadingTip";

// Owner, Oct 23-24: launching the app sat on a black screen while the server got the player ready. This is the
// launch splash (app/page.tsx's Suspense fallback, and the iPhone launch images). Owner, Oct 28: the poster (the cast
// under the wordmark and "Arrive in NY a nobody. Pretend to be somebody.", public/loading-poster.webp), drifting slowly;
// the spinner and Mayor Papa-Dani's tips sit over the cast at the bottom. `still` (the iPhone launch images) leaves both out.
export function AppLoading({ text = "Loading the city…", still = false }: { text?: string; still?: boolean }) {
  return (
    <main className={`app-loading${still ? " still" : ""}`} role="status" aria-live="polite">
      <h1 className="studio-mark welcome-mark">Clout City</h1>
      {!still && (
        <>
          <div className="app-loading-status">
            <span className="app-spinner" aria-hidden="true" />
            <p className="app-loading-text">{text}</p>
          </div>
          <LoadingTip />
        </>
      )}
    </main>
  );
}
