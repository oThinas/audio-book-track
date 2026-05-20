"use client";

import dynamic from "next/dynamic";

import { SectionSkeleton } from "./section-skeleton";

const RevenueChart = dynamic(() => import("./revenue-chart"), {
  ssr: false,
  loading: () => <SectionSkeleton lines={6} />,
});

export { RevenueChart };
