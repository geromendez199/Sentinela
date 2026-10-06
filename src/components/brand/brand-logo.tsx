import Image from 'next/image';

/** The supplied square artwork is centered in a compact black wordmark frame. */
export function BrandLogo() {
  return (
    <span className="relative inline-block h-11 w-[180px] shrink-0 overflow-hidden rounded bg-black align-middle">
      <Image
        src="/sentinela.svg"
        alt="sentinela"
        width={252}
        height={252}
        unoptimized
        className="absolute left-1/2 top-1/2 h-[252px] w-[252px] max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}
