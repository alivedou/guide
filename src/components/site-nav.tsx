"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  { href: "#verdict", label: "结论" },
  { href: "#pains", label: "乱在哪" },
  { href: "#current", label: "现状" },
  { href: "#target", label: "目标结构" },
  { href: "#phases", label: "阶段计划" },
  { href: "#guardrails", label: "不能动" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="#top" className="text-sm font-medium tracking-tight text-foreground">
          CF-nav <span className="text-mint">v4</span> 重构方案
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="md:hidden"
          aria-label={open ? "关闭导航" : "打开导航"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open ? (
        <nav className="border-t border-line px-4 py-2 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
