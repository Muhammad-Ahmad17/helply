// The embed/ layout is intentionally minimal — no nav, no header.
// This is what renders inside the host site's iframe.
// We use a wrapper div instead of html/body to avoid hydration conflicts
// with the root layout.
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ margin: 0, padding: 0, background: "#fff", color: "#0a0a0a", minHeight: "100vh" }}>
      {children}
    </div>
  );
}
