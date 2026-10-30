"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENUS = [
  { href: "/", label: "실시간" },
  { href: "/history", label: "키워드 기록" },
  { href: "/keyword", label: "키워드 분석" },
  { href: "/drafts", label: "초안" },
  { href: "/thumbnail", label: "썸네일" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="brand">
          toolhub
        </Link>
        {MENUS.map((menu) => (
          <Link key={menu.href} href={menu.href} className={isActive(pathname, menu.href) ? "active" : undefined}>
            {menu.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
