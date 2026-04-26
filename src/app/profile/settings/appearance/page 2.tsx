"use client";

import { MoonStar, Palette, MonitorSmartphone } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, SmallPillButton, CompactToggle } from "../settings-ui";

export default function SettingsAppearancePage() {
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Appearance"
      description="Theme, text size and motion in a compact layout."
    >
      <div className="space-y-2">
        <SettingLine icon={Palette} title="Theme" description="Choose system, light or dark mode.">
          <div className="flex items-center gap-2">
            {(["system", "light", "dark"] as const).map((theme) => (
              <SmallPillButton
                key={theme}
                active={settings.appearance.theme === theme}
                onClick={() => void updateSection("appearance", { theme })}
              >
                {theme}
              </SmallPillButton>
            ))}
          </div>
        </SettingLine>

        <SettingLine icon={MonitorSmartphone} title="Text size" description="Keep text compact or open it up a little.">
          <div className="flex items-center gap-2">
            {(["compact", "comfortable", "large"] as const).map((size) => (
              <SmallPillButton
                key={size}
                active={settings.appearance.textSize === size}
                onClick={() => void updateSection("appearance", { textSize: size })}
              >
                {size}
              </SmallPillButton>
            ))}
          </div>
        </SettingLine>

        <SettingLine icon={MoonStar} title="Reduce motion" description="Tone down motion if you want a calmer feel.">
          <CompactToggle
            checked={settings.appearance.reduceMotion}
            onChange={(next) => void updateSection("appearance", { reduceMotion: next })}
            label={settings.appearance.reduceMotion ? "On" : "Off"}
          />
        </SettingLine>
      </div>
    </SettingsPageFrame>
  );
}
