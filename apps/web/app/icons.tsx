/** 16px 선 아이콘 모음 (외부 라이브러리 없이 인라인 SVG) */

const paths = {
  today: <><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /><circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" /></>,
  week: <><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3M5 9.5h6M5 11.5h4" /></>,
  inbox: <><path d="M2.5 9.5 4 3.5h8l1.5 6v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" /><path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" /></>,
  list: <><path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8" /><circle cx="3" cy="4.5" r=".8" fill="currentColor" /><circle cx="3" cy="8" r=".8" fill="currentColor" /><circle cx="3" cy="11.5" r=".8" fill="currentColor" /></>,
  done: <><circle cx="8" cy="8" r="5.5" /><path d="m5.5 8.2 1.7 1.7 3.3-3.6" /></>,
  board: <><rect x="2.5" y="2.5" width="3.2" height="11" rx="1" /><rect x="6.4" y="2.5" width="3.2" height="7" rx="1" /><rect x="10.3" y="2.5" width="3.2" height="9" rx="1" /></>,
  calendar: <><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3M6 6.5v7M10 6.5v7M2.5 10h11" /></>,
  live: <path d="M2 8.5h2.5L6 4.5l3 8 1.5-4H14" />,
  history: <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></>,
  search: <><circle cx="7" cy="7" r="4" /><path d="m10 10 3.5 3.5" /></>,
  file: <><path d="M4 2.5h5l3 3v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" /><path d="M9 2.5v3h3M5.5 8.5h5M5.5 11h3.5" /></>,
  image: <><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><circle cx="6" cy="6.5" r="1.2" /><path d="m2.5 11.5 3.5-3 3 2.5 2-1.5 2.5 2" /></>,
  plus: <path d="M8 3v10M3 8h10" />,
  hash: <path d="M6 2.5 5 13.5M11 2.5l-1 11M3 6h10.5M2.5 10H13" />,
  repeat: <><path d="M3 7V6a2 2 0 0 1 2-2h7l-2-2M13 9v1a2 2 0 0 1-2 2H4l2 2" /></>,
  link: <><path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.7.7" /><path d="M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.7-.7" /></>,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  trash: <><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.7-8.5" /></>,
  chevronLeft: <path d="m10 3.5-4.5 4.5 4.5 4.5" />,
  chevronRight: <path d="m6 3.5 4.5 4.5L6 12.5" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  checklist: <><path d="m2.5 4.5 1 1 2-2M2.5 10.5l1 1 2-2" /><path d="M7.5 4.5h6M7.5 10.5h6" /></>,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
