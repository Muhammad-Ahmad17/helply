import type { SimpleIcon } from "simple-icons";
import {
  siNotion,
  siNextdotjs,
  siShopify,
  siStripe,
  siWebflow,
  siWordpress,
} from "simple-icons";

type BrandLogoProps = {
  icon: SimpleIcon;
  className?: string;
};

export function BrandLogo({ icon, className }: BrandLogoProps) {
  return (
    <svg
      className={className}
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label={icon.title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
}

export const BRAND_LOGOS = [
  { name: "WordPress", icon: siWordpress },
  { name: "Shopify", icon: siShopify },
  { name: "Webflow", icon: siWebflow },
  { name: "Next.js", icon: siNextdotjs },
  { name: "Stripe", icon: siStripe },
  { name: "Notion", icon: siNotion },
] as const;
