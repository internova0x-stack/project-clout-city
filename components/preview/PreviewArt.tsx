import { PlaceArt } from "@/components/city/PlaceArt";
import { PlaceArtMV } from "@/components/city/PlaceArtMV";
import { PLACES } from "@/lib/city";

// Development previews only: every location illustration side by side.
export function PreviewArt() {
  return (
    <main style={{ background: "var(--surface-sheet)", color: "var(--text-1)", minHeight: "100dvh", padding: 16, overflowY: "auto", position: "fixed", inset: 0 }}>
      <h1 className="display-md" style={{ margin: "8px 0 16px" }}>Location illustrations</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {PLACES.map((p) => (
          <section key={p.id} className="card stack-8">
            <span className="title">{p.name}</span>
            <span className="overline">Current</span>
            <PlaceArt place={p} daytime />
            <span className="overline">Monument Valley · day</span>
            <PlaceArtMV place={p} daytime />
            <span className="overline">Monument Valley · night</span>
            <PlaceArtMV place={p} daytime={false} />
          </section>
        ))}
      </div>
    </main>
  );
}
