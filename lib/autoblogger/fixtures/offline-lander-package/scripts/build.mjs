import { mkdir, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getVisibleArticles } from '../app/lib/articles.ts';

const previews = getVisibleArticles({ env: { VERCEL_ENV: 'preview' } });
const publicArticles = getVisibleArticles({ env: { VERCEL_ENV: 'production' } });
await mkdir('dist/preview', { recursive: true });
for (const article of previews) {
  const html = renderToStaticMarkup(createElement(Markdown, { remarkPlugins: [remarkGfm] }, article.body));
  await writeFile('dist/preview/' + article.slug + '.html', html);
}
await writeFile('dist/public-routes.json', JSON.stringify(publicArticles.map(({ canonicalPath }) => canonicalPath)));
console.log('Built ' + previews.length + ' preview page; ' + publicArticles.length + ' public article routes');
