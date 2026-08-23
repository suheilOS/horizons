import { Popover } from "@base-ui/react/popover";
import { useState } from "react";
import "./UtilityDock.css";

type Theme = "light" | "dark";

type UtilityDockProps = {
  authenticated: boolean;
  theme: Theme;
  soundEnabled: boolean;
  onToggleTheme: () => void;
  onToggleSound: () => void;
};

export function UtilityDock({
  authenticated,
  theme,
  soundEnabled,
  onToggleTheme,
  onToggleSound,
}: UtilityDockProps) {
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function signOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setSignOutError(null);

    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Sign-out request failed with status ${response.status}`);
      }

      window.location.reload();
    } catch {
      setSignOutError("We could not sign you out. Try again.");
      setSigningOut(false);
    }
  }

  if (!authenticated) {
    return (
      <div className="utility-dock">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    );
  }

  return (
    <div
      className="utility-dock"
      role="group"
      aria-label="Account, display, and sound controls"
    >
      <Popover.Root
        onOpenChange={(open) => {
          if (open) {
            setCustomizationOpen(false);
          } else {
            setSignOutError(null);
          }
        }}
      >
        <Popover.Trigger
          className="utility-toggle account-trigger"
          type="button"
          aria-label="Account"
        >
          <UserIcon />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className="account-popover-positioner"
            side="inline-start"
            align="end"
            sideOffset={8}
          >
            <Popover.Popup className="account-popover">
              <Popover.Title className="account-popover__title">
                Account
              </Popover.Title>
              <Popover.Description className="account-popover__description">
                Signing out also signs you out of other Overhawl apps.
              </Popover.Description>
              {signOutError !== null && (
                <p className="account-popover__error" role="alert">
                  {signOutError}
                </p>
              )}
              <p className="visually-hidden" role="status">
                {signingOut ? "Signing out…" : ""}
              </p>
              <button
                className="account-popover__action"
                type="button"
                disabled={signingOut}
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <Popover.Root open={customizationOpen} onOpenChange={setCustomizationOpen}>
        <Popover.Trigger
          className="utility-toggle utility-launcher"
          type="button"
          aria-label={customizationOpen
            ? "Hide appearance and sound controls"
            : "Show appearance and sound controls"}
        >
          <SlidersIcon />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className="utility-options-positioner"
            side="inline-start"
            align="end"
            sideOffset={8}
          >
            <Popover.Popup className="utility-options">
              <Popover.Title className="visually-hidden">
                Appearance and sound controls
              </Popover.Title>
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

type ThemeToggleProps = {
  theme: Theme;
  onToggle: () => void;
};

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="utility-toggle theme-toggle"
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
      onClick={onToggle}
    >
      <svg className="utility-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="theme-toggle__sun" cx="12" cy="12" r="4" />
        <path
          className="theme-toggle__sun"
          d="M12 2.75v2.1M12 19.15v2.1M21.25 12h-2.1M4.85 12h-2.1M18.54 5.46l-1.49 1.49M6.95 17.05l-1.49 1.49M18.54 18.54l-1.49-1.49M6.95 6.95 5.46 5.46"
        />
        <path
          className="theme-toggle__moon"
          d="M20.25 14.65A8.1 8.1 0 0 1 9.35 3.75a8.7 8.7 0 1 0 10.9 10.9Z"
        />
      </svg>
    </button>
  );
}

type SoundToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <button
      className="utility-toggle sound-toggle"
      type="button"
      aria-label={enabled ? "Turn sounds off" : "Turn sounds on"}
      aria-pressed={enabled}
      onClick={onToggle}
    >
      <svg className="utility-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" />
        <path
          className="sound-toggle__enabled"
          d="M15 9.2a4 4 0 0 1 0 5.6M17.8 6.5a7.8 7.8 0 0 1 0 11"
        />
        <path className="sound-toggle__muted" d="m15.5 9.5 5 5m0-5-5 5" />
      </svg>
    </button>
  );
}

function SlidersIcon() {
  return (
    <svg className="utility-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="1.75" fill="var(--toggle-bg)" />
      <circle cx="16" cy="12" r="1.75" fill="var(--toggle-bg)" />
      <circle cx="10" cy="18" r="1.75" fill="var(--toggle-bg)" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="utility-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}
