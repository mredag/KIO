// Performance monitoring utility for translations and app performance

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, number> = new Map();

  // Start measuring a performance metric
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  // End measuring and record the metric
  measure(name: string): number | null {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`[Performance] No start mark found for: ${name}`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
    });

    this.marks.delete(name);

    // Log if duration exceeds threshold
    if (duration > 100) {
      console.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms (> 100ms threshold)`);
    } else {
      console.log(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  // Get all recorded metrics
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Get metrics by name
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name);
  }

  // Get average duration for a metric
  getAverageDuration(name: string): number {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / metrics.length;
  }

  // Clear all metrics
  clear(): void {
    this.metrics = [];
    this.marks.clear();
  }

  // Get performance summary
  getSummary(): Record<string, { count: number; avg: number; min: number; max: number }> {
    const summary: Record<string, { count: number; avg: number; min: number; max: number }> = {};

    this.metrics.forEach((metric) => {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          avg: 0,
          min: Infinity,
          max: -Infinity,
        };
      }

      const s = summary[metric.name];
      s.count++;
      s.min = Math.min(s.min, metric.duration);
      s.max = Math.max(s.max, metric.duration);
    });

    // Calculate averages
    Object.keys(summary).forEach((name) => {
      const metrics = this.getMetricsByName(name);
      const total = metrics.reduce((sum, m) => sum + m.duration, 0);
      summary[name].avg = total / metrics.length;
    });

    return summary;
  }

  // Monitor translation loading
  monitorTranslationLoad(namespace: string, loadFn: () => Promise<any>): Promise<any> {
    const metricName = `translation-load-${namespace}`;
    this.mark(metricName);

    return loadFn().then((result) => {
      const duration = this.measure(metricName);
      
      // Warn if translation loading is slow (> 500ms as per requirement)
      if (duration && duration > 500) {
        console.warn(
          `[Performance] Translation loading for ${namespace} exceeded 500ms: ${duration.toFixed(2)}ms`
        );
      }

      return result;
    });
  }

  // Monitor component render time
  monitorRender(componentName: string, renderFn: () => void): void {
    const metricName = `render-${componentName}`;
    this.mark(metricName);
    renderFn();
    this.measure(metricName);
  }

  // Get Web Vitals
  getWebVitals(): void {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('[Web Vitals] LCP:', lastEntry.startTime.toFixed(2), 'ms');
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          console.log('[Web Vitals] FID:', entry.processingStart - entry.startTime, 'ms');
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift (CLS)
      let clsScore = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
          }
        });
        console.log('[Web Vitals] CLS:', clsScore.toFixed(4));
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-start Web Vitals monitoring in production
if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
  performanceMonitor.getWebVitals();
}

// Export for debugging
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  (window as any).performanceMonitor = performanceMonitor;
}
