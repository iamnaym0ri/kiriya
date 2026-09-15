import { useEffect, useId, useRef } from "react";

export function Icon({ name = "arrow", size = 20, ...props }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    diagonal: <path d="M6 18 18 6M6 6h12v12" />,
    play: <path d="m9 5 11 7-11 7z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </>
    ),
    heart: (
      <path d="M12 20S3 14 3 8.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 1.5C21 14 12 20 12 20Z" />
    ),
    star: (
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
    ),
    music: (
      <>
        <path d="M9 17V5l11-2v12M9 8l11-2" />
        <ellipse cx="6" cy="18" rx="3" ry="2" />
        <ellipse cx="17" cy="16" rx="3" ry="2" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="15" cy="17" r="3" />
      </>
    ),
    pen: (
      <>
        <path d="m4 16-1 5 5-1L20 8l-4-4Z M13 7l4 4" />
      </>
    ),
    chevron: <path d="m8 5 7 7-7 7" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] ?? paths.arrow}
    </svg>
  );
}

export function Star({ className = "", ...props }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 40 40"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M20 0c2 15 5 18 20 20-15 2-18 5-20 20C18 25 15 22 0 20 15 18 18 15 20 0Z" />
    </svg>
  );
}

export function Modal({ children, onClose, title, className = "" }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`world-dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="world-dialog__inside">
        <header className="world-dialog__head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Picture({
  name,
  alt,
  className = "",
  eager = false,
  ...props
}) {
  return (
    <img
      src={`/images/${name}.webp`}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      {...props}
    />
  );
}

export function Credits({ onClose }) {
  return (
    <Modal
      title="A few thank-yous"
      onClose={onClose}
      className="credits-dialog"
    >
      <p>
        A personal, noncommercial gift. The character illustrations celebrate
        the worlds Kiriya loves.
      </p>
      <h3>Character illustrations</h3>
      {["Hatsune Miku", "Kagamine Rin", "Kagamine Len"].map((name) => (
        <p key={name}>
          {name} by{" "}
          <a
            href="https://piapro.net/intl/en_for_creators.html"
            target="_blank"
            rel="noreferrer"
          >
            Crypton Future Media, INC. 2007
          </a>{" "}
          is licensed under a{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc/3.0/"
            target="_blank"
            rel="noreferrer"
          >
            Creative Commons Attribution-NonCommercial 3.0 Unported License
          </a>
          . Based on a work at{" "}
          <a href="https://piapro.net/license" target="_blank" rel="noreferrer">
            piapro.net/license
          </a>
          . Images resized and framed.
        </p>
      ))}
      <h3>Reference collection</h3>
      <p>
        Maomao portraits and botanical images are from the supplied reference
        collection. The dramatic portrait retains its Yen123412 marks; original
        authorship has not been verified.
      </p>
      <p>
        Costume process photograph:{" "}
        <a
          href="https://sajalyn.com/wickelrock-hanfu-naehen-mein-cosplay-fuer-die-tagebuecher-der-apothekerin/"
          target="_blank"
          rel="noreferrer"
        >
          SajaLyn
        </a>
        . External reference, not Kiriya’s costume.
      </p>
      <p>
        Music metadata:{" "}
        <a href="https://vocadb.net" target="_blank" rel="noreferrer">
          VocaDB
        </a>
        . Music belongs to its credited creators and plays through the original
        providers. The small mascot and stickers are fan-inspired illustrations.
      </p>
    </Modal>
  );
}
