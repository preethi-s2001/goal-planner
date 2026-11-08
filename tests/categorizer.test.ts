import { describe, it, expect } from 'vitest';
import {
  categorizeDescription,
  suggestKeywordFromDescription,
  matchesWordStart,
  matchesWordBoundary,
} from '@/lib/finance/categorizer';

describe('Phase 2 & 3 - Categorization Rules & Word-Start Matching', () => {
  it('correctly categorizes Food keywords', () => {
    expect(categorizeDescription('Dinner at Swiggy')).toBe('Food');
    expect(categorizeDescription('Zomato order for lunch')).toBe('Food');
    expect(categorizeDescription('Starbucks Cafe cold brew')).toBe('Food');
    expect(categorizeDescription('Weekly Grocery shopping at Nature Basket')).toBe('Food');
    expect(categorizeDescription('Main street restaurant bill')).toBe('Food');
  });

  it('Issue 6: matches keywords at START of word so "Groceries" and "Restaurants" work', () => {
    // "Groceries" starts with "grocer"
    expect(categorizeDescription('Purchased Groceries from market')).toBe('Food');
    expect(categorizeDescription('Groceries')).toBe('Food');
    // "Restaurants" starts with "restaurant"
    expect(categorizeDescription('Weekend Restaurants dining')).toBe('Food');
    expect(categorizeDescription('Fine dining Restaurants')).toBe('Food');
  });

  it('correctly categorizes Transport keywords', () => {
    expect(categorizeDescription('Uber auto to office')).toBe('Transport');
    expect(categorizeDescription('Ola cab ride')).toBe('Transport');
    expect(categorizeDescription('Metro smartcard recharge')).toBe('Transport');
    expect(categorizeDescription('Petrol pump fill up')).toBe('Transport');
    expect(categorizeDescription('Fuel station')).toBe('Transport');
  });

  it('correctly categorizes Shopping keywords', () => {
    expect(categorizeDescription('Amazon purchase')).toBe('Shopping');
    expect(categorizeDescription('Flipkart sale')).toBe('Shopping');
    expect(categorizeDescription('Myntra t-shirt')).toBe('Shopping');
    expect(categorizeDescription('Phoenix Mall clothes')).toBe('Shopping');
  });

  it('correctly categorizes Bills keywords', () => {
    expect(categorizeDescription('Electricity bill BESCOM')).toBe('Bills');
    expect(categorizeDescription('Airtel mobile bill')).toBe('Bills');
    expect(categorizeDescription('Jio recharge 30 days')).toBe('Bills');
    expect(categorizeDescription('Act fibernet wifi')).toBe('Bills');
    expect(categorizeDescription('Water tanker utility')).toBe('Bills');
  });

  it('correctly categorizes Entertainment keywords', () => {
    expect(categorizeDescription('PVR movie tickets')).toBe('Entertainment');
    expect(categorizeDescription('Netflix monthly subscription')).toBe('Entertainment');
    expect(categorizeDescription('Spotify premium')).toBe('Entertainment');
  });

  it('correctly categorizes Rent keywords', () => {
    expect(categorizeDescription('Monthly apartment rent')).toBe('Rent');
  });

  it('Issue 6: does NOT miscategorize substring collisions (word start matching)', () => {
    // 1. "Coca-Cola" should NOT match "ola" (Transport)
    expect(categorizeDescription('Purchased Coca-Cola can')).toBe('Others');
    expect(categorizeDescription('Coca-Cola')).not.toBe('Transport');

    // 2. "Small cap fund" should NOT match "mall" (Shopping)
    expect(categorizeDescription('Small cap fund SIP')).toBe('Others');
    expect(categorizeDescription('Small cap fund')).not.toBe('Shopping');

    // 3. "Parent gift" should NOT match "rent" (Rent)
    expect(categorizeDescription('Parent gift for anniversary')).toBe('Others');
    expect(categorizeDescription('Parent gift')).not.toBe('Rent');
  });

  it('matches legitimate word start terms surrounded by punctuation or spaces', () => {
    expect(matchesWordStart('Ola cab', 'ola')).toBe(true);
    expect(matchesWordStart('Phoenix Mall, Bangalore', 'mall')).toBe(true);
    expect(matchesWordStart('Pay house rent.', 'rent')).toBe(true);
    expect(matchesWordBoundary('Municipal water-tax', 'water')).toBe(true);
  });

  it('Issue 5: Type-aware categorization: expense can never be Income, income defaults to Income', () => {
    // "Maid salary" with type expense: MUST NOT be categorized as 'Income'
    expect(categorizeDescription('Maid salary', [], 'expense')).not.toBe('Income');
    expect(categorizeDescription('Maid salary', [], 'expense')).toBe('Others');

    // "Salary credit" with type income: gets 'Income'
    expect(categorizeDescription('Salary credit', [], 'income')).toBe('Income');
    expect(categorizeDescription('October Salary from Company', [], 'income')).toBe('Income');

    // Any generic income row without rule defaults to 'Income'
    expect(categorizeDescription('Bonus payout', [], 'income')).toBe('Income');
    expect(categorizeDescription('Dividend credited', [], 'income')).toBe('Income');

    // User rule for income takes priority
    const userRules = [
      { keyword: 'dividend', category: 'Investments' },
      { keyword: 'maid', category: 'Others' },
    ];
    expect(categorizeDescription('Dividend credited', userRules, 'income')).toBe('Investments');

    // User rule assigning 'Income' to an expense is ignored (expense can never be 'Income')
    const badRule = [{ keyword: 'salary', category: 'Income' }];
    expect(categorizeDescription('Cook salary paid', badRule, 'expense')).not.toBe('Income');
  });

  it('falls back to Others for unmatched descriptions', () => {
    expect(categorizeDescription('Random debit at counter')).toBe('Others');
    expect(categorizeDescription('Transfer to friend')).toBe('Others');
    expect(categorizeDescription('')).toBe('Others');
  });

  it('prioritizes user-learned rules over default rules using word boundaries', () => {
    const customRules = [
      { keyword: 'swiggy party', category: 'Entertainment' },
      { keyword: 'gym', category: 'Health' },
    ];

    expect(categorizeDescription('Swiggy party dinner', customRules)).toBe('Entertainment');
    expect(categorizeDescription('Swiggy regular meal', customRules)).toBe('Food');
    expect(categorizeDescription('Cult Fit Gym membership', customRules)).toBe('Health');
  });

  it('suggests clean keywords from description', () => {
    expect(suggestKeywordFromDescription('Swiggy instamart delivery')).toBe('swiggy');
    expect(suggestKeywordFromDescription('Uber trip #98721')).toBe('uber');
    expect(suggestKeywordFromDescription('Zomato')).toBe('zomato');
  });
});
