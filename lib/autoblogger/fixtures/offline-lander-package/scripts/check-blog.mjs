import assert from 'node:assert/strict';
import { getAllArticles, getVisibleArticles } from '../app/lib/articles.ts';

const articles = getAllArticles();
assert.equal(articles.length, 1, 'Validate the inserted draft, never an empty content directory');
assert.equal(articles[0].status, 'review');
assert.equal(getVisibleArticles({ env: { VERCEL_ENV: 'preview' } }).length, 1);
assert.equal(getVisibleArticles({ env: { VERCEL_ENV: 'production' } }).length, 0);
console.log('Native lander contract accepted 1 review article');
