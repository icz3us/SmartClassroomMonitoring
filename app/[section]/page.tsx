import { notFound } from "next/navigation";
import { MonitorApp } from "@/components/monitor-app";
const sections = [
  "analytics",
  "motion",
  "alerts",
  "device",
  "settings",
  "login",
];
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <MonitorApp page={section} />;
}
