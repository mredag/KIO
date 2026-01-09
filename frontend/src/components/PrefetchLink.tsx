import { Link, LinkProps } from 'react-router-dom';
import { prefetchRoute } from '../lib/routePrefetch';

/**
 * Enhanced Link component with prefetching on hover
 * Improves perceived performance by loading routes before navigation
 */
interface PrefetchLinkProps extends LinkProps {
  prefetch?: boolean; // Enable/disable prefetching (default: true)
  prefetchDelay?: number; // Delay before prefetching in ms (default: 100)
}

export function PrefetchLink({
  to,
  prefetch = true,
  prefetchDelay = 100,
  onMouseEnter,
  onTouchStart,
  children,
  ...props
}: PrefetchLinkProps) {
  let prefetchTimeout: NodeJS.Timeout | null = null;

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (prefetch && typeof to === 'string') {
      // Clear any existing timeout
      if (prefetchTimeout) {
        clearTimeout(prefetchTimeout);
      }

      // Prefetch after delay
      prefetchTimeout = setTimeout(() => {
        prefetchRoute(to);
      }, prefetchDelay);
    }

    // Call original onMouseEnter if provided
    if (onMouseEnter) {
      onMouseEnter(e);
    }
  };

  const handleMouseLeave = () => {
    // Clear timeout if user moves away before delay
    if (prefetchTimeout) {
      clearTimeout(prefetchTimeout);
      prefetchTimeout = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLAnchorElement>) => {
    // Prefetch immediately on touch (mobile)
    if (prefetch && typeof to === 'string') {
      prefetchRoute(to);
    }

    // Call original onTouchStart if provided
    if (onTouchStart) {
      onTouchStart(e);
    }
  };

  return (
    <Link
      to={to}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      {...props}
    >
      {children}
    </Link>
  );
}
