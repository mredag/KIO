import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SkeletonChart } from '../ui/Skeleton';

interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

interface LineChartProps {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50 mb-1">
          {label}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Value: <span className="font-semibold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
}

export function LineChart({
  data,
  title,
  color = '#0284c7',
  isLoading = false,
  emptyMessage = 'No data available',
}: LineChartProps) {
  if (isLoading) {
    return <SkeletonChart type="line" height="h-64" />;
  }

  const isEmpty = !data || data.length === 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4" id={`chart-${title.replace(/\s+/g, '-').toLowerCase()}`}>
        {title}
      </h3>
      {isEmpty ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <RechartsLineChart
            data={data}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            aria-labelledby={`chart-${title.replace(/\s+/g, '-').toLowerCase()}`}
            role="img"
            aria-label={`Line chart showing ${title}`}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              className="dark:stroke-gray-700"
            />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              className="dark:stroke-gray-400"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#6b7280"
              className="dark:stroke-gray-400"
              style={{ fontSize: '12px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6 }}
              animationDuration={500}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
