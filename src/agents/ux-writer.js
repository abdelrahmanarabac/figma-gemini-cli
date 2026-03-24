/**
 * UX Writer Expert — Contextual microcopy generation.
 *
 * Generates labels, placeholders, CTAs, error messages,
 * and other UI text based on component context.
 */

import { Expert } from './expert.js';

// ── Copy Pattern Library ─────────────────────────────

const COPY_PATTERNS = {
  // Auth
  'login.title': 'Welcome back',
  'login.subtitle': 'Enter your credentials to continue',
  'login.email.label': 'Email address',
  'login.email.placeholder': 'name@company.com',
  'login.password.label': 'Password',
  'login.password.placeholder': '••••••••',
  'login.submit': 'Sign in',
  'login.forgot': 'Forgot password?',
  'login.register': "Don't have an account?",
  'login.register.cta': 'Create one',
  'signup.title': 'Create your account',
  'signup.subtitle': 'Start your free trial today',
  'signup.submit': 'Get started',

  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.analytics': 'Analytics',
  'nav.users': 'Users',
  'nav.settings': 'Settings',
  'nav.profile': 'Profile',
  'nav.logout': 'Log out',
  'nav.search': 'Search...',

  // Actions
  'action.save': 'Save changes',
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.confirm': 'Confirm',
  'action.edit': 'Edit',
  'action.add': 'Add new',
  'action.close': 'Close',
  'action.submit': 'Submit',
  'action.continue': 'Continue',
  'action.back': 'Go back',

  // Empty states
  'empty.title': 'Nothing here yet',
  'empty.description': 'Get started by creating your first item.',
  'empty.cta': 'Create now',

  // Error states
  'error.generic': 'Something went wrong',
  'error.description': 'Please try again or contact support if the problem persists.',
  'error.retry': 'Try again',
  'error.404.title': 'Page not found',
  'error.404.description': "The page you're looking for doesn't exist or has been moved.",
  'error.network': 'Connection lost. Check your internet and try again.',

  // Success states
  'success.saved': 'Changes saved successfully',
  'success.created': 'Created successfully',
  'success.deleted': 'Deleted successfully',

  // Stats
  'stat.revenue': 'Total Revenue',
  'stat.users': 'Active Users',
  'stat.conversion': 'Conversion Rate',
  'stat.orders': 'Total Orders',
  'stat.growth': 'Growth',
  'stat.sessions': 'Sessions',

  // Pricing
  'pricing.title': 'Choose your plan',
  'pricing.subtitle': 'Start free. Upgrade when you need more.',
  'pricing.free': 'Free',
  'pricing.pro': 'Pro',
  'pricing.enterprise': 'Enterprise',
  'pricing.cta.free': 'Start free',
  'pricing.cta.pro': 'Upgrade to Pro',
  'pricing.cta.enterprise': 'Contact sales',
  'pricing.popular': 'Most popular',

  // Form validation
  'validation.required': 'This field is required',
  'validation.email': 'Please enter a valid email address',
  'validation.password.min': 'Password must be at least 8 characters',
  'validation.password.match': 'Passwords do not match',
};

export class UXWriterExpert extends Expert {
  name = 'ux-writer';
  description = 'Contextual microcopy generation — labels, placeholders, CTAs, error messages.';
  capabilities = ['typography', 'text', 'ux-writing'];
  priority = 25; // After token-expert, before builder finishes
  phase = 'pre';

  relevance(intent) {
    if (intent.tags.includes('typography')) return 0.7;
    // Moderate relevance when generating components with text
    if (['generate', 'render'].includes(intent.action)) return 0.5;
    return 0.1;
  }

  /**
   * Get copy for a given pattern key.
   * @param {string} key
   * @returns {string|null}
   */
  getCopy(key) {
    return COPY_PATTERNS[key] || null;
  }

  /**
   * Get all copy for a category (e.g., 'login', 'nav', 'error').
   * @param {string} category
   * @returns {Object<string, string>}
   */
  getCategoryStrings(category) {
    const result = {};
    const prefix = category + '.';
    for (const [key, value] of Object.entries(COPY_PATTERNS)) {
      if (key.startsWith(prefix)) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Detect which copy category a description maps to.
   * @param {string} description
   * @returns {string[]} Matching categories
   */
  detectCategories(description) {
    const lower = description.toLowerCase();
    const categories = [];

    const categoryMap = {
      login: ['login', 'sign in', 'signin', 'authentication'],
      signup: ['sign up', 'signup', 'register', 'create account'],
      nav: ['navigation', 'sidebar', 'header', 'nav', 'menu'],
      error: ['error', '404', 'not found', 'broken'],
      empty: ['empty', 'no data', 'nothing'],
      pricing: ['pricing', 'plan', 'subscription', 'tier'],
      stat: ['stat', 'metric', 'analytics', 'dashboard', 'revenue', 'users'],
    };

    for (const [cat, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(kw => lower.includes(kw))) {
        categories.push(cat);
      }
    }

    return categories;
  }

  async execute(ctx, task, pipelineData = {}) {
    const description = task.description || task.input?.intent?.raw || '';
    const categories = this.detectCategories(description);
    const copy = {};

    for (const cat of categories) {
      Object.assign(copy, this.getCategoryStrings(cat));
    }

    return {
      success: true,
      data: { copy, categories },
      metadata: { detectedCategories: categories, copyCount: Object.keys(copy).length },
      warnings: categories.length === 0 ? ['No copy category detected from description'] : [],
      errors: [],
    };
  }
}
