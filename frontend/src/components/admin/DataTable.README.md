# DataTable Component

A fully-featured, reusable data table component for the admin dashboard with sorting, filtering, pagination, and customizable rendering.

## Features

✅ **Sortable Columns** - Click column headers to sort ascending/descending/unsorted
✅ **Search/Filter** - Debounced search (300ms) across all columns
✅ **Pagination** - Automatic pagination when data exceeds pageSize (default: 10 rows)
✅ **Custom Cell Rendering** - Use accessor functions for custom JSX rendering
✅ **Row Click Handler** - Optional callback for row interactions
✅ **Loading State** - Skeleton loader integration
✅ **Empty State** - Customizable empty state message with icon
✅ **Dark Mode Support** - Full dark mode styling
✅ **Responsive Design** - Mobile-friendly with horizontal scroll
✅ **Type-Safe** - Full TypeScript support with generics

## Requirements Validated

This component satisfies the following requirements from the design document:

- **8.1**: Sortable column headers with visual sort indicators ✅
- **8.2**: Click column header to sort data with indicator updates ✅
- **8.3**: Pagination controls shown when > 10 rows ✅
- **8.4**: Debounced search filter (300ms delay) ✅
- **8.5**: Empty state with clear messaging ✅

## Installation

The component is already installed and exported from `frontend/src/components/admin/index.ts`:

```typescript
import { DataTable, Column } from '@/components/admin';
```

## Basic Usage

```typescript
import { DataTable, Column } from '@/components/admin';

interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

const columns: Column<User>[] = [
  { id: 'id', header: 'ID', accessor: 'id', sortable: true },
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  { id: 'email', header: 'Email', accessor: 'email', sortable: true },
  { id: 'active', header: 'Active', accessor: 'active', sortable: false },
];

const users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', active: true },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: false },
];

function UsersTable() {
  return (
    <DataTable
      data={users}
      columns={columns}
      searchable={true}
      searchPlaceholder="Search users..."
      emptyMessage="No users found"
    />
  );
}
```

## Props

### DataTableProps<T>

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | required | Array of data objects to display |
| `columns` | `Column<T>[]` | required | Column definitions |
| `pageSize` | `number` | `10` | Number of rows per page |
| `searchable` | `boolean` | `false` | Enable search/filter functionality |
| `searchPlaceholder` | `string` | `'Search...'` | Placeholder text for search input |
| `emptyMessage` | `string` | `'No data available'` | Message shown when data is empty |
| `isLoading` | `boolean` | `false` | Show skeleton loader |
| `onRowClick` | `(row: T) => void` | `undefined` | Callback when row is clicked |

### Column<T>

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique column identifier |
| `header` | `string` | Column header text |
| `accessor` | `keyof T \| (row: T) => ReactNode` | Property key or render function |
| `sortable` | `boolean` | Enable sorting for this column |
| `width` | `string` | Optional Tailwind width class (e.g., `'w-20'`) |

## Advanced Usage

### Custom Cell Rendering

Use an accessor function to render custom JSX:

```typescript
const columns: Column<Product>[] = [
  {
    id: 'price',
    header: 'Price',
    accessor: (row) => (
      <span className="font-semibold text-emerald-600">
        ${row.price.toFixed(2)}
      </span>
    ),
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    accessor: (row) => (
      <span className={`px-2 py-1 rounded-full text-xs ${
        row.inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}>
        {row.inStock ? 'In Stock' : 'Out of Stock'}
      </span>
    ),
  },
];
```

### Row Click Handler

```typescript
function ProductsTable() {
  const navigate = useNavigate();
  
  const handleRowClick = (product: Product) => {
    navigate(`/admin/products/${product.id}`);
  };
  
  return (
    <DataTable
      data={products}
      columns={columns}
      onRowClick={handleRowClick}
    />
  );
}
```

### With Loading State

```typescript
function UsersTable() {
  const { data: users, isLoading } = useUsers();
  
  return (
    <DataTable
      data={users || []}
      columns={columns}
      isLoading={isLoading}
    />
  );
}
```

### With Pagination

Pagination automatically appears when data length exceeds `pageSize`:

```typescript
<DataTable
  data={largeDataset}
  columns={columns}
  pageSize={20}  // Show 20 rows per page
/>
```

## Sorting Behavior

- **First click**: Sort ascending (A→Z, 0→9)
- **Second click**: Sort descending (Z→A, 9→0)
- **Third click**: Remove sort (return to original order)

Sort indicators:
- ↑ Ascending
- ↓ Descending
- ⇅ Unsorted (gray)

## Search/Filter Behavior

- Searches across all columns
- Case-insensitive
- Debounced by 300ms (prevents excessive filtering)
- Resets to page 1 when search query changes
- Searches both string values and rendered content

## Data Type Handling

The table automatically handles different data types:

- **Strings**: Displayed as-is
- **Numbers**: Displayed as-is
- **Booleans**: Rendered as "Yes" / "No"
- **Dates**: Formatted using `toLocaleDateString()`
- **null/undefined**: Displayed as "—"
- **Custom**: Use accessor function for full control

## Styling

The component uses Tailwind CSS and supports:
- Light/dark mode (via `dark:` classes)
- Hover states on sortable headers and clickable rows
- Focus states for accessibility
- Responsive design with horizontal scroll on mobile

## Accessibility

- Semantic HTML (`<table>`, `<thead>`, `<tbody>`)
- Sortable columns are keyboard accessible
- Loading state uses `role="status"` with `aria-label`
- Empty state includes descriptive icon and text

## Performance

- **Debounced search**: Prevents excessive re-renders during typing
- **Memoized filtering**: Uses `useMemo` for filtered data
- **Memoized sorting**: Uses `useMemo` for sorted data
- **Memoized pagination**: Uses `useMemo` for paginated data
- **Efficient sorting**: Single-pass sort with proper type handling

## Examples

See `DataTable.example.tsx` for complete working examples:
1. Basic table with sortable columns
2. Custom cell rendering with badges
3. Paginated table with 25+ rows
4. Loading state
5. Empty state

## Integration with Existing Pages

The DataTable can replace existing table implementations in:
- MassagesPage
- SurveysPage
- SurveyResponsesPage
- CouponRedemptionsPage
- BackupPage
- SystemLogsPage

Example migration:

```typescript
// Before: Custom table implementation
<div className="overflow-x-auto">
  <table>
    <thead>...</thead>
    <tbody>
      {data.map(item => <tr>...</tr>)}
    </tbody>
  </table>
</div>

// After: DataTable component
<DataTable
  data={data}
  columns={columns}
  searchable={true}
  onRowClick={handleRowClick}
/>
```

## Testing

The component includes:
- TypeScript type checking (no errors)
- Example usage file with 5 different scenarios
- Integration-ready for existing admin pages

## Future Enhancements

Potential additions (not in current scope):
- Column visibility toggle
- Column reordering
- Export to CSV/Excel
- Bulk selection with checkboxes
- Column filtering (per-column filters)
- Sticky header on scroll
- Virtual scrolling for very large datasets

## Support

For issues or questions, refer to:
- Design document: `.kiro/specs/admin-dashboard-redesign/design.md`
- Requirements: `.kiro/specs/admin-dashboard-redesign/requirements.md`
- Task list: `.kiro/specs/admin-dashboard-redesign/tasks.md`
