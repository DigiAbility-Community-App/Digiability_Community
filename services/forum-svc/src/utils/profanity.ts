let filter: any;
try {
  const FilterClass = require('bad-words');
  filter = new FilterClass();
} catch (err) {
  // Fallback if import fails
  filter = {
    clean: (t: string) => t,
    isProfane: () => false,
  };
}

export function cleanProfanity(text: string | null | undefined): string {
  if (!text) return '';
  try {
    return filter.clean(text);
  } catch (error) {
    return text;
  }
}

export function hasProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  try {
    return filter.isProfane(text);
  } catch (error) {
    return false;
  }
}
