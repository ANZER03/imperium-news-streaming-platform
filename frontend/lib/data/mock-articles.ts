import { Article } from '../types';

const NOW = Math.floor(Date.now() / 1000);
const h = (n: number) => NOW - n * 3600;

export const mockArticles: Article[] = [
  {
    id: '1',
    title: 'SpaceX launches next-gen rocket in historic mission',
    excerpt: 'The Starship successfully completed its maiden voyage, marking a new era in space exploration.',
    topic: 'science_technology',
    imageUrl: 'https://picsum.photos/seed/rocketstory/960/620',
    publishedAt: h(2),
    sourceName: 'Space News',
    content: 'The Starship successfully completed its maiden voyage today, marking a new era in space exploration.',
  },
  {
    id: '2',
    title: 'Global markets rally as inflation eases and investors expect rate cuts later this year',
    excerpt: 'Stocks soared following positive reports from central banking authorities.',
    topic: 'business_economy',
    publishedAt: h(1),
    sourceName: 'Financial Times',
    content: 'Global markets experienced a huge surge today following reports that inflation is beginning to ease across major economies.',
  },
  {
    id: '3',
    title: 'Apple unveils iOS 18 with AI-powered features',
    excerpt: 'New update brings personalized AI, enhanced privacy, and more customization.',
    topic: 'science_technology',
    imageUrl: 'https://picsum.photos/seed/iphonenews/960/620',
    publishedAt: h(1),
    sourceName: 'TechCrunch',
    content: 'At their annual developer conference, Apple unveiled iOS 18, putting AI at the forefront of the mobile experience.',
  },
  {
    id: '4',
    title: 'Climate summit agrees on historic climate fund',
    excerpt: 'Nations commit $100B to support vulnerable countries.',
    topic: 'environment_weather',
    publishedAt: h(3),
    sourceName: 'Reuters',
    content: 'After weeks of intense negotiations, world leaders have agreed to establish a $100 billion climate fund.',
  },
  {
    id: '5',
    title: 'Real Madrid advances to Champions League final',
    excerpt: 'A dramatic night at the Bernabeu seals their spot in the final.',
    topic: 'sports',
    imageUrl: 'https://picsum.photos/seed/footballnews/960/620',
    publishedAt: h(4),
    sourceName: 'ESPN',
    content: 'Real Madrid secured their place in the Champions League final with a stunning comeback victory.',
  },
  {
    id: '6',
    title: 'NASA discovers new exoplanet that could support life',
    excerpt: 'The planet, Kepler-452b, is located in the habitable zone of its star.',
    topic: 'science_technology',
    publishedAt: h(5),
    sourceName: 'NASA',
  },
  {
    id: '7',
    title: 'New education policy aims to modernize schools',
    excerpt: 'The policy focuses on digital learning and skill development.',
    topic: 'education',
    publishedAt: h(6),
    sourceName: 'BBC',
  },
];
