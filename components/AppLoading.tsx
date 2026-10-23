import { LoadingTip } from "./LoadingTip";

// Owner, Oct 23: launching the app sat on a black screen while the server got the player ready. This shows at once
// (app/loading.tsx, app/home/loading.tsx): Queens at night in the game's own style with Manhattan on the horizon
// (public/loading-skyline.webp, made with Higgsfield for Clout City), drifting slowly; the wordmark and a spinning ring
// sit in the empty sky, Mayor Papa-Dani's tips at the bottom. `still` (the iPhone launch images) leaves both out.
export function AppLoading({ text = "Loading the city…", still = false }: { text?: string; still?: boolean }) {
  return (
    <main className={`app-loading${still ? " still" : ""}`} role="status" aria-live="polite">
      <h1 className="studio-mark welcome-mark">Clout City</h1>
      {!still && (
        <>
          <span className="app-spinner" aria-hidden="true" />
          <p className="app-loading-text">{text}</p>
          <LoadingTip />
        </>
      )}
    </main>
  );
}
