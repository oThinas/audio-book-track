// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("renders with the animate-pulse class", () => {
    const { container } = render(<Skeleton />);

    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton.className).toContain("animate-pulse");
  });

  it("renders with the motion-reduce:animate-none class", () => {
    const { container } = render(<Skeleton />);

    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton.className).toContain("motion-reduce:animate-none");
  });
});
