const APP_NAME = 'Nettoy\u00F3';

export function buildPageTitle(pageLabel?: string): string {
  if (!pageLabel) {
    return APP_NAME;
  }

  return `${APP_NAME} - ${pageLabel}`;
}
