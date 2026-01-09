import { lazy, Suspense } from 'react';
import { SkeletonChart } from '../ui/Skeleton';

// Lazy load chart components
const LineChart = lazy(() =>
  import('./LineChart').then((module) => ({ default: module.LineChart }))
);

const BarChart = lazy(() =>
  import('./BarChart').then((module) => ({ default: module.BarChart }))
);

// Wrapper components with Suspense boundaries
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

interface BarChartProps {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function LazyLineChart(props: LineChartProps) {
  return (
    <Suspense fallback={<SkeletonChart type="line" height="h-80" />}>
      <LineChart {...props} />
    </Suspense>
  );
}

export function LazyBarChart(props: BarChartProps) {
  return (
    <Suspense fallback={<SkeletonChart type="bar" height="h-80" />}>
      <BarChart {...props} />
    </Suspense>
  );
}
