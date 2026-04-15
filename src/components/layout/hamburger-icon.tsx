interface HamburgerIconProps {
  readonly isOpen: boolean;
}

export function HamburgerIcon({ isOpen }: HamburgerIconProps) {
  return (
    <div className="relative flex h-5 w-5 flex-col items-center justify-center">
      {/* Top bar — rotates +45deg to form \ of X */}
      <span
        className="absolute h-0.5 w-4 bg-current transition-transform duration-150 ease-in-out motion-reduce:transition-none"
        style={{
          transform: isOpen ? "rotate(45deg)" : "translateY(-6px)",
        }}
      />
      {/* Middle bar — fades out */}
      <span
        className="absolute h-0.5 w-4 bg-current transition-opacity duration-150 ease-in-out motion-reduce:transition-none"
        style={{
          opacity: isOpen ? 0 : 1,
        }}
      />
      {/* Bottom bar — rotates -45deg to form / of X */}
      <span
        className="absolute h-0.5 w-4 bg-current transition-transform duration-150 ease-in-out motion-reduce:transition-none"
        style={{
          transform: isOpen ? "rotate(-45deg)" : "translateY(6px)",
        }}
      />
    </div>
  );
}
