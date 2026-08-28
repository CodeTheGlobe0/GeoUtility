import React, { useId } from 'react';

/* Minimal, consistent line-icon set used throughout the app in place of emoji. */

const base = (size, extra = {}) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...extra,
});

export const IconMoon = ({ size = 18, ...props }) => {
  const uid = useId();
  const maskId = `moon-mask-${uid}`;
  return (
    <svg {...base(size, { stroke: 'none' })} {...props}>
      <mask id={maskId}>
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <circle cx="15.5" cy="8.5" r="6.5" fill="black" />
      </mask>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
};

export const IconShield = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M12 3 L19 6 L19 11 C19 16 15.5 19.5 12 21 C8.5 19.5 5 16 5 11 L5 6 Z" />
  </svg>
);

export const IconUpload = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M12 15.5V4" />
    <path d="M8 8l4-4 4 4" />
    <path d="M4 16v2.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V16" />
  </svg>
);

export const IconUser = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="8" r="3.3" />
    <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
  </svg>
);

export const IconLogOut = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M9.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.5" />
    <path d="M14.5 16l4.5-4-4.5-4" />
    <path d="M19 12H9.5" />
  </svg>
);

export const IconMenu = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <line x1="4" y1="6.5" x2="20" y2="6.5" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17.5" x2="20" y2="17.5" />
  </svg>
);

export const IconClose = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

export const IconPlus = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconMinus = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const IconSearch = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <line x1="20" y1="20" x2="15.2" y2="15.2" />
  </svg>
);

export const IconRuler = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <rect x="3" y="8.5" width="18" height="7" rx="1.2" />
    <line x1="7" y1="8.5" x2="7" y2="12" />
    <line x1="11" y1="8.5" x2="11" y2="12" />
    <line x1="15" y1="8.5" x2="15" y2="12" />
  </svg>
);

export const IconFolder = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

export const IconPackage = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M21 7.5L12 3 3 7.5l9 4.5 9-4.5z" />
    <path d="M3 7.5v9L12 21l9-4.5v-9" />
    <line x1="12" y1="12" x2="12" y2="21" />
  </svg>
);

export const IconSpreadsheet = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <line x1="4" y1="9.5" x2="20" y2="9.5" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10.5" y1="3" x2="10.5" y2="21" />
  </svg>
);

export const IconDraft = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 16l3.5-7 3 5 2.5-4 2 6" />
  </svg>
);

export const IconZap = ({ size = 18, ...props }) => (
  <svg {...base(size, { fill: 'currentColor', stroke: 'none' })} {...props}>
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);

export const IconDownload = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M12 4v11.5" />
    <path d="M8 12l4 4 4-4" />
    <path d="M4 19.5h16" />
  </svg>
);

export const IconCheckCircle = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M7.8 12.5l2.6 2.6L16.3 9" />
  </svg>
);

export const IconXCircle = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </svg>
);

export const IconTrash = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
  </svg>
);

export const IconUsers = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="9" cy="8.2" r="3.2" />
    <path d="M3 20c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2" />
    <circle cx="17.5" cy="8.5" r="2.4" />
    <path d="M15.3 14c2.6.5 4.4 2.7 4.4 6" />
  </svg>
);

export const IconStar = ({ size = 18, ...props }) => (
  <svg {...base(size, { fill: 'currentColor', stroke: 'none' })} {...props}>
    <path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.9 6.4 20.1l1.4-6.3-4.8-4.3 6.4-.6L12 3z" />
  </svg>
);

export const IconBriefcase = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="3" y1="12.5" x2="21" y2="12.5" />
  </svg>
);

export const IconMapPin = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const IconSave = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M5 3h11l3 3v15H5V3z" />
    <path d="M8 3v5h8V3" />
    <rect x="8" y="13" width="8" height="6" />
  </svg>
);

export const IconEdit = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M4 20h4l10.5-10.5-4-4L4 16v4z" />
    <line x1="13.5" y1="5.5" x2="17.5" y2="9.5" />
  </svg>
);

export const IconMap = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z" />
    <line x1="9" y1="4" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="20" />
  </svg>
);

export const IconLayers = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

export const IconGlobe = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="12" cy="12" r="9" />
    <ellipse cx="12" cy="12" rx="4" ry="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

export const IconChevronUp = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

export const IconChevronDown = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconChevronLeft = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconChevronRight = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconGrid = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.2" />
  </svg>
);

export const IconKey = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="7" cy="15" r="3.5" />
    <path d="M9.5 12.5L18 4" />
    <path d="M14.5 8L17 10.5" />
    <path d="M17.5 5L20 7.5" />
  </svg>
);

export const IconDatabase = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    <path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </svg>
);

export const IconPalette = ({ size = 18, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M12 3.5c-4.7 0-8.5 3.6-8.5 8 0 3 2.1 4.8 4.3 4.8.9 0 1.4-.5 1.4-1.2 0-.6-.4-.9-.4-1.6 0-.7.6-1.3 1.4-1.3h1.7c2.7 0 5.1-1.9 5.1-4.8 0-3.1-2.6-3.9-5-3.9z" />
    <circle cx="8.2" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="11.6" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15.2" cy="9.3" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSparkle = ({ size = 18, ...props }) => (
  <svg {...base(size, { fill: 'currentColor', stroke: 'none' })} {...props}>
    <path d="M12 2c.6 3.8 1.9 5.6 6 6-4.1.4-5.4 2.2-6 6-.6-3.8-1.9-5.6-6-6 4.1-.4 5.4-2.2 6-6z" />
  </svg>
);

