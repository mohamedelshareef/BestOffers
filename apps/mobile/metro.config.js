// Metro config — monorepo React dedupe.
//
// In this npm-workspaces monorepo the root has its own `react@18.3.1` (hoisted from the
// admin Next.js app) while mobile pins `react@18.2.0` to match RN 0.74. Without forcing a
// single copy, the metro resolver loaded TWO React instances into the web bundle: components
// imported one, react-native-web's renderer wired the dispatcher to the other → React's hook
// dispatcher (`ReactCurrentDispatcher.current`) was null at mount → `Cannot read properties of
// null (reading 'useEffect')` in the root _layout → blank screen (SIM-HIGH-1).
//
// Fix: pin react / react-dom / react/jsx-runtime to the mobile copy for EVERY resolution so
// there is exactly one React in the graph. Minimal + stable; no app code change.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const reactPath = path.dirname(require.resolve('react/package.json', { paths: [projectRoot] }));
const reactDomPath = path.dirname(require.resolve('react-dom/package.json', { paths: [projectRoot] }));

const forced = {
  react: reactPath,
  'react-dom': reactDomPath,
  'react/jsx-runtime': path.join(reactPath, 'jsx-runtime'),
  'react/jsx-dev-runtime': path.join(reactPath, 'jsx-dev-runtime'),
};

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (Object.prototype.hasOwnProperty.call(forced, moduleName)) {
    return { type: 'sourceFile', filePath: require.resolve(forced[moduleName]) };
  }
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    // react/<subpath> → resolve under the pinned react dir
    return context.resolveRequest(
      { ...context, originModulePath: path.join(reactPath, 'index.js') },
      moduleName,
      platform,
    );
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
