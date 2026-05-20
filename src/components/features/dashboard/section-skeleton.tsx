import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SectionSkeletonProps {
  readonly lines?: number;
}

export function SectionSkeleton({ lines = 2 }: SectionSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }, (_, idx) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: static count, no reordering.
            key={idx}
            className="h-5 w-full"
          />
        ))}
      </CardContent>
    </Card>
  );
}
