export function haptic(type: "light" | "medium" | "heavy" = "light") {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const durations = { light: 10, medium: 30, heavy: 60 };
    navigator.vibrate(durations[type]);
  }
}
