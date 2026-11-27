// What a browser sees while the website is closed (src/lib/siteClosed.js). No API calls, no
// session, nothing private: just a quiet lilac page. The iPhone app never shows it.
export default function ClosedPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "radial-gradient(circle at 50% 35%, #fbf6fd 0%, #f2ebf7 55%, #e9dcf2 100%)",
        color: "#5d4470",
        textAlign: "center",
      }}
    >
      <div>
        <p style={{ margin: 0, font: "400 52px/1.1 'Parisienne', cursive" }}>kiriya</p>
        <p style={{ margin: "14px 0 0", font: "700 20px/1.4 var(--font-hand, 'Gaegu', cursive)" }}>this little world is resting for now ♡</p>
      </div>
    </main>
  );
}
