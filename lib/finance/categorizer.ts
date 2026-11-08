export interface CategoryRuleItem {
  id?: string;
  keyword: string;
  category: string;
}

/**
 * Default keyword rulebook as specified in the project brief:
 * - Rent: rent
 * - Food: grocer, grocery, restaurant, swiggy, zomato, cafe
 * - Transport: fuel, uber, ola, metro, petrol
 * - Shopping: amazon, flipkart, myntra, mall
 * - Bills: electricity, mobile, recharge, wifi, water
 * - Entertainment: movie, netflix, spotify
 * - Income: salary
 * - anything unmatched -> Others
 */
export const DEFAULT_KEYWORD_RULES: Record<string, string[]> = {
  Rent: ['rent'],
  Food: ['grocer', 'grocery', 'restaurant', 'swiggy', 'zomato', 'cafe'],
  Transport: ['fuel', 'uber', 'ola', 'metro', 'petrol'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'mall'],
  Bills: ['electricity', 'mobile', 'recharge', 'wifi', 'water'],
  Entertainment: ['movie', 'netflix', 'spotify'],
  Income: ['salary'],
};

/**
 * Tests if keyword matches text at the START of a word (/(^|[^a-zA-Z0-9])keyword/i).
 * - "Groceries" matches "grocer"
 * - "Restaurants" matches "restaurant"
 * - "Coca-Cola" does NOT match "ola"
 * - "Small cap fund" does NOT match "mall"
 * - "Parent gift" does NOT match "rent"
 */
export function matchesWordStart(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}`, 'i');
  return regex.test(text);
}

/**
 * Backward compatibility alias
 */
export const matchesWordBoundary = matchesWordStart;

/**
 * Categorize a transaction description with type awareness:
 * - If type === 'expense': an expense can NEVER be categorized 'Income'.
 * - If type === 'income': defaults to 'Income' unless a user rule specifies otherwise.
 * - Matches keywords at the start of words (user rules take priority).
 */
export function categorizeDescription(
  description: string,
  userRules: CategoryRuleItem[] = [],
  type?: 'income' | 'expense' | null
): string {
  if (!description || typeof description !== 'string') {
    return type === 'income' ? 'Income' : 'Others';
  }

  const trimmed = description.trim();
  if (!trimmed) {
    return type === 'income' ? 'Income' : 'Others';
  }

  // Type: Income
  if (type === 'income') {
    // 1. User rules take priority for income
    for (const rule of userRules) {
      const kw = rule.keyword?.trim();
      if (kw && matchesWordStart(trimmed, kw)) {
        return rule.category;
      }
    }
    // 2. An income row gets 'Income' unless a user rule says otherwise
    return 'Income';
  }

  // Type: Expense
  if (type === 'expense') {
    // 1. User rules take priority, but an expense can NEVER be 'Income'
    for (const rule of userRules) {
      const kw = rule.keyword?.trim();
      if (kw && matchesWordStart(trimmed, kw)) {
        if (rule.category !== 'Income') {
          return rule.category;
        }
      }
    }

    // 2. Check default rulebook (excluding 'Income' category)
    for (const [category, keywords] of Object.entries(DEFAULT_KEYWORD_RULES)) {
      if (category === 'Income') continue;
      for (const kw of keywords) {
        if (matchesWordStart(trimmed, kw)) {
          return category;
        }
      }
    }

    return 'Others';
  }

  // Untyped fallback
  for (const rule of userRules) {
    const kw = rule.keyword?.trim();
    if (kw && matchesWordStart(trimmed, kw)) {
      return rule.category;
    }
  }

  for (const [category, keywords] of Object.entries(DEFAULT_KEYWORD_RULES)) {
    for (const kw of keywords) {
      if (matchesWordStart(trimmed, kw)) {
        return category;
      }
    }
  }

  return 'Others';
}

/**
 * Extract a suggested keyword from a description to propose "Always use this category for '<keyword>'"
 * E.g., "Swiggy order #1234" -> "swiggy"
 * E.g., "Uber ride home" -> "uber"
 */
export function suggestKeywordFromDescription(description: string): string {
  if (!description) return '';
  const cleaned = description.trim().toLowerCase().replace(/[^a-z0-9\s]/gi, ' ');
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);
  return words[0] || description.trim().toLowerCase().slice(0, 15);
}
