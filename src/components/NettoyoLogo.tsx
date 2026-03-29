type NettoyoLogoProps = {
  className?: string;
};

export function NettoyoLogo({ className = '' }: NettoyoLogoProps) {
  return (
    <img
      src="/Nettoyo_logo_with_sparkles_and_bubbles.png"
      alt="Nettoyó"
      className={`block w-auto object-contain ${className}`.trim()}
    />
  );
}
