import { useT } from '../lib/i18n';

const LINKS = [
  { key: 'footer.links.bedrockDocs', href: 'https://bedrock.dev' },
  { key: 'footer.contact.github', href: 'https://github.com/MemoriesOfTime/Json-UI-Editor' },
  { key: 'footer.links.mot', href: 'https://mot.dev/' },
] as const;

export function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="mc-footer" role="contentinfo">
      <div className="mc-footer-inner">
        <span className="mc-footer-copy">
          {t('footer.copyright', { year: String(year) })}
        </span>

        <nav aria-label={t('footer.links')}>
          <ul className="mc-footer-list" role="list">
            {LINKS.map((link) => (
              <li key={link.key}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mc-footer-link"
                >
                  {t(link.key)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
