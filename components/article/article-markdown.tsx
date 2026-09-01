import Image from 'next/image';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

function safeLinkHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (href.startsWith('#')) return href;
  return undefined;
}

function safeMediaPath(src: string | undefined): src is string {
  return Boolean(src && /^\/media\/articles\/[a-z0-9][a-z0-9_./-]*$/i.test(src) && !src.includes('..'));
}

const markdownComponents: Components = {
  h1: ({ children }) => <h2>{children}</h2>,
  a: ({ children, href }) => {
    const safeHref = safeLinkHref(href);
    if (!safeHref) return <span className="article-unsafe-link">{children}</span>;

    const external = /^https?:\/\//i.test(safeHref);
    return (
      <a href={safeHref} rel={external ? 'noopener noreferrer' : undefined}>
        {children}
      </a>
    );
  },
  img: ({ alt = '', src }) => {
    const path = typeof src === 'string' ? src : undefined;
    if (!safeMediaPath(path)) {
      return <span className="article-unsafe-media" role="note">Unsafe media path omitted.</span>;
    }

    return (
      <Image
        alt={alt}
        className="article-markdown-image"
        height={675}
        sizes="(max-width: 760px) 100vw, 760px"
        src={path}
        width={1200}
      />
    );
  },
  table: ({ children }) => (
    <div className="article-table-wrap" role="region" aria-label="Scrollable article table" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
};

export default function ArticleMarkdown({ body }: { body: string }) {
  return (
    <div className="article-markdown">
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} skipHtml>
        {body}
      </ReactMarkdown>
    </div>
  );
}
