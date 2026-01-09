/**
 * DataTable Component Usage Examples
 * 
 * This file demonstrates how to use the DataTable component with various configurations.
 */

import { DataTable, Column } from './DataTable';

// Example 1: Basic table with sortable columns
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

const users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', active: true },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', active: true },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', active: false },
];

const userColumns: Column<User>[] = [
  { id: 'id', header: 'ID', accessor: 'id', sortable: true, width: 'w-20' },
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  { id: 'email', header: 'Email', accessor: 'email', sortable: true },
  { id: 'role', header: 'Role', accessor: 'role', sortable: false },
  { id: 'active', header: 'Active', accessor: 'active', sortable: true },
];

export function BasicTableExample() {
  return (
    <DataTable
      data={users}
      columns={userColumns}
      searchable={true}
      searchPlaceholder="Search users..."
      emptyMessage="No users found"
    />
  );
}

// Example 2: Table with custom cell rendering
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

const products: Product[] = [
  { id: 'P001', name: 'Laptop', price: 999.99, stock: 15, category: 'Electronics' },
  { id: 'P002', name: 'Mouse', price: 29.99, stock: 50, category: 'Accessories' },
  { id: 'P003', name: 'Keyboard', price: 79.99, stock: 0, category: 'Accessories' },
];

const productColumns: Column<Product>[] = [
  { id: 'id', header: 'Product ID', accessor: 'id', sortable: true },
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  {
    id: 'price',
    header: 'Price',
    accessor: (row) => (
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        ${row.price.toFixed(2)}
      </span>
    ),
    sortable: true,
  },
  {
    id: 'stock',
    header: 'Stock',
    accessor: (row) => (
      <span
        className={`
          px-2 py-1 rounded-full text-xs font-medium
          ${row.stock > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}
        `}
      >
        {row.stock > 0 ? `${row.stock} in stock` : 'Out of stock'}
      </span>
    ),
    sortable: false,
  },
  { id: 'category', header: 'Category', accessor: 'category', sortable: true },
];

export function CustomCellTableExample() {
  const handleRowClick = (product: Product) => {
    console.log('Product clicked:', product);
  };

  return (
    <DataTable
      data={products}
      columns={productColumns}
      searchable={true}
      onRowClick={handleRowClick}
      emptyMessage="No products available"
    />
  );
}

// Example 3: Table with pagination
interface Transaction {
  id: string;
  date: Date;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  description: string;
}

const generateTransactions = (count: number): Transaction[] => {
  const statuses: Transaction['status'][] = ['completed', 'pending', 'failed'];
  return Array.from({ length: count }, (_, i) => ({
    id: `TXN${String(i + 1).padStart(4, '0')}`,
    date: new Date(Date.now() - i * 86400000), // Each day back
    amount: Math.random() * 1000,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    description: `Transaction ${i + 1}`,
  }));
};

const transactions = generateTransactions(25);

const transactionColumns: Column<Transaction>[] = [
  { id: 'id', header: 'Transaction ID', accessor: 'id', sortable: true },
  {
    id: 'date',
    header: 'Date',
    accessor: (row) => row.date.toLocaleDateString(),
    sortable: true,
  },
  {
    id: 'amount',
    header: 'Amount',
    accessor: (row) => `$${row.amount.toFixed(2)}`,
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    accessor: (row) => {
      const statusColors = {
        completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      };
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[row.status]}`}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </span>
      );
    },
    sortable: true,
  },
  { id: 'description', header: 'Description', accessor: 'description', sortable: false },
];

export function PaginatedTableExample() {
  return (
    <DataTable
      data={transactions}
      columns={transactionColumns}
      pageSize={10}
      searchable={true}
      searchPlaceholder="Search transactions..."
      emptyMessage="No transactions found"
    />
  );
}

// Example 4: Loading state
export function LoadingTableExample() {
  return (
    <DataTable
      data={[]}
      columns={userColumns}
      isLoading={true}
    />
  );
}

// Example 5: Empty state
export function EmptyTableExample() {
  return (
    <DataTable
      data={[]}
      columns={userColumns}
      emptyMessage="No data available. Click 'Add New' to get started."
    />
  );
}
