const CHANNEL_COLORS: Record<string, string> = {
  email: "#4F86D9",
  linkedin: "#2FA7A0",
  facebook: "#E46F61",
  offsite: "#8A70C9",
};

const FALLBACK = ["#F9D45C", "#98D9D9", "#88BF4D", "#EF8C8C"];

export function channelColor(channel: string, index: number): string {
  return CHANNEL_COLORS[channel.trim().toLowerCase()] ?? FALLBACK[index % FALLBACK.length];
}
