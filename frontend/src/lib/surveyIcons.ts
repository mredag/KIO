/**
 * Survey Icon Mapping Utilities for Premium Survey UI
 * 
 * Provides intelligent icon/emoji selection for survey options,
 * questions, and ratings based on keyword matching.
 * 
 * Supports both Turkish and English keywords for comprehensive coverage.
 * 
 * Requirements: 2.1, 2.3, 3.2, 3.5, 5.1, 5.2, 5.3, 5.4, 9.4, 9.5
 */

/**
 * Default fallback emoji when no keyword matches
 */
export const DEFAULT_ICON = '✨';

/**
 * Comprehensive keyword-to-emoji mapping for survey options
 * Supports Turkish and English keywords
 */
export const OPTION_ICON_MAP: Record<string, string> = {
  // Social Media
  'sosyal medya': '📱',
  'social media': '📱',
  'instagram': '📸',
  'facebook': '👤',
  'twitter': '🐦',
  'tiktok': '🎵',
  'youtube': '▶️',
  'linkedin': '💼',
  
  // Referrals
  'arkadaş': '👥',
  'friend': '👥',
  'aile': '👨‍👩‍👧',
  'family': '👨‍👩‍👧',
  'tavsiye': '💬',
  'recommendation': '💬',
  'referans': '💬',
  'tanıdık': '👥',
  'acquaintance': '👥',
  
  // Search & Online
  'google': '🔍',
  'arama': '🔍',
  'search': '🔍',
  'online': '🌐',
  'internet': '🌐',
  'web': '🌐',
  'website': '🌐',
  'site': '🌐',

  // Physical / Walking
  'geçerken': '🚶',
  'walking': '🚶',
  'yürürken': '🚶',
  'passing': '🚶',
  'sokak': '🚶',
  'street': '🚶',
  'görünce': '👀',
  'saw': '👀',
  
  // Advertising
  'reklam': '📺',
  'advertisement': '📺',
  'ilan': '📰',
  'billboard': '🪧',
  'tv': '📺',
  'televizyon': '📺',
  'radyo': '📻',
  'radio': '📻',
  'gazete': '📰',
  'newspaper': '📰',
  'dergi': '📰',
  'magazine': '📰',
  
  // Experience & Quality
  'mükemmel': '⭐',
  'excellent': '⭐',
  'harika': '🌟',
  'great': '🌟',
  'iyi': '👍',
  'good': '👍',
  'orta': '😐',
  'average': '😐',
  'kötü': '👎',
  'bad': '👎',
  'berbat': '😞',
  'terrible': '😞',
  
  // Comfort & Atmosphere (Spa-specific)
  'rahat': '😌',
  'comfortable': '😌',
  'huzurlu': '🧘',
  'peaceful': '🧘',
  'sakin': '😊',
  'calm': '😊',
  'temiz': '✨',
  'clean': '✨',
  'ferah': '🌿',
  'fresh': '🌿',
  'sıcak': '🔥',
  'warm': '🔥',
  'soğuk': '❄️',
  'cold': '❄️',
  'gürültülü': '🔊',
  'noisy': '🔊',
  'sessiz': '🤫',
  'quiet': '🤫',
  'kalabalık': '👥',
  'crowded': '👥',
  'boş': '🏠',
  'empty': '🏠',
  'güzel': '💖',
  'beautiful': '💖',
  'hoş': '💫',
  'nice': '💫',
  'keyifli': '😊',
  'enjoyable': '😊',
  'rahatsız': '😣',
  'uncomfortable': '😣',
  
  // Services
  'masaj': '💆',
  'massage': '💆',
  'spa': '🧖',
  'terapi': '🧘',
  'therapy': '🧘',
  'sauna': '🧖‍♂️',
  'hamam': '🛁',
  'bath': '🛁',
  
  // Time & Frequency
  'ilk kez': '🆕',
  'ilk defa': '🆕',
  'first time': '🆕',
  'düzenli': '🔄',
  'regular': '🔄',
  'sık sık': '🔄',
  'often': '🔄',
  'bazen': '⏰',
  'sometimes': '⏰',
  'nadiren': '🕐',
  'rarely': '🕐',
  'düzensiz': '🎲',
  'irregular': '🎲',
  'ayda bir': '📅',
  'once a month': '📅',
  'monthly': '📅',
  'ayda birkaç': '📆',
  'few times a month': '📆',
  'haftada bir': '🗓️',
  'once a week': '🗓️',
  'weekly': '🗓️',
  'haftada birkaç': '📊',
  'few times a week': '📊',
  'her gün': '☀️',
  'every day': '☀️',
  'daily': '☀️',
  'yılda bir': '🎄',
  'once a year': '🎄',
  'yearly': '🎄',
  'hiç': '🚫',
  'never': '🚫',
  'daha önce': '⏮️',
  'before': '⏮️',
  
  // Satisfaction
  'memnun': '😊',
  'satisfied': '😊',
  'mutlu': '😄',
  'happy': '😄',
  'teşekkür': '🙏',
  'thanks': '🙏',
  
  // Other/Default
  'diğer': '✨',
  'other': '✨',
  'başka': '✨',
  'else': '✨',
  'bilmiyorum': '❓',
  'dont know': '❓',
  'emin değilim': '❓',
  'not sure': '❓',
};


/**
 * Brand/Platform SVG icons as data URLs for high-quality rendering
 * These are inline SVGs encoded as data URLs for offline support
 */
export const BRAND_ICONS: Record<string, string> = {
  // Google "G" logo
  google: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>`)}`,
  
  // Instagram gradient logo
  instagram: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><radialGradient id="ig1" cx="19.38" cy="42.035" r="44.899" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fd5"/><stop offset=".328" stop-color="#ff543f"/><stop offset=".348" stop-color="#fc5245"/><stop offset=".504" stop-color="#e64771"/><stop offset=".643" stop-color="#d53e91"/><stop offset=".761" stop-color="#cc39a4"/><stop offset=".841" stop-color="#c837ab"/></radialGradient><path fill="url(#ig1)" d="M34.017,41.99l-20,0.019c-4.4,0.004-8.003-3.592-8.008-7.992l-0.019-20c-0.004-4.4,3.592-8.003,7.992-8.008l20-0.019c4.4-0.004,8.003,3.592,8.008,7.992l0.019,20C42.014,38.383,38.417,41.986,34.017,41.99z"/><radialGradient id="ig2" cx="11.786" cy="5.54" r="29.813" gradientTransform="matrix(1 0 0 .6663 0 1.849)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4168c9"/><stop offset=".999" stop-color="#4168c9" stop-opacity="0"/></radialGradient><path fill="url(#ig2)" d="M34.017,41.99l-20,0.019c-4.4,0.004-8.003-3.592-8.008-7.992l-0.019-20c-0.004-4.4,3.592-8.003,7.992-8.008l20-0.019c4.4-0.004,8.003,3.592,8.008,7.992l0.019,20C42.014,38.383,38.417,41.986,34.017,41.99z"/><path fill="#fff" d="M24,31c-3.859,0-7-3.14-7-7s3.141-7,7-7s7,3.14,7,7S27.859,31,24,31z M24,19c-2.757,0-5,2.243-5,5s2.243,5,5,5s5-2.243,5-5S26.757,19,24,19z"/><circle cx="31.5" cy="16.5" r="1.5" fill="#fff"/><path fill="#fff" d="M30,37H18c-3.859,0-7-3.14-7-7V18c0-3.86,3.141-7,7-7h12c3.859,0,7,3.14,7,7v12C37,33.86,33.859,37,30,37z M18,13c-2.757,0-5,2.243-5,5v12c0,2.757,2.243,5,5,5h12c2.757,0,5-2.243,5-5V18c0-2.757-2.243-5-5-5H18z"/></svg>`)}`,
  
  // Facebook blue logo
  facebook: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><linearGradient id="fb1" x1="9.993" x2="40.615" y1="9.993" y2="40.615" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2aa4f4"/><stop offset="1" stop-color="#007ad9"/></linearGradient><path fill="url(#fb1)" d="M24,4C12.954,4,4,12.954,4,24s8.954,20,20,20s20-8.954,20-20S35.046,4,24,4z"/><path fill="#fff" d="M26.707,29.301h5.176l0.813-5.258h-5.989v-2.874c0-2.184,0.714-4.121,2.757-4.121h3.283V12.46c-0.577-0.078-1.797-0.248-4.102-0.248c-4.814,0-7.636,2.542-7.636,8.334v3.498H16.06v5.258h4.948v14.452C22.018,43.902,23.001,44,24,44c0.921,0,1.82-0.084,2.707-0.204V29.301z"/></svg>`)}`,
  
  // TikTok logo
  tiktok: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#212121" d="M34.145,13.696c-2.011-1.311-3.404-3.412-3.768-5.857C30.32,7.28,30.287,6.708,30.287,6.125h-6.094l-0.009,26.854c-0.092,2.846-2.449,5.126-5.324,5.126c-0.916,0-1.779-0.233-2.531-0.642c-1.737-0.943-2.915-2.782-2.915-4.896c0-3.063,2.492-5.555,5.555-5.555c0.572,0,1.123,0.087,1.641,0.248v-6.188c-0.538-0.073-1.085-0.112-1.641-0.112c-6.227,0-11.289,5.062-11.289,11.289c0,3.802,1.889,7.165,4.778,9.208c1.819,1.287,4.041,2.045,6.438,2.045c6.227,0,11.289-5.062,11.289-11.289V18.462c2.391,1.716,5.326,2.727,8.5,2.727v-6.094C36.632,15.095,35.205,14.387,34.145,13.696z"/></svg>`)}`,
  
  // YouTube red logo
  youtube: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FF3D00" d="M43.2,33.9c-0.4,2.1-2.1,3.7-4.2,4c-3.3,0.5-8.8,1.1-15,1.1c-6.1,0-11.6-0.6-15-1.1c-2.1-0.3-3.8-1.9-4.2-4C4.4,31.6,4,28.2,4,24c0-4.2,0.4-7.6,0.8-9.9c0.4-2.1,2.1-3.7,4.2-4C12.3,9.6,17.8,9,24,9c6.2,0,11.6,0.6,15,1.1c2.1,0.3,3.8,1.9,4.2,4c0.4,2.3,0.9,5.7,0.9,9.9C44,28.2,43.6,31.6,43.2,33.9z"/><path fill="#FFF" d="M20 31L20 17 32 24z"/></svg>`)}`,
  
  // WhatsApp green logo
  whatsapp: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#25D366" d="M4.868,43.303l2.694-9.835C5.9,30.59,5.026,27.324,5.027,23.979C5.032,13.514,13.548,5,24.014,5c5.079,0.002,9.845,1.979,13.43,5.566c3.584,3.588,5.558,8.356,5.556,13.428c-0.004,10.465-8.522,18.98-18.986,18.98c-0.001,0,0,0,0,0h-0.008c-3.177-0.001-6.3-0.798-9.073-2.311L4.868,43.303z"/><path fill="#FFF" d="M35.176,12.832c-2.98-2.982-6.941-4.625-11.157-4.626c-8.704,0-15.783,7.076-15.787,15.774c-0.001,2.981,0.833,5.883,2.413,8.396l0.376,0.597l-1.595,5.821l5.973-1.566l0.577,0.342c2.422,1.438,5.2,2.198,8.032,2.199h0.006c8.698,0,15.777-7.077,15.78-15.776C39.795,19.778,38.156,15.814,35.176,12.832z"/><path fill="#25D366" d="M31.067,27.921c-0.456-0.228-2.699-1.332-3.118-1.484c-0.418-0.152-0.723-0.228-1.027,0.228c-0.304,0.456-1.179,1.484-1.446,1.789c-0.266,0.304-0.532,0.342-0.988,0.114c-0.456-0.228-1.925-0.71-3.667-2.264c-1.355-1.209-2.27-2.703-2.536-3.159c-0.266-0.456-0.028-0.702,0.2-0.929c0.205-0.204,0.456-0.532,0.684-0.798c0.228-0.266,0.304-0.456,0.456-0.76c0.152-0.304,0.076-0.57-0.038-0.798c-0.114-0.228-1.027-2.474-1.407-3.386c-0.37-0.889-0.746-0.769-1.027-0.783c-0.266-0.013-0.57-0.015-0.874-0.015c-0.304,0-0.798,0.114-1.216,0.57c-0.418,0.456-1.597,1.56-1.597,3.806c0,2.246,1.635,4.416,1.863,4.72c0.228,0.304,3.218,4.912,7.799,6.889c1.089,0.47,1.94,0.751,2.602,0.961c1.094,0.348,2.089,0.299,2.876,0.181c0.877-0.131,2.699-1.103,3.08-2.169c0.38-1.066,0.38-1.979,0.266-2.169C31.828,28.149,31.523,28.035,31.067,27.921z"/></svg>`)}`,
  
  // Twitter/X logo
  twitter: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#03A9F4" d="M42,12.429c-1.323,0.586-2.746,0.977-4.247,1.162c1.526-0.906,2.7-2.351,3.251-4.058c-1.428,0.837-3.01,1.452-4.693,1.776C34.967,9.884,33.05,9,30.926,9c-4.08,0-7.387,3.278-7.387,7.32c0,0.572,0.067,1.129,0.193,1.67c-6.138-0.308-11.582-3.226-15.224-7.654c-0.64,1.082-1,2.349-1,3.686c0,2.541,1.301,4.778,3.285,6.096c-1.211-0.037-2.351-0.374-3.349-0.914c0,0.022,0,0.055,0,0.086c0,3.551,2.547,6.508,5.923,7.181c-0.617,0.169-1.269,0.263-1.941,0.263c-0.477,0-0.942-0.054-1.392-0.135c0.94,2.902,3.667,5.023,6.898,5.086c-2.528,1.96-5.712,3.134-9.174,3.134c-0.598,0-1.183-0.034-1.761-0.104C9.268,36.786,13.152,38,17.321,38c13.585,0,21.017-11.156,21.017-20.834c0-0.317-0.01-0.633-0.025-0.945C39.763,15.197,41.013,13.905,42,12.429"/></svg>`)}`,
  
  // LinkedIn blue logo
  linkedin: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#0288D1" d="M42,37c0,2.762-2.238,5-5,5H11c-2.761,0-5-2.238-5-5V11c0-2.762,2.239-5,5-5h26c2.762,0,5,2.238,5,5V37z"/><path fill="#FFF" d="M12 19H17V36H12zM14.485 17h-.028C12.965 17 12 15.888 12 14.499 12 13.08 12.995 12 14.514 12c1.521 0 2.458 1.08 2.486 2.499C17 15.887 16.035 17 14.485 17zM36 36h-5v-9.099c0-2.198-1.225-3.698-3.192-3.698-1.501 0-2.313 1.012-2.707 1.99C24.957 25.543 25 26.511 25 27v9h-5V19h5v2.616C25.721 20.5 26.85 19 29.738 19c3.578 0 6.261 2.25 6.261 7.274L36 36 36 36z"/></svg>`)}`,
};

/**
 * Check if a string is an image URL (data URL or http URL)
 */
export function isImageUrl(str: string): boolean {
  if (!str) return false;
  return str.startsWith('data:image/') || str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/');
}

/**
 * Get an appropriate icon for a survey option based on its text
 * 
 * Uses keyword matching to find the most relevant emoji or brand icon.
 * Falls back to default icon (✨) when no keywords match.
 * 
 * @param optionText - The text of the survey option
 * @param customIcon - Optional custom icon (emoji or image URL)
 * @returns An emoji string or image URL representing the option
 * 
 * @example
 * getOptionIcon('Sosyal Medya') // '📱'
 * getOptionIcon('Google') // returns Google logo data URL
 * getOptionIcon('Friend recommendation') // '👥'
 * getOptionIcon('Unknown option') // '✨'
 * 
 * Requirements: 3.2, 3.5, 9.4, 9.5
 */
export function getOptionIcon(optionText: string, customIcon?: string): string {
  // If custom icon is provided, use it
  if (customIcon && customIcon.trim()) {
    // Check if it's a brand icon key
    const brandKey = customIcon.toLowerCase().trim();
    if (BRAND_ICONS[brandKey]) {
      return BRAND_ICONS[brandKey];
    }
    return customIcon.trim();
  }
  
  if (!optionText || typeof optionText !== 'string') {
    return DEFAULT_ICON;
  }
  
  const lowerText = optionText.toLowerCase().trim();
  
  // Check for brand icons first (higher priority for exact matches)
  for (const [brand, iconUrl] of Object.entries(BRAND_ICONS)) {
    if (lowerText.includes(brand)) {
      return iconUrl;
    }
  }
  
  // Check each keyword for a match
  for (const [keyword, icon] of Object.entries(OPTION_ICON_MAP)) {
    if (lowerText.includes(keyword)) {
      return icon;
    }
  }
  
  return DEFAULT_ICON;
}

/**
 * Get available brand icons for the admin UI
 */
export function getAvailableBrandIcons(): Array<{ key: string; label: string; url: string }> {
  return [
    { key: 'google', label: 'Google', url: BRAND_ICONS.google },
    { key: 'instagram', label: 'Instagram', url: BRAND_ICONS.instagram },
    { key: 'facebook', label: 'Facebook', url: BRAND_ICONS.facebook },
    { key: 'tiktok', label: 'TikTok', url: BRAND_ICONS.tiktok },
    { key: 'youtube', label: 'YouTube', url: BRAND_ICONS.youtube },
    { key: 'whatsapp', label: 'WhatsApp', url: BRAND_ICONS.whatsapp },
    { key: 'twitter', label: 'Twitter/X', url: BRAND_ICONS.twitter },
    { key: 'linkedin', label: 'LinkedIn', url: BRAND_ICONS.linkedin },
  ];
}

/**
 * Animation types for question emojis
 */
export type AnimationType = 'float' | 'pulse' | 'bounce' | 'rotate';

/**
 * Configuration for question emoji display
 */
export interface QuestionEmojiConfig {
  emoji: string;
  animation: AnimationType;
}

/**
 * Get a thematic emoji and animation for a survey question
 * 
 * Analyzes question text and type to select an appropriate
 * decorative emoji with matching animation style.
 * 
 * @param questionText - The text of the question
 * @param questionType - The type of question ('rating' | 'single-choice' | etc.)
 * @returns Configuration with emoji and animation type
 * 
 * @example
 * getQuestionEmoji('Memnuniyetinizi değerlendirin', 'rating')
 * // { emoji: '😊', animation: 'float' }
 * 
 * getQuestionEmoji('Bizi nasıl buldunuz?', 'single-choice')
 * // { emoji: '🔍', animation: 'rotate' }
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export function getQuestionEmoji(
  questionText: string,
  questionType?: string
): QuestionEmojiConfig {
  if (!questionText || typeof questionText !== 'string') {
    return { emoji: '💭', animation: 'float' };
  }
  
  const lowerText = questionText.toLowerCase();
  
  // Satisfaction/Rating questions
  if (
    questionType === 'rating' ||
    lowerText.includes('memnun') ||
    lowerText.includes('satisfaction') ||
    lowerText.includes('değerlendir') ||
    lowerText.includes('rate') ||
    lowerText.includes('puan')
  ) {
    return { emoji: '😊', animation: 'float' };
  }
  
  // Discovery/Source questions (Turkish: "nasıl buldunuz/duydunuz")
  if (
    (lowerText.includes('nasıl') && 
      (lowerText.includes('buldunuz') || 
       lowerText.includes('duydunuz') ||
       lowerText.includes('öğrendiniz'))) ||
    lowerText.includes('how did you') ||
    lowerText.includes('where did you') ||
    lowerText.includes('nereden')
  ) {
    return { emoji: '🔍', animation: 'rotate' };
  }
  
  // Experience questions
  if (
    lowerText.includes('deneyim') ||
    lowerText.includes('experience') ||
    lowerText.includes('hizmet') ||
    lowerText.includes('service') ||
    lowerText.includes('kalite') ||
    lowerText.includes('quality')
  ) {
    return { emoji: '💆', animation: 'pulse' };
  }
  
  // Recommendation questions
  if (
    lowerText.includes('tavsiye') ||
    lowerText.includes('recommend') ||
    lowerText.includes('öner') ||
    lowerText.includes('suggest') ||
    lowerText.includes('arkadaş') ||
    lowerText.includes('friend')
  ) {
    return { emoji: '⭐', animation: 'bounce' };
  }
  
  // Feedback/Comment questions
  if (
    lowerText.includes('yorum') ||
    lowerText.includes('comment') ||
    lowerText.includes('görüş') ||
    lowerText.includes('opinion') ||
    lowerText.includes('düşünce') ||
    lowerText.includes('thought')
  ) {
    return { emoji: '💬', animation: 'pulse' };
  }
  
  // Future/Return questions
  if (
    lowerText.includes('tekrar') ||
    lowerText.includes('again') ||
    lowerText.includes('gelecek') ||
    lowerText.includes('future') ||
    lowerText.includes('return')
  ) {
    return { emoji: '🔄', animation: 'rotate' };
  }
  
  // Default
  return { emoji: '💭', animation: 'float' };
}


/**
 * Emoji faces for rating values (1-5 scale)
 * Maps each rating level to an expressive emoji face
 * 
 * Requirements: 2.1
 */
export const RATING_EMOJIS: Record<number, string> = {
  1: '😢', // Very dissatisfied
  2: '😕', // Dissatisfied
  3: '😐', // Neutral
  4: '😊', // Satisfied
  5: '🤩', // Very satisfied
};

/**
 * Sentiment colors for rating values (1-5 scale)
 * Maps each rating level to a color representing the sentiment
 * 
 * Requirements: 2.3
 */
export const RATING_COLORS: Record<number, string> = {
  1: '#ef4444', // Red - Very dissatisfied
  2: '#f97316', // Orange - Dissatisfied
  3: '#eab308', // Yellow - Neutral
  4: '#22c55e', // Green - Satisfied
  5: '#10b981', // Emerald - Very satisfied
};

/**
 * Default rating labels in Turkish
 * Used as fallback when database doesn't provide labels
 */
export const DEFAULT_RATING_LABELS: Record<number, string> = {
  1: 'Çok Kötü',
  2: 'Kötü',
  3: 'Orta',
  4: 'İyi',
  5: 'Mükemmel',
};

/**
 * Get the emoji for a specific rating value
 * 
 * @param rating - Rating value (1-5)
 * @returns Emoji string for the rating
 * 
 * @example
 * getRatingEmoji(1) // '😢'
 * getRatingEmoji(5) // '🤩'
 * getRatingEmoji(0) // '😐' (fallback for invalid)
 */
export function getRatingEmoji(rating: number): string {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return RATING_EMOJIS[3]; // Neutral as fallback
  }
  return RATING_EMOJIS[rating];
}

/**
 * Get the sentiment color for a specific rating value
 * 
 * @param rating - Rating value (1-5)
 * @returns Hex color string for the rating sentiment
 * 
 * @example
 * getRatingColor(1) // '#ef4444' (red)
 * getRatingColor(5) // '#10b981' (emerald)
 */
export function getRatingColor(rating: number): string {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return RATING_COLORS[3]; // Yellow as fallback
  }
  return RATING_COLORS[rating];
}

/**
 * Get the default label for a specific rating value
 * 
 * @param rating - Rating value (1-5)
 * @returns Turkish label string for the rating
 * 
 * @example
 * getRatingLabel(1) // 'Çok Kötü'
 * getRatingLabel(5) // 'Mükemmel'
 */
export function getRatingLabel(rating: number): string {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return DEFAULT_RATING_LABELS[3]; // 'Orta' as fallback
  }
  return DEFAULT_RATING_LABELS[rating];
}

/**
 * Emoji search keywords for better search functionality
 */
export const EMOJI_KEYWORDS: Record<string, string[]> = {
  '😀': ['happy', 'smile', 'grin', 'mutlu', 'gülümseme'],
  '😍': ['love', 'heart eyes', 'aşık', 'kalp gözler'],
  '🤔': ['thinking', 'hmm', 'düşünme', 'düşünüyor'],
  '👍': ['thumbs up', 'like', 'good', 'beğeni', 'iyi'],
  '👎': ['thumbs down', 'dislike', 'bad', 'beğenmeme', 'kötü'],
  '❤️': ['heart', 'love', 'kalp', 'aşk'],
  '💆': ['massage', 'spa', 'masaj', 'rahatlama'],
  '🧘': ['meditation', 'yoga', 'zen', 'meditasyon'],
  '✨': ['sparkles', 'magic', 'pırıltı', 'sihir'],
  '💪': ['strong', 'muscle', 'güçlü', 'kas'],
  '🌿': ['nature', 'leaf', 'doğa', 'yaprak'],
  '🔥': ['fire', 'hot', 'ateş', 'sıcak'],
  '📱': ['phone', 'mobile', 'telefon', 'mobil'],
  '🚶': ['walk', 'walking', 'yürüme', 'yürüyüş'],
  '👥': ['people', 'friends', 'group', 'insanlar', 'arkadaş', 'grup'],
  '🔍': ['search', 'find', 'arama', 'bulma'],
  '⭐': ['star', 'rating', 'yıldız', 'puanlama'],
  '🎯': ['target', 'goal', 'hedef', 'amaç'],
  '🏆': ['trophy', 'winner', 'kupa', 'kazanan'],
  '🎉': ['party', 'celebration', 'parti', 'kutlama'],
  '💡': ['idea', 'light bulb', 'fikir', 'ampul'],
  '🎵': ['music', 'note', 'müzik', 'nota'],
  '🍎': ['apple', 'fruit', 'healthy', 'elma', 'meyve', 'sağlıklı'],
  '🏠': ['home', 'house', 'ev', 'yuva'],
  '🚗': ['car', 'drive', 'araba', 'sürüş'],
  '✈️': ['plane', 'travel', 'uçak', 'seyahat'],
  '🎓': ['education', 'graduate', 'eğitim', 'mezuniyet'],
  '💼': ['work', 'business', 'iş', 'çalışma'],
  '🎨': ['art', 'creative', 'sanat', 'yaratıcı'],
  '📚': ['book', 'study', 'kitap', 'çalışma']
};

/**
 * Search emojis by keyword
 */
export function searchEmojis(query: string): string[] {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  const results: string[] = [];
  
  for (const [emoji, keywords] of Object.entries(EMOJI_KEYWORDS)) {
    if (keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery))) {
      results.push(emoji);
    }
  }
  
  return results;
}

/**
 * Get popular emojis for quick access
 */
export function getPopularEmojis(): string[] {
  return [
    '😀', '😍', '🤔', '👍', '👎', '❤️', '💆', '🧘', '✨', '💪',
    '🌿', '🔥', '📱', '🚶', '👥', '🔍', '⭐', '🎯', '🏆', '🎉',
    '💡', '🎵', '🍎', '🏠', '🚗', '✈️', '🎓', '💼', '🎨', '📚'
  ];
}
