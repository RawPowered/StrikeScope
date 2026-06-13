# Quick Build & Verify Commands

```powershell
# Build shared types first
npm run build -w shared

# TypeScript check server
npx tsc --noEmit -p packages/server/tsconfig.json

# Build admin frontend
npm run build -w packages/admin

# Build installer frontend
npm run build -w packages/installer

# Build monitor frontend
npm run build -w packages/monitor

# Full build (all packages)
npm run build -w shared; if ($?) { npx tsc --noEmit -p packages/server/tsconfig.json }; if ($?) { npm run build -w packages/admin }
```
