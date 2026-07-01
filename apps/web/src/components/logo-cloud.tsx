import { BRAND_LOGOS, BrandLogo } from "@/components/brand-logos";

export function LogoCloud() {
  return (
    <div className="logo-cloud max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
      {BRAND_LOGOS.map(({ name, icon }) => (
        <div
          key={name}
          className="logo-cloud-item flex items-center justify-center"
          title={name}
        >
          <BrandLogo icon={icon} className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
      ))}
    </div>
  );
}
