// A `build:cf` / `deploy:cf` előtt fut: a NEXT_PUBLIC_APP_ENV buildkor beégetődik, ezért egy gépről
// indított Cloudflare-build sem mehet ki csendben `local` módban (noindex, fixture- és webhook-őrök).
const allowed = ["preview", "demo", "production"];
const appEnv = process.env.NEXT_PUBLIC_APP_ENV;

if (!appEnv || !allowed.includes(appEnv)) {
  console.error(
    `Cloudflare-buildhez kötelező a NEXT_PUBLIC_APP_ENV (${allowed.join(" | ")}); kapott: ${appEnv ?? "nincs"}.`,
  );
  process.exit(1);
}
