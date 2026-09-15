import "./PageLoader.css";

export default function PageLoader({ label = "Loading" }) {
  return (
    <div className="page-loader" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21C5 16 2 12.5 2 8.5 2 5.5 4.3 3 7.2 3c2 0 3.6 1.1 4.8 2.8C13.2 4.1 14.8 3 16.8 3 19.7 3 22 5.5 22 8.5c0 4-3 7.5-10 12.5z" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
