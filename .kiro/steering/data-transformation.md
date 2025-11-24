# Data Transformation Between Backend and Frontend

## Critical Issue: snake_case vs camelCase

### Problem
The backend uses **snake_case** (database convention) while the frontend uses **camelCase** (JavaScript convention). This mismatch causes runtime errors when components try to access properties that don't exist.

### Example Error
```javascript
// Backend returns:
{ short_description: "...", is_featured: 1, purpose_tags: [...] }

// Frontend expects:
{ shortDescription: "...", isFeatured: true, purposeTags: [...] }

// Result: "Cannot read properties of undefined"
```

## Solution: Transform Data in API Hooks

### Backend Types (snake_case)
**Location:** `backend/src/database/types.ts`

```typescript
export interface Massage {
  id: string;
  name: string;
  short_description: string;
  long_description: string | null;
  duration: string | null;
  media_type: 'video' | 'photo' | null;
  media_url: string | null;
  purpose_tags: string[];
  sessions: Session[];
  is_featured: number; // SQLite boolean (0 or 1)
  is_campaign: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

### Frontend Types (camelCase)
**Location:** `frontend/src/types/index.ts`

```typescript
export interface Massage {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  duration: string;
  mediaType: 'video' | 'photo';
  mediaUrl: string;
  purposeTags: string[];
  sessions: Session[];
  isFeatured: boolean;
  isCampaign: boolean;
  sortOrder: number;
}
```

### Transformation Function Template

Add this to your API hooks:

```typescript
function transformMassage(data: any): Massage {
  return {
    id: data.id,
    name: data.name,
    shortDescription: data.short_description,
    longDescription: data.long_description || '',
    duration: data.duration || '',
    mediaType: data.media_type || '',
    mediaUrl: data.media_url || '',
    purposeTags: data.purpose_tags || [],
    sessions: data.sessions || [],
    isFeatured: data.is_featured === 1,
    isCampaign: data.is_campaign === 1,
    sortOrder: data.sort_order || 0,
  };
}
```

### Where to Apply Transformations

#### 1. Admin API Hook
**File:** `frontend/src/hooks/useAdminApi.ts`

```typescript
export function useMassages() {
  return useQuery({
    queryKey: ['admin', 'massages'],
    queryFn: async () => {
      const response = await api.get<any[]>('/admin/massages');
      return response.data.map(transformMassage);
    },
  });
}
```

#### 2. Kiosk API Hook
**File:** `frontend/src/hooks/useKioskApi.ts`

```typescript
export function useMassageMenu() {
  return useQuery({
    queryKey: ['kiosk', 'menu'],
    queryFn: async () => {
      const response = await api.get<{ featured: any[]; regular: any[] }>('/kiosk/menu');
      
      const transformMassage = (data: any): Massage => ({
        // ... transformation logic
      });
      
      const allMassages = [
        ...response.data.featured.map(transformMassage),
        ...response.data.regular.map(transformMassage)
      ];
      
      return allMassages;
    },
  });
}
```

## Common Transformation Patterns

### Boolean Conversion
```typescript
// SQLite stores booleans as 0 or 1
isFeatured: data.is_featured === 1
```

### Null/Undefined Handling
```typescript
// Provide defaults for optional fields
duration: data.duration || ''
purposeTags: data.purpose_tags || []
```

### Nested Objects
```typescript
// Sessions are already in correct format (JSON parsed by backend)
sessions: data.sessions || []
```

## Database Layer (Keep snake_case)

**File:** `backend/src/database/DatabaseService.ts`

```typescript
private parseMassageRow(row: any): Massage {
  return {
    ...row,
    purpose_tags: JSON.parse(row.purpose_tags || '[]'),
    sessions: JSON.parse(row.sessions || '[]'),
  };
}
```

**Important:** Keep backend types in snake_case to match database schema. Transform only at the API boundary (frontend hooks).

## Testing Transformations

### Check for Missing Properties
```javascript
// In browser console or Puppeteer
const massage = await fetch('/api/kiosk/menu').then(r => r.json());
console.log('Backend format:', massage.featured[0]);
// Should show: { short_description, is_featured, purpose_tags }

// After transformation in frontend
console.log('Frontend format:', transformedMassage);
// Should show: { shortDescription, isFeatured, purposeTags }
```

### Common Errors to Watch For

1. **"Cannot read properties of undefined (reading 'length')"**
   - Cause: Trying to access `purposeTags.length` but property is `purpose_tags`
   - Fix: Add transformation function

2. **"massages is not iterable"**
   - Cause: Data is object instead of array
   - Fix: Add `Array.isArray()` check + transformation

3. **Boolean comparison fails**
   - Cause: Comparing `isFeatured === true` but value is `1`
   - Fix: Convert `is_featured === 1` to boolean

## Best Practices

### ✅ DO
- Transform data in API hooks (single source of truth)
- Keep backend types matching database schema
- Use TypeScript `any` type for raw API responses
- Provide defaults for optional fields
- Convert SQLite integers to booleans

### ❌ DON'T
- Transform data in components (too late, causes errors)
- Change backend types to camelCase (breaks database queries)
- Assume API response matches frontend types
- Skip null/undefined checks
- Mix snake_case and camelCase in same layer

## Debugging Checklist

When you see property access errors:

1. ✅ Check browser console for exact error
2. ✅ Verify API response format (Network tab)
3. ✅ Compare backend type vs frontend type
4. ✅ Add transformation function if missing
5. ✅ Test with real data
6. ✅ Add null/undefined guards

## Quick Fix Template

If you encounter a new entity with this issue:

```typescript
// 1. Check backend type (snake_case)
// backend/src/database/types.ts

// 2. Check frontend type (camelCase)
// frontend/src/types/index.ts

// 3. Add transformation in API hook
function transformEntity(data: any): Entity {
  return {
    id: data.id,
    someField: data.some_field,
    anotherField: data.another_field || 'default',
    isActive: data.is_active === 1,
  };
}

// 4. Apply in query
queryFn: async () => {
  const response = await api.get('/endpoint');
  return response.data.map(transformEntity);
}
```

## Summary

**The golden rule:** Backend speaks snake_case, frontend speaks camelCase. Transform at the API boundary (hooks), not in components.

This prevents runtime errors and keeps code maintainable.
