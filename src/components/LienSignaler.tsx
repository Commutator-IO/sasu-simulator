import { lienNouvelleIssue } from '../lib/depot';

/**
 * "Report an error" link, prefilled with the current page's simulation link so
 * the maintainer can reproduce it without the reporter having to describe their
 * inputs. The URL is read at click time, so it always reflects the state shown
 * at that moment — not whatever it was when the footer first rendered.
 */
export function LienSignaler({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const construire = () =>
    lienNouvelleIssue(typeof window === 'undefined' ? undefined : window.location.href);

  return (
    <a
      href={construire()}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={(e) => {
        e.currentTarget.href = construire();
      }}
    >
      {children}
    </a>
  );
}
