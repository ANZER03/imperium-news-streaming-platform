export const mockArticle = {
  id: '1',
  title: 'Global Markets Rally as Central Banks Signal Pause in Rate Hikes',
  excerpt:
    'Investors worldwide responded with optimism after the Federal Reserve and European Central Bank both hinted at a prolonged pause in interest rate increases, sending equities to multi-month highs.',
  topic: 'Business & Economy',
  imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80',
  publishedAt: Date.now() / 1000 - 3600,
  sourceName: 'Reuters',
  author: 'Sarah Mitchell',
  url: 'https://reuters.com',
  content: `The Federal Reserve's latest meeting minutes revealed a consensus among policymakers that the current rate level is sufficiently restrictive to bring inflation back to the 2% target without further hikes.

Markets reacted swiftly. The S&P 500 climbed 1.8% in early trading, while the Nasdaq Composite surged 2.3%. European indices followed suit, with the DAX and CAC 40 both posting gains above 1.5%.

"This is the signal investors have been waiting for," said James Thornton, chief market strategist at Meridian Capital. "The era of aggressive tightening appears to be over."

Bond markets also reflected the shift in sentiment. The yield on the 10-year US Treasury note fell to 4.12%, its lowest level in three months, as traders priced in the possibility of rate cuts beginning in the second half of the year.

The euro strengthened against the dollar following similar signals from ECB President Christine Lagarde, who noted that the bank's current stance was "well-positioned" to achieve its inflation mandate.

Emerging market currencies, which had been under pressure from dollar strength, also gained ground. The Brazilian real and South African rand both appreciated more than 1% against the greenback.

Commodity markets were mixed. Gold rose 0.6% to $2,041 per ounce as real yields declined, while oil prices edged lower on demand concerns despite the broader risk-on sentiment.

Analysts caution that the path forward remains uncertain. Inflation data in the coming months will be critical in determining whether central banks can maintain their pause or will need to resume tightening.`,
  countryName: 'United States',
};

export const mockComments = [
  {
    id: 'c1',
    author: 'Karim Benali',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=karim',
    content: 'Finally some good news for emerging markets. The dollar pressure has been brutal this year.',
    publishedAt: Date.now() / 1000 - 1800,
    likes: 24,
    replies: 3,
  },
  {
    id: 'c2',
    author: 'Yuki Tanaka',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yuki',
    content: 'I remain skeptical. Inflation data has surprised to the upside before. One pause does not make a pivot.',
    publishedAt: Date.now() / 1000 - 3200,
    likes: 41,
    replies: 7,
  },
  {
    id: 'c3',
    author: 'Amara Diallo',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amara',
    content: 'The bond market reaction is the real story here. 4.12% on the 10-year is significant.',
    publishedAt: Date.now() / 1000 - 5400,
    likes: 18,
    replies: 2,
  },
  {
    id: 'c4',
    author: 'Lucas Ferreira',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lucas',
    content: 'Gold at $2,041 while real yields drop — classic. Watching this closely.',
    publishedAt: Date.now() / 1000 - 7200,
    likes: 9,
    replies: 1,
  },
];

export function relTime(epochSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - epochSeconds);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
