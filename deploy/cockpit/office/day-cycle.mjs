const localClock = new Intl.DateTimeFormat("pt-BR", {timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"});
export function saoPauloHour(date = new Date()) {
  const parts = Object.fromEntries(localClock.formatToParts(date).map(part => [part.type, part.value]));
  return Number(parts.hour) + Number(parts.minute) / 60 + Number(parts.second) / 3600;
}
export function dayPhase(hour) {
  const time = ((hour % 24) + 24) % 24;
  if (time < 5.5 || time >= 19.25) return {key: "noite", label: "Noite"};
  if (time < 11) return {key: "manha", label: "Manhã"};
  if (time < 15.5) return {key: "dia", label: "Dia"};
  if (time < 17.25) return {key: "tarde", label: "Tardezinha"};
  return {key: "sunset", label: "Pôr do sol"};
}
const night = {sky: 0x161d38, skyLight: 0x8c9bc9, groundLight: 0x66547d, sunColor: 0xaecbff, ambient: 0.95, keyLight: 0.85, warm: 14, exposure: 1.22, position: [-8, 13, -6]};
const keyframes = [
  {hour: 0, ...night}, {hour: 5, ...night},
  {hour: 7.5, sky: 0xffd8b2, skyLight: 0xffe8d0, groundLight: 0x827b9b, sunColor: 0xffd5a0, ambient: 1.85, keyLight: 2.6, warm: 1, exposure: 1.2, position: [-13, 10, 10]},
  {hour: 12, sky: 0xbce9ed, skyLight: 0xffeee4, groundLight: 0x897e9a, sunColor: 0xffeed4, ambient: 2.05, keyLight: 3.1, warm: 0, exposure: 1.2, position: [-5, 17, 7]},
  {hour: 16, sky: 0xffcfad, skyLight: 0xffd9bd, groundLight: 0x8b698a, sunColor: 0xffb778, ambient: 1.8, keyLight: 2.8, warm: 1, exposure: 1.22, position: [9, 10, 8]},
  {hour: 18.1, sky: 0xe394a0, skyLight: 0xffb4a3, groundLight: 0x725a92, sunColor: 0xff854f, ambient: 1.35, keyLight: 2.1, warm: 8, exposure: 1.2, position: [14, 5, 5]},
  {hour: 19.5, ...night}, {hour: 24, ...night},
];
export function environmentAt(hour) {
  const time = ((hour % 24) + 24) % 24;
  const index = keyframes.findIndex((entry, index) => index > 0 && time <= entry.hour);
  const from = keyframes[index - 1], to = keyframes[index];
  const progress = (time - from.hour) / (to.hour - from.hour);
  return {from, to, blend: progress * progress * (3 - 2 * progress), phase: dayPhase(time)};
}
