"use client";
import { CaregiverRouteError, type ErrorProps } from "@/components/RouteError";

export default function CaregiverError(props: ErrorProps) {
  return <CaregiverRouteError {...props} />;
}
