interface BrandLogoProps {
  /** Text size class, defaults to 'text-xl' */
  size?: string;
  /** Additional classes for the wrapper */
  className?: string;
}

export function BrandLogo({ size = 'text-xl', className = '' }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className={`${size} font-bold text-zinc-100 tracking-tight`}>linqoy.</span>
    </span>
  );
}
