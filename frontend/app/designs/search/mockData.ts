export interface Article {
  id: string;
  title: string;
  excerpt: string;
  topic: string;
  sourceName: string;
  publishedAt: Date;
  imageUrl: string;
  author: string;
  sentiment?: 'Positive' | 'Neutral' | 'Negative';
  threatLevel?: 'Low' | 'Elevated' | 'Critical';
  entities?: string[];
}

export const mockArticles: Article[] = [
  {
    id: 's1',
    title: 'AI Studio Launches Gemini 3.5 Flash for Real-Time App Streaming',
    excerpt: 'Google DeepMind reveals the next generation of fast inference models, cutting latency by 45% for edge streaming devices.',
    topic: 'Technology',
    sourceName: 'TechCrunch',
    publishedAt: new Date(Date.now() - 4 * 3600 * 1000), // 4h ago
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=400&q=80',
    author: 'Elena Rostova',
    sentiment: 'Positive',
    threatLevel: 'Low',
    entities: ['Google', 'DeepMind', 'Gemini']
  },
  {
    id: 's2',
    title: 'Global Markets Dip Amid Unexpected Inflation Reports',
    excerpt: 'Stock indices in New York and London registered a minor downturn after consumer price indicators came in slightly above estimates.',
    topic: 'Business & Economy',
    sourceName: 'Reuters',
    publishedAt: new Date(Date.now() - 18 * 3600 * 1000), // 18h ago
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80',
    author: 'Sarah Mitchell',
    sentiment: 'Negative',
    threatLevel: 'Elevated',
    entities: ['New York', 'London', 'Federal Reserve']
  },
  {
    id: 's3',
    title: 'Renewable Power Reaches Record 40% Share of EU Energy Grid',
    excerpt: 'A combination of offshore wind expansion and solar cell efficiency gains pushes Europe ahead of its 2030 climate goals.',
    topic: 'Environment',
    sourceName: 'Le Monde',
    publishedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000), // 2 days ago
    imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&q=80',
    author: 'Pierre Dubois',
    sentiment: 'Positive',
    threatLevel: 'Low',
    entities: ['EU', 'Europe', 'Climate']
  },
  {
    id: 's4',
    title: 'Deep Space Telescope Captures High-Res Atmosphere of Trappist-1e',
    excerpt: 'Spectroscopic analysis suggests the presence of water vapor and carbon dioxide on the temperate rocky exoplanet.',
    topic: 'Science & Space',
    sourceName: 'NASA Spaceflight',
    publishedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000), // 6 days ago
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
    author: 'Dr. Marcus Vance',
    sentiment: 'Neutral',
    threatLevel: 'Low',
    entities: ['Trappist-1e', 'NASA', 'James Webb']
  },
  {
    id: 's5',
    title: 'Championship Finals Ends in Dramatic Double Overtime Shootout',
    excerpt: 'The underdogs clinch their first national trophy in thirty years after a nail-biting penalty shootout.',
    topic: 'Sports',
    sourceName: 'ESPN',
    publishedAt: new Date(Date.now() - 12 * 24 * 3600 * 1000), // 12 days ago
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&q=80',
    author: 'Jack Gallagher',
    sentiment: 'Positive',
    threatLevel: 'Low',
    entities: ['ESPN', 'National Finals']
  },
  {
    id: 's6',
    title: 'Modernist Museum Architecture Unveiled in Kyoto Forest',
    excerpt: 'Designed by Kengo Kuma associates, the new gallery merges seamlessly with bamboo gardens and natural water streams.',
    topic: 'Arts & Culture',
    sourceName: 'Architectural Digest',
    publishedAt: new Date(Date.now() - 28 * 24 * 3600 * 1000), // 28 days ago
    imageUrl: 'https://images.unsplash.com/photo-1508333706533-1ab43ecb1606?w=400&q=80',
    author: 'Yuki Sato',
    sentiment: 'Positive',
    threatLevel: 'Low',
    entities: ['Kyoto', 'Kengo Kuma', 'Japan']
  },
  {
    id: 's7',
    title: 'Bestselling Novelist Announces Surprise Sequel to Acclaimed Debut',
    excerpt: 'Ten years after the release of "The Silent Tide", the author reveals a manuscript has been completed.',
    topic: 'Arts & Culture',
    sourceName: 'The Guardian',
    publishedAt: new Date(Date.now() - 45 * 24 * 3600 * 1000), // 45 days ago
    imageUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80',
    author: 'Clara Oswald',
    sentiment: 'Positive',
    threatLevel: 'Low',
    entities: ['The Silent Tide', 'London']
  },
  {
    id: 's8',
    title: 'Quantum Computing Startups Secure $500M in Joint Venture Funding',
    excerpt: 'Three leading labs join forces to build a fault-tolerant logical qubit system ready for commercial deployment.',
    topic: 'Technology',
    sourceName: 'VentureBeat',
    publishedAt: new Date(Date.now() - 120 * 24 * 3600 * 1000), // ~4 months ago
    imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80',
    author: 'Devon Patel',
    sentiment: 'Neutral',
    threatLevel: 'Elevated',
    entities: ['Silicon Valley', 'Venture Capital', 'Qubit']
  },
  {
    id: 's9',
    title: 'Archaeologists Uncover Lost Roman Outpost in Bavarian Alps',
    excerpt: 'Excavation reveals coins, military armor, and a preserved stone wall dating back to the Emperor Claudius era.',
    topic: 'Science & Space',
    sourceName: 'National Geographic',
    publishedAt: new Date(Date.now() - 220 * 24 * 3600 * 1000), // ~7 months ago
    imageUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&q=80',
    author: 'Clara Oswald',
    sentiment: 'Neutral',
    threatLevel: 'Low',
    entities: ['Bavarian Alps', 'Roman Empire', 'Claudius']
  },
  {
    id: 's10',
    title: 'Global Cybersecurity Threat Detected in Major Financial Hubs',
    excerpt: 'A coordinated cyberattack has temporarily disrupted banking operations across London, Frankfurt, and New York.',
    topic: 'Technology',
    sourceName: 'BBC Future',
    publishedAt: new Date(Date.now() - 400 * 24 * 3600 * 1000), // ~1.1 years ago
    imageUrl: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400&q=80',
    author: 'Liam Davies',
    sentiment: 'Negative',
    threatLevel: 'Critical',
    entities: ['London', 'Frankfurt', 'New York', 'Cybersecurity']
  }
];

export const mockRecentSearches = [
  'Artificial Intelligence',
  'Inflation Pauses',
  'Kyoto Kengo Kuma',
  'Quantum qubit system'
];

export const mockTrendingKeywords = [
  'Gemini 3.5',
  'Exoplanets',
  'Offshore Wind',
  'Roman Bavaria',
  'Cyber Attack',
  'Interest Rates'
];

export const mockCategories = [
  'Technology',
  'Business & Economy',
  'Environment',
  'Science & Space',
  'Sports',
  'Arts & Culture'
];
