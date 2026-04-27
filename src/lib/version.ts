// Version is read from package.json at build time. The standalone bundle
// inlines this so no filesystem reads happen at runtime.
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
