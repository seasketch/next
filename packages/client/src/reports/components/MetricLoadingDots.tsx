/**
 * Animated loading dots component for use in report widgets.
 * Reuses the same CSS animation as InlineMetric.
 */
export function MetricLoadingDots({
  className,
}: {
  /**
   * Additional CSS classes to apply to the container.
   * Default includes inline-flex items-center justify-center for inline display.
   * You can add positioning classes like "ml-2", "mr-auto", etc. to tweak positioning.
   */
  className?: string;
}) {
  const defaultClasses = "metric-dots inline-flex items-center justify-center";
  return (
    <span
      className={className ? `${defaultClasses} ${className}` : defaultClasses}
      aria-hidden="true"
    >
      <span className="metric-dot" />
      <span className="metric-dot" />
      <span className="metric-dot" />
    </span>
  );
}

