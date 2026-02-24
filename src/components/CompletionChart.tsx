import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface CompletionChartProps {
  completionHistory: Array<{ date: number; delay: number }>;
}

export function CompletionChart({ completionHistory }: CompletionChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!chartRef.current || completionHistory.length === 0) return;

    // Prepare data for uPlot (convert to TypedArrays for better performance)
    const timestamps = new Float64Array(completionHistory.map(c => c.date / 1000)); // Convert to seconds
    const delays = new Float64Array(completionHistory.map(c => c.delay));

    const data: uPlot.AlignedData = [timestamps, delays];

    // Get CSS variable values
    const rootStyles = getComputedStyle(document.documentElement);
    const accentGreen = rootStyles.getPropertyValue('--accent-green').trim();
    const accentBlue = rootStyles.getPropertyValue('--accent-blue').trim();
    const textPrimary = rootStyles.getPropertyValue('--text-primary').trim();
    const borderColor = rootStyles.getPropertyValue('--border-color').trim();

    // uPlot options
    const opts: uPlot.Options = {
      width: chartRef.current.offsetWidth,
      height: 300,
      series: [
        {
          label: 'Date'
        },
        {
          label: 'Delay (days)',
          stroke: accentBlue || '#4299e1',
          width: 2,
          points: {
            show: true,
            size: 6,
            fill: ((_self: uPlot, _seriesIdx: number) => {
              // Color all points uniformly based on accent color
              // Individual point coloring would require a different approach
              return accentBlue || '#4299e1';
            }) as any
          }
        }
      ],
      axes: [
        {
          label: 'Date'
        },
        {
          label: 'Delay (days)',
          stroke: textPrimary || '#ffffff',
          grid: {
            show: true,
            stroke: borderColor || '#374151',
            width: 1
          }
        }
      ],
      scales: {
        x: {
          time: true
        },
        y: {
          // Include y=0 in view
        }
      },
      hooks: {
        // Add horizontal band representing "on-time" zone
        // Since due dates are always at midnight (00:00:00), the on-time zone
        // is from 0 (midnight) to +1 (next midnight), representing 00:00 to 23:59 on the due day
        draw: [
          (u) => {
            const ctx = u.ctx;
            const y0 = u.valToPos(0, 'y', true);      // Due time (midnight)
            const y1 = u.valToPos(1, 'y', true);      // End of due day (next midnight)

            ctx.save();
            ctx.fillStyle = accentGreen || '#48bb78';
            ctx.globalAlpha = 0.15;
            ctx.fillRect(
              u.bbox.left,
              y1,
              u.bbox.width,
              y0 - y1
            );
            ctx.restore();

            // Draw line at y=0 (exact due time - midnight)
            ctx.strokeStyle = accentGreen || '#48bb78';
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(u.bbox.left, y0);
            ctx.lineTo(u.bbox.left + u.bbox.width, y0);
            ctx.stroke();
            ctx.restore();
          }
        ]
      }
    };

    // Create chart
    plotRef.current = new uPlot(opts, data, chartRef.current);

    // Cleanup
    return () => {
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [completionHistory]);

  return <div ref={chartRef} style="width: 100%;" />;
}
