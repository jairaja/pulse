module.exports = ({ config: initial }) => {
  const origin = process.env.EXPO_PUBLIC_SHARE_ORIGIN;
  const config = { ...initial };
  if (!origin) return config;
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('EXPO_PUBLIC_SHARE_ORIGIN must be an HTTPS origin.');
  config.ios = { ...config.ios, associatedDomains: [`applinks:${url.hostname}`] };
  config.android = { ...config.android, intentFilters: [{ action: 'VIEW', autoVerify: true,
    data: [{ scheme: 'https', host: url.hostname, pathPrefix: '/q/' }], category: ['BROWSABLE', 'DEFAULT'] }] };
  return config;
};
