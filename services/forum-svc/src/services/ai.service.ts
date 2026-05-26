const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
  'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here',
  'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in',
  'into', 'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor',
  'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than', 'that', 'thats',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'theyd', 'theyll',
  'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasnt',
  'we', 'wed', 'well', 'were', 'weve', 'werent', 'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which',
  'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll',
  'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenize string into a clean list of words, filtering punctuation and stop words.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Compute Term Frequency (TF) map.
 */
function getTermFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

/**
 * Calculate Cosine Similarity between two strings.
 */
export function calculateCosineSimilarity(str1: string, str2: string): number {
  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const tf1 = getTermFrequencies(tokens1);
  const tf2 = getTermFrequencies(tokens2);

  // Get unique vocabulary
  const vocab = new Set([...tf1.keys(), ...tf2.keys()]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const word of vocab) {
    const valA = tf1.get(word) || 0;
    const valB = tf2.get(word) || 0;

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * AI-simulated thread summarizer. Extracts key details and highlights.
 */
export function generateThreadSummary(
  questionTitle: string,
  questionDescription: string,
  answers: { content: string; upvotes: number; isAccepted: boolean }[]
): string {
  const bulletPoints: string[] = [];

  // 1. Analyze the core problem from the title/description
  const problemTokens = tokenize(questionTitle + ' ' + questionDescription);
  bulletPoints.push(`**Core Issue**: Discussion regarding "${questionTitle}".`);

  // 2. Identify top answers or accepted solutions
  const acceptedAnswer = answers.find(a => a.isAccepted);
  const topUpvotedAnswer = [...answers]
    .filter(a => !a.isAccepted)
    .sort((a, b) => b.upvotes - a.upvotes)[0];

  if (acceptedAnswer) {
    bulletPoints.push(
      `**Accepted Solution**: ${extractKeySentence(acceptedAnswer.content) || 'Community-verified solution.'}`
    );
  }

  if (topUpvotedAnswer && topUpvotedAnswer.upvotes > 0) {
    bulletPoints.push(
      `**Highly Voted Suggestion (${topUpvotedAnswer.upvotes} upvotes)**: ${extractKeySentence(topUpvotedAnswer.content)}`
    );
  }

  // 3. Extract key recommendations if any (sentences containing standard keywords)
  const recommendations: string[] = [];
  for (const ans of answers) {
    const sentences = ans.content.split(/[.!?]+/);
    for (const s of sentences) {
      const sentenceClean = s.trim();
      if (
        sentenceClean.length > 15 &&
        /\b(should|try|use|make sure|ensure|recommend|work|fixed|helpful)\b/i.test(sentenceClean)
      ) {
        recommendations.push(sentenceClean);
        if (recommendations.length >= 2) break;
      }
    }
    if (recommendations.length >= 2) break;
  }

  if (recommendations.length > 0) {
    recommendations.forEach(rec => {
      bulletPoints.push(`* ${rec}.`);
    });
  } else if (answers.length > 0 && !acceptedAnswer && (!topUpvotedAnswer || topUpvotedAnswer.upvotes <= 0)) {
    // Fallback if there are answers but none accepted/upvoted yet
    bulletPoints.push(`**Community Output**: ${answers.length} response(s) shared by peers. Ongoing discussion.`);
  } else if (answers.length === 0) {
    bulletPoints.push('**Status**: No responses shared yet. Waiting for community input.');
  }

  return bulletPoints.join('\n\n');
}

/**
 * Extract a short concise sentence or substring from a longer string.
 */
function extractKeySentence(text: string): string {
  if (!text) return '';
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length === 0) return '';
  // Return the first sentence, or a truncated portion if too long
  const first = sentences[0];
  return first.length > 120 ? first.substring(0, 117) + '...' : first;
}
