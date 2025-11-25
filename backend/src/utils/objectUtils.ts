
/**
 * Converts a string from camelCase to snake_case.
 * e.g., "shortDescription" -> "short_description"
 */
function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively converts object keys from camelCase to snake_case.
 * This is useful for transforming API request bodies to match database column names.
 * @param obj The object to transform. Can be an object, array, or primitive.
 * @returns A new object with all keys (including nested ones) in snake_case.
 */
export function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => toSnakeCase(v));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const newKey = camelToSnakeCase(key);
      const value = obj[key];
      acc[newKey] = toSnakeCase(value);
      return acc;
    }, {} as Record<string, any>);
  }
  return obj;
}
