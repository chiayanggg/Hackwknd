// Minimal inline SVG icon set — no emoji, no icon-font dependency. Stroke-based,
// 24x24 viewBox, currentColor so they inherit text color everywhere they're used.
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(children: ReactNode, props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

export const IconRoundabout = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M3 12h4M17 12h4M12 3v4M12 17v4" />
    </>,
    p
  );

export const IconWiden = (p: IconProps) =>
  base(
    <>
      <path d="M3 8h18M3 16h18" />
      <path d="M7 5l-3 3 3 3M17 5l3 3-3 3M7 13l-3 3 3 3M17 13l3 3-3 3" />
    </>,
    p
  );

export const IconTrafficLight = (p: IconProps) =>
  base(
    <>
      <rect x="9" y="2" width="6" height="14" rx="2" />
      <circle cx="12" cy="5.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
      <path d="M12 16v6M8 22h8" />
    </>,
    p
  );

export const IconBus = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="5" width="18" height="11" rx="2" />
      <path d="M3 11h18" />
      <circle cx="7.5" cy="18.5" r="1.5" />
      <circle cx="16.5" cy="18.5" r="1.5" />
    </>,
    p
  );

export const IconBuilding = (p: IconProps) =>
  base(
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
    </>,
    p
  );

export const IconTree = (p: IconProps) =>
  base(
    <>
      <path d="M12 3l5 7h-3l4 5h-4v6h-4v-6H6l4-5H7z" />
    </>,
    p
  );

export const IconBolt = (p: IconProps) =>
  base(<path d="M13 2 4 14h6l-1 8 9-12h-6z" strokeLinejoin="round" />, p);

export const IconSchool = (p: IconProps) =>
  base(
    <>
      <path d="M12 3 2 8l10 5 10-5-10-5Z" />
      <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
    </>,
    p
  );

export const IconHospital = (p: IconProps) =>
  base(
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </>,
    p
  );

export const IconWater = (p: IconProps) =>
  base(<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />, p);

export const IconCoin = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15V9l3 1.5L15 9v6" />
    </>,
    p
  );

export const IconClock = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>,
    p
  );

export const IconLeaf = (p: IconProps) =>
  base(<path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14Zm0 0c2-5 5-8 9-10" />, p);

export const IconPulse = (p: IconProps) =>
  base(<path d="M3 12h4l2-7 4 14 2-7h6" />, p);

export const IconUsers = (p: IconProps) =>
  base(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
      <circle cx="17.5" cy="9" r="2.2" />
      <path d="M15 14.2c2.6.3 4.7 2.4 4.7 5.8" />
    </>,
    p
  );

export const IconSpark = (p: IconProps) =>
  base(
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </>,
    p
  );

export const IconWarning = (p: IconProps) =>
  base(
    <>
      <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" />
    </>,
    p
  );

export const IconClose = (p: IconProps) => base(<path d="M6 6l12 12M18 6L6 18" />, p);

export const IconReport = (p: IconProps) =>
  base(
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>,
    p
  );
