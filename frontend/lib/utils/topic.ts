export interface TopicMeta {
  label: string;
  bg: string;   // hex background
  text: string; // hex text color
}

const TOPIC_META: Record<string, TopicMeta> = {
  politics_government:   { label: 'Politics',       bg: '#1d4ed8', text: '#ffffff' },
  war_security:          { label: 'War & Security',  bg: '#b91c1c', text: '#ffffff' },
  crime_justice:         { label: 'Crime',           bg: '#475569', text: '#ffffff' },
  business_economy:      { label: 'Business',        bg: '#065f46', text: '#ffffff' },
  science_technology:    { label: 'Science & Tech',  bg: '#5b21b6', text: '#ffffff' },
  health:                { label: 'Health',          bg: '#0f766e', text: '#ffffff' },
  sports:                { label: 'Sports',          bg: '#ea580c', text: '#ffffff' },
  entertainment_culture: { label: 'Entertainment',   bg: '#db2777', text: '#ffffff' },
  lifestyle_travel:      { label: 'Lifestyle',       bg: '#d97706', text: '#ffffff' },
  education:             { label: 'Education',       bg: '#3730a3', text: '#ffffff' },
  environment_weather:   { label: 'Environment',     bg: '#15803d', text: '#ffffff' },
  disasters_accidents:   { label: 'Disasters',       bg: '#be123c', text: '#ffffff' },
  religion_society:      { label: 'Society',         bg: '#78716c', text: '#ffffff' },
};

const FALLBACK: TopicMeta = { label: '', bg: '#16131D', text: '#ffffff' };

export function getTopicMeta(topicId: string | undefined | null): TopicMeta {
  if (!topicId) return FALLBACK;
  return TOPIC_META[topicId] ?? { label: topicId, bg: '#16131D', text: '#ffffff' };
}

const DISPLAY_TO_TOPIC_ID: Record<string, string> = {
  'Business':      'business_economy',
  'Tech':          'science_technology',
  'Science':       'science_technology',
  'Sports':        'sports',
  'Entertainment': 'entertainment_culture',
  'Health':        'health',
  'World':         'politics_government',
  'Trending':      'politics_government',
};

/** Maps header display names to backend topic IDs. Onboarding interest IDs pass through unchanged. */
export function resolveTopicId(displayName: string): string {
  return DISPLAY_TO_TOPIC_ID[displayName] ?? displayName;
}
