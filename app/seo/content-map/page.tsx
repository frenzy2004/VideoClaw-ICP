import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { getAllArticles, validateArticleLibrary } from '../../../lib/content/articles';
import { ContentMap } from './content-map';

export const metadata: Metadata = {
  title: 'SEO Content Map | VideoClaw',
  description: 'Private operational inventory for VideoClaw SEO, AEO, and GEO article campaigns.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ContentMapPage() {
  const records = getAllArticles();
  const globalIndexingEnabled = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING === 'true';
  const targetAdvisories = validateArticleLibrary(records).advisories;
  const existingAssetPaths = Array.from(new Set(records.flatMap((record) => (
    record.frontmatter.media
      .map((media) => media.src)
      .filter((src) => existsSync(join(process.cwd(), 'public', src.replace(/^\//, ''))))
  ))));

  return (
    <ContentMap
      existingAssetPaths={existingAssetPaths}
      globalIndexingEnabled={globalIndexingEnabled}
      records={records}
      targetAdvisories={targetAdvisories}
    />
  );
}
