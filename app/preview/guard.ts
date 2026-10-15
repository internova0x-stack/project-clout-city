// Preview server actions work on in-memory sample data, but server actions can be called by id even
// when the preview pages 404, so each one refuses in production (0049 hardening, owner Oct 15).
export function previewOnly(): void {
  if (process.env.NODE_ENV === "production") throw new Error("Previews are off in production.");
}
