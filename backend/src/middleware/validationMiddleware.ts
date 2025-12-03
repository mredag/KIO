import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import i18n from '../i18n/config.js';

/**
 * Input validation middleware using express-validator
 * Provides sanitization and validation for request data
 * Requirements: 33.1 - Input validation middleware
 */

/**
 * Middleware to check validation results and return errors
 */
export function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: i18n.t('errors:validationFailed'),
      details: errors.array(),
    });
    return;
  }
  
  next();
}

/**
 * Validation rules for massage creation/update
 * Requirements: 4.1, 4.2
 */
export const validateMassage: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Massage name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Massage name must be between 1 and 100 characters')
    .escape(),
  
  // Accept both camelCase (from frontend) and snake_case (legacy)
  body('shortDescription')
    .if(body('short_description').not().exists())
    .trim()
    .notEmpty()
    .withMessage('Short description is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Short description must be between 1 and 200 characters')
    .escape(),
  
  body('short_description')
    .if(body('shortDescription').not().exists())
    .trim()
    .notEmpty()
    .withMessage('Short description is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Short description must be between 1 and 200 characters')
    .escape(),
  
  // Accept both camelCase (from frontend) and snake_case (legacy)
  body('longDescription')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Long description must not exceed 2000 characters')
    .escape(),
  
  body('long_description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Long description must not exceed 2000 characters')
    .escape(),
  
  body('duration')
    .optional()
    .trim()
    .escape(),
  
  // Accept both camelCase and snake_case
  body('mediaType')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['video', 'photo'])
    .withMessage('Media type must be either "video" or "photo"'),
  
  body('media_type')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['video', 'photo'])
    .withMessage('Media type must be either "video" or "photo"'),
  
  // Accept both camelCase and snake_case
  body('mediaUrl')
    .optional()
    .trim(),
  
  body('media_url')
    .optional()
    .trim(),
  
  // Accept both camelCase and snake_case
  body('purposeTags')
    .optional()
    .isArray()
    .withMessage('Purpose tags must be an array'),
  
  body('purposeTags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Purpose tag must be between 1 and 50 characters'),
  
  body('purpose_tags')
    .optional()
    .isArray()
    .withMessage('Purpose tags must be an array'),
  
  body('purpose_tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Purpose tag must be between 1 and 50 characters'),
  
  body('sessions')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Sessions must be a non-empty array'),
  
  body('sessions.*.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Session name is required')
    .escape(),
  
  body('sessions.*.price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Session price must be a positive number'),
  
  // Accept both camelCase and snake_case
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('is_featured must be a boolean'),
  
  body('is_featured')
    .optional()
    .isBoolean()
    .withMessage('is_featured must be a boolean'),
  
  // Accept both camelCase and snake_case
  body('isCampaign')
    .optional()
    .isBoolean()
    .withMessage('is_campaign must be a boolean'),
  
  body('is_campaign')
    .optional()
    .isBoolean()
    .withMessage('is_campaign must be a boolean'),
  
  // Accept both camelCase and snake_case
  body('layoutTemplate')
    .optional()
    .isIn(['price-list', 'info-tags', 'media-focus', 'immersive-showcase'])
    .withMessage('layout_template must be one of price-list, info-tags, media-focus, or immersive-showcase'),
  
  body('layout_template')
    .optional()
    .isIn(['price-list', 'info-tags', 'media-focus', 'immersive-showcase'])
    .withMessage('layout_template must be one of price-list, info-tags, media-focus, or immersive-showcase'),
  
  // Accept both camelCase and snake_case
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
];

/**
 * Validation rules for partial massage updates
 * All fields optional but validated when provided
 */
export const validateMassageUpdate: ValidationChain[] = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Massage name must be between 1 and 100 characters')
    .escape(),

  body('short_description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Short description must be between 1 and 200 characters')
    .escape(),

  body('long_description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Long description must not exceed 2000 characters')
    .escape(),

  body('duration')
    .optional()
    .trim()
    .escape(),

  body('media_type')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['video', 'photo'])
    .withMessage('Media type must be either "video" or "photo"'),

  body('media_url')
    .optional()
    .trim(),

  body('purpose_tags')
    .optional()
    .isArray()
    .withMessage('Purpose tags must be an array'),

  body('purpose_tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Purpose tag must be between 1 and 50 characters'),

  body('sessions')
    .optional()
    .isArray()
    .withMessage('Sessions must be an array'),

  body('sessions.*.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Session name is required')
    .escape(),

  body('sessions.*.price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Session price must be a positive number'),

  body('is_featured')
    .optional()
    .isBoolean()
    .withMessage('is_featured must be a boolean'),

  body('is_campaign')
    .optional()
    .isBoolean()
    .withMessage('is_campaign must be a boolean'),

  body('layout_template')
    .optional()
    .isIn(['price-list', 'info-tags', 'media-focus', 'immersive-showcase'])
    .withMessage('layout_template must be one of price-list, info-tags, media-focus, or immersive-showcase'),

  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
];

/**
 * Validation rules for kiosk mode update
 * Requirements: 1.1, 1.4
 */
export const validateKioskMode: ValidationChain[] = [
  body('mode')
    .trim()
    .notEmpty()
    .withMessage('Kiosk mode is required')
    .isIn(['digital-menu', 'survey', 'google-qr', 'coupon-qr'])
    .withMessage('Invalid kiosk mode'),
  
  body('activeSurveyId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Active survey ID cannot be empty if provided'),
  
  body('coupon_qr_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Coupon QR URL must be a valid URL'),
  
  body('coupon_token')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Coupon token cannot be empty if provided'),
];

/**
 * Validation rules for survey template update
 * Requirements: 9.2, 9.3
 */
export const validateSurveyTemplate: ValidationChain[] = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters')
    .escape(),
  
  body('description')
    .optional()
    .trim()
    .escape(),
  
  body('questions')
    .optional()
    .isArray()
    .withMessage('Questions must be an array'),
  
  body('questions.*.text')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Question text is required')
    .escape(),
  
  body('questions.*.type')
    .optional()
    .isIn(['rating', 'single-choice', 'text'])
    .withMessage('Invalid question type'),
  
  body('questions.*.options')
    .optional()
    .isArray()
    .withMessage('Question options must be an array'),
  
  body('questions.*.isRequired')
    .optional()
    .isBoolean()
    .withMessage('isRequired must be a boolean'),
  
  body('questions.*.trackImportant')
    .optional()
    .isBoolean()
    .withMessage('trackImportant must be a boolean'),
  
  body('questions.*.conditionalOn')
    .optional()
    .isObject()
    .withMessage('conditionalOn must be an object'),
  
  body('questions.*.conditionalOn.questionId')
    .optional()
    .isString()
    .withMessage('conditionalOn.questionId must be a string'),
  
  body('questions.*.conditionalOn.values')
    .optional()
    .isArray()
    .withMessage('conditionalOn.values must be an array'),
  
  body('questions.*.googleReviewAction')
    .optional()
    .isObject()
    .withMessage('googleReviewAction must be an object'),
  
  body('questions.*.googleReviewAction.enabled')
    .optional()
    .isBoolean()
    .withMessage('googleReviewAction.enabled must be a boolean'),
  
  body('questions.*.googleReviewAction.minRating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('googleReviewAction.minRating must be between 1 and 5'),
  
  body('questions.*.isRequired')
    .optional()
    .isBoolean()
    .withMessage('isRequired must be a boolean'),
];

/**
 * Validation rules for system settings
 * Requirements: 18.2
 */
export const validateSettings: ValidationChain[] = [
  body('slideshowTimeout')
    .optional()
    .isInt({ min: 5, max: 300 })
    .withMessage('Slideshow timeout must be between 5 and 300 seconds'),
  
  body('surveyTimeout')
    .optional()
    .isInt({ min: 5, max: 300 })
    .withMessage('Survey timeout must be between 5 and 300 seconds'),
  
  body('googleQrDisplayDuration')
    .optional()
    .isInt({ min: 5, max: 300 })
    .withMessage('Google QR display duration must be between 5 and 300 seconds'),

  body('kioskTheme')
    .optional()
    .isIn(['classic', 'immersive'])
    .withMessage('Kiosk theme must be classic or immersive'),
  
  body('googleReviewUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Google review URL must be a valid URL'),
  
  body('googleReviewTitle')
    .optional()
    .trim()
    .escape(),
  
  body('googleReviewDescription')
    .optional()
    .trim()
    .escape(),
  
  body('sheetsSheetId')
    .optional()
    .trim(),
  
  body('sheetsSheetName')
    .optional()
    .trim(),
];

/**
 * Validation rules for login
 * Requirements: 12.1, 12.2
 */
export const validateLogin: ValidationChain[] = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Username must be between 1 and 50 characters')
    .escape(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Password must be between 1 and 100 characters'),
];

/**
 * Validation rules for password change
 * Requirements: 12.5
 */
export const validatePasswordChange: ValidationChain[] = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

/**
 * Validation rules for survey response submission
 * Requirements: 5.3, 6.3
 */
export const validateSurveyResponse: ValidationChain[] = [
  body('surveyId')
    .trim()
    .notEmpty()
    .withMessage('Survey ID is required'),
  
  body('answers')
    .isObject()
    .withMessage('Answers must be an object'),
];

/**
 * Validation rules for ID parameters
 */
export const validateIdParam: ValidationChain[] = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('ID parameter is required'),
];

/**
 * Sanitize and validate query parameters
 */
export const validateQueryParams: ValidationChain[] = [
  query('*')
    .trim()
    .escape(),
];
