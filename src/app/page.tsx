import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { SiteNav } from "@/components/site-nav";
import {
  SOURCE_BRANCH,
  SOURCE_REPO,
  apiParity,
  baselineCases,
  currentTree,
  features,
  frontendSplit,
  gateRule,
  guardrails,
  mapping,
  pains,
  phases,
  stats,
  targetTree,
  testCommands,
  testProjectTree,
  testStrategy,
  verdict,
} from "@/data/plan";
import {
  ArrowRight,
  ClipboardCheck,
  GitBranch,
  Layers,
  ShieldAlert,
  SplitSquareVertical,
} from "lucide-react";

function severityTone(level: "高" | "中" | "低") {
  if (level === "高") return "bg-[#f07167]/15 text-[#f07167] ring-[#f07167]/25";
  if (level === "中") return "bg-amber/15 text-amber ring-amber/25";
  return "bg-muted text-muted-foreground ring-border";
}

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="top" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-10 sm:px-6 sm:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                基于 {SOURCE_BRANCH} 分支实读
              </Badge>
              <Badge variant="outline" className="font-normal">
                功能全部保留
              </Badge>
              <Badge variant="outline" className="font-normal">
                不换成 React
              </Badge>
              <Badge variant="outline" className="font-normal">
                每阶段带测试与验收
              </Badge>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              结构乱在「写了两遍」和几个上帝文件，不在缺一个新框架。
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              这是对
              <a
                className="mx-1 text-mint underline-offset-4 hover:underline"
                href={SOURCE_REPO}
                target="_blank"
                rel="noreferrer"
              >
                alivedou/CF-nav
              </a>
              <span className="font-mono text-sm"> v4 </span>
              的结构诊断和分阶段重构方案。导航站本体继续走 Vanilla JS + Cloudflare Pages / Docker 双部署；本页只是方案说明书。
            </p>
          </div>
          <Card className="bg-panel/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-mint">
                <GitBranch className="size-4" />
                怎么用这份方案
              </CardTitle>
              <CardDescription>
                回到 CF-nav 仓库按阶段 0 → 6 做。每阶段可独立合并，上一阶段没做完不要跳。
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              完整 Markdown 在仓库 <span className="font-mono text-foreground">docs/REFACTORING.md</span>
              ，可直接贴进 v4 当维护文档。
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <Card key={s.label} size="sm" className="bg-panel/70">
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="font-mono text-lg text-mint">{s.value}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">{s.hint}</CardContent>
            </Card>
          ))}
        </section>

        <section id="verdict" className="scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2 text-mint">
            <Layers className="size-4" />
            <h2 className="text-xl font-semibold sm:text-2xl">{verdict.title}</h2>
          </div>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">{verdict.body}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Card size="sm">
              <CardHeader>
                <CardTitle>保留</CardTitle>
                <CardDescription>
                  全部现有功能、API 路径、绑定名 nav/DB、Docker 镜像契约、无打包前端。
                </CardDescription>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>改变</CardTitle>
                <CardDescription>
                  共享领域层进 nav-main/shared；server.js / app.js / style.css 按职责拆文件。
                </CardDescription>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>明确不做</CardTitle>
                <CardDescription>
                  不用 Next/React 重写导航站，不改 Pages Root，不统一 KV 键名，不挪 ikun.sh。
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <Separator />

        <section id="pains" className="scroll-mt-24 space-y-6">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">乱在哪</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              目录看起来「有分层」，实际是部署需要把 Pages 塞进 nav-main。真正的耦合是双运行时拷贝，以及前端靠脚本顺序和 window 全局粘在一起。
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {pains.map((p) => (
              <Card key={p.id} className="bg-panel/60">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ${severityTone(p.severity)}`}
                    >
                      {p.severity}
                    </span>
                  </div>
                  <CardDescription className="font-mono text-xs">{p.where}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6">
                  <p>{p.problem}</p>
                  <p className="text-mint">{p.keep}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="current" className="scroll-mt-24 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold sm:text-2xl">现在的结构</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              两套几乎同构的 API：左边 Express 一个大文件，右边 Pages Functions 按文件分路由。前端无打包，但 app.js 把启动到渲染全包了。
            </p>
            <Card>
              <CardContent className="pt-4">
                <pre className="tree-block">{currentTree}</pre>
              </CardContent>
            </Card>
          </div>
          <div id="target" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-semibold sm:text-2xl">目标结构</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              关键约束：Cloudflare Pages 读不到 nav-main 外面的文件。所以共享层必须放在 nav-main/shared，Node 再 import 它——这正是现在 defaultData.js 的做法。
            </p>
            <Card>
              <CardContent className="pt-4">
                <pre className="tree-block">{targetTree}</pre>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">文件怎么搬家</h2>
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">现在</th>
                  <th className="px-4 py-3 font-medium">搬到</th>
                  <th className="px-4 py-3 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((row) => (
                  <tr key={row.from} className="border-t border-line">
                    <td className="px-4 py-3 font-mono text-xs text-amber">{row.from}</td>
                    <td className="px-4 py-3 font-mono text-xs text-mint">{row.to}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold sm:text-2xl">前端拆分对照</h2>
          <p className="text-sm text-muted-foreground">
            从现有 app.js 函数块直接切，不重新设计状态管理。第一轮继续挂到 window，第二轮再改成纯 import。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {frontendSplit.map((f) => (
              <div
                key={f.file}
                className="flex items-start gap-3 rounded-xl bg-panel/70 px-4 py-3 ring-1 ring-foreground/10"
              >
                <code className="shrink-0 pt-0.5 font-mono text-xs text-mint">{f.file}</code>
                <span className="text-sm text-muted-foreground">{f.take}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="phases" className="scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2">
            <SplitSquareVertical className="size-5 text-mint" />
            <h2 className="text-xl font-semibold sm:text-2xl">分阶段计划</h2>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            每一阶段都带测试文件和验收标准。阶段测试没绿，不准进下一阶段。先看下面的「测试与验收」。
          </p>
          <Accordion multiple defaultValue={["p0"]}>
            {phases.map((phase) => (
              <AccordionItem key={phase.id} value={phase.id}>
                <AccordionTrigger>
                  <span className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-center sm:gap-3">
                    <span>{phase.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      风险 {phase.risk} · {phase.goal}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs tracking-wide text-mint uppercase">做什么</p>
                      <ul className="space-y-1.5 text-sm leading-6">
                        {phase.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-xs tracking-wide text-amber uppercase">这阶段别做</p>
                      <ul className="space-y-1.5 text-sm leading-6 text-muted-foreground">
                        {phase.notThisPhase.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg bg-muted/40 p-3">
                    <p className="mb-2 text-xs tracking-wide text-mint uppercase">本阶段测试文件</p>
                    <ul className="flex flex-col gap-1 font-mono text-xs text-amber">
                      {phase.testFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <p className="mb-2 text-xs tracking-wide text-mint uppercase">用例</p>
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-3 font-medium">ID</th>
                          <th className="py-1 pr-3 font-medium">测什么</th>
                          <th className="py-1 pr-3 font-medium">怎么测</th>
                          <th className="py-1 font-medium">期望</th>
                        </tr>
                      </thead>
                      <tbody>
                        {phase.testCases.map((c) => (
                          <tr key={c.id} className="border-t border-line align-top">
                            <td className="py-2 pr-3 font-mono text-xs text-mint">{c.id}</td>
                            <td className="py-2 pr-3">{c.name}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{c.how}</td>
                            <td className="py-2 text-muted-foreground">{c.expect}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4">
                    <p className="mb-2 text-xs tracking-wide text-mint uppercase">验收标准（全满足才算过）</p>
                    <ul className="space-y-1.5 text-sm leading-6">
                      {phase.accept.map((s) => (
                        <li key={s}>☐ {s}</li>
                      ))}
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section id="testing" className="scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-mint" />
            <h2 className="text-xl font-semibold sm:text-2xl">{testStrategy.title}</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{testStrategy.body}</p>

          <div className="grid gap-3 md:grid-cols-2">
            {gateRule.map((g) => (
              <Card key={g} size="sm" className="bg-panel/70">
                <CardContent className="pt-4 text-sm leading-6">{g}</CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">测试项目目录（加在 CF-nav 里）</h3>
              <p className="text-sm text-muted-foreground">
                用 Node 22 自带 <span className="font-mono text-foreground">node --test</span>
                ，不另上 Jest。阶段 4 才加 Playwright。完整说明见
                <span className="font-mono text-foreground"> docs/TESTING.md</span>。
              </p>
              <Card>
                <CardContent className="pt-4">
                  <pre className="tree-block">{testProjectTree}</pre>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">命令与何时跑</h3>
              <div className="space-y-2">
                {testCommands.map((c) => (
                  <Card key={c.cmd} size="sm">
                    <CardHeader>
                      <CardTitle className="font-mono text-sm text-mint">{c.cmd}</CardTitle>
                      <CardDescription>{c.when}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">阶段 B · 基线契约（每阶段合并前必跑）</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              在改第一行业务代码之前，对当前 v4 打 HTTP 快照。编号沿用仓库里已有的 TESTING-REPORT（A-1…），并补上配额和导入导出。时间字段用正则忽略。
            </p>
            <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">用例</th>
                    <th className="px-4 py-3 font-medium">通过标准</th>
                  </tr>
                </thead>
                <tbody>
                  {baselineCases.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-4 py-2.5 font-mono text-xs text-mint">{c.id}</td>
                      <td className="px-4 py-2.5">{c.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.expect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold sm:text-2xl">功能清单（必须原样留下）</h2>
            <div className="grid gap-3">
              {features.map((g) => (
                <Card key={g.group} size="sm">
                  <CardHeader>
                    <CardTitle className="text-sm">{g.group}</CardTitle>
                    <CardDescription>{g.items.join(" · ")}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold sm:text-2xl">API 对等表</h2>
            <p className="text-sm text-muted-foreground">
              改内部文件可以，路径和语义不能变。Functions 与 Node 必须始终对等。
            </p>
            <Card>
              <CardContent className="pt-4">
                <ul className="space-y-2 font-mono text-xs leading-6 text-mint">
                  {apiParity.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-amber" />
                      {p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="guardrails" className="scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber" />
            <h2 className="text-xl font-semibold sm:text-2xl">这些动了就会伤用户</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {guardrails.map((g) => (
              <Card key={g.title} className="bg-panel/70">
                <CardHeader>
                  <CardTitle className="text-base">{g.title}</CardTitle>
                  <CardDescription className="leading-6">{g.detail}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-panel px-5 py-8 ring-1 ring-foreground/10 sm:px-8">
          <h2 className="text-xl font-semibold">建议的开工顺序</h2>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">0. 先做阶段 B：冻结基线。</span>
              在 CF-nav 里加上 tests/，对现网行为打快照。没有这份快照，后面的「没坏」无法证明。
            </li>
            <li>
              <span className="font-medium text-foreground">1. 阶段 0 + 1，测试跟着合。</span>
              卫生清理和共享层。P1 的配额单测和「只有一份 QUOTA_CONFIG」扫描是硬门槛。
            </li>
            <li>
              <span className="font-medium text-foreground">2. 拆 server.js（阶段 2）。</span>
              路由表对照 + 契约零 diff。Docker COPY 要测，不只是文档里写一句。
            </li>
            <li>
              <span className="font-medium text-foreground">3. /api/config 试点阶段 3。</span>
              开始强制 test:dual。id 重映射和超配额必须单测，不能只手工点保存。
            </li>
            <li>
              <span className="font-medium text-foreground">4. 前端拆分必须带 Playwright。</span>
              搜索首字符、引擎刷新是历史回归点。升 CACHE_NAME。CSS 阶段才比截图。
            </li>
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">
              落地时从阶段 B 的测试脚手架开始。施工单见 docs/REFACTORING.md，测试项目见 docs/TESTING.md。不要把导航站迁到本 Next 项目里。
          </p>
        </section>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted-foreground">
        方案基于 {SOURCE_REPO} 的 {SOURCE_BRANCH} 分支阅读，不修改该仓库。
      </footer>
    </>
  );
}
