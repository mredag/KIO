import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

/**
 * Formats a date in Turkish format: DD.MM.YYYY
 * @param date - Date object or ISO string
 * @returns Formatted date string (e.g., "23.11.2024")
 */
export const formatDate = (date: Date | string): string => {
  return format(new Date(date), 'dd.MM.yyyy', { locale: tr });
};

/**
 * Formats a date and time in Turkish format: DD.MM.YYYY HH:mm
 * @param date - Date object or ISO string
 * @returns Formatted date-time string (e.g., "23.11.2024 14:30")
 */
export const formatDateTime = (date: Date | string): string => {
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: tr });
};

/**
 * Formats time in 24-hour format: HH:mm
 * @param date - Date object or ISO string
 * @returns Formatted time string (e.g., "14:30")
 */
export const formatTime = (date: Date | string): string => {
  return format(new Date(date), 'HH:mm', { locale: tr });
};

/**
 * Formats relative time in Turkish (e.g., "2 saat önce", "3 gün önce")
 * @param date - Date object or ISO string
 * @returns Relative time string in Turkish
 */
export const formatRelativeTime = (date: Date | string): string => {
  return formatDistanceToNow(new Date(date), { 
    addSuffix: true, 
    locale: tr 
  });
};
