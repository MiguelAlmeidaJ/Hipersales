export const webPortalUrl = (process.env.EXPO_PUBLIC_WEB_URL || "https://web.hipersalesweb.com.br").replace(/\/$/, "");

export function webModuleUrl(slug: string): string {
  return `${webPortalUrl}/app/${slug.replace(/^\/+|\/+$/g, "")}`;
}
