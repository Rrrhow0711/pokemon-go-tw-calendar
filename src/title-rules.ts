import type { PokemonNameMap } from "./pokemon-names.js";
import { translatePokemonList, translatePokemonName } from "./pokemon-names.js";

const MONTHS: Readonly<Record<string, string>> = {
  January: "1月",
  February: "2月",
  March: "3月",
  April: "4月",
  May: "5月",
  June: "6月",
  July: "7月",
  August: "8月",
  September: "9月",
  October: "10月",
  November: "11月",
  December: "12月",
};

export const CATEGORY_TRANSLATIONS: Readonly<Record<string, string>> = {
  "pokemon-spotlight-hour": "聚焦時刻",
  "raid-hour": "團體戰時刻",
  "raid-battles": "團體戰",
  "max-mondays": "極巨星期一",
  "max-battles": "極巨對戰",
  "community-day": "社群日",
  "go-pass": "GO Pass",
  "go-battle-league": "GO對戰聯盟",
  "pokemon-go-fest": "Pokémon GO Fest",
  event: "遊戲活動",
};

export function translateCategory(eventType: string, heading: string): string {
  return CATEGORY_TRANSLATIONS[eventType] ?? categoryFromHeading(heading);
}

function categoryFromHeading(heading: string): string {
  const known: Readonly<Record<string, string>> = {
    "Raid Battles": "團體戰",
    "Raid Hour": "團體戰時刻",
    "Community Day": "社群日",
    "Max Battles": "極巨對戰",
    "GO Battle League": "GO對戰聯盟",
    Event: "遊戲活動",
  };
  return known[heading] ?? `遊戲活動`;
}

export function translateTitleByRule(
  title: string,
  names: PokemonNameMap,
): string | undefined {
  let match = /^(.+?) Raid Hour$/u.exec(title);
  if (match?.[1]) {
    const pokemon = translatePokemonList(match[1], names);
    if (pokemon) return `${pokemon}團體戰時刻`;
  }

  match = /^(.+?) Spotlight Hour$/u.exec(title);
  if (match?.[1]) {
    const pokemon = translatePokemonName(match[1], names);
    if (pokemon) return `${pokemon}聚焦時刻`;
  }

  match = /^(.+?) in 5-star Raid Battles$/iu.exec(title);
  if (match?.[1]) {
    const pokemon = translatePokemonList(match[1], names);
    if (pokemon) return `${pokemon}五星團體戰`;
  }

  match = /^Mega (.+?) in Mega Raids$/iu.exec(title);
  if (match?.[1]) {
    const pokemon = translatePokemonName(`Mega ${match[1]}`, names);
    if (pokemon) return `${pokemon}超級團體戰`;
  }

  match = /^Dynamax (.+?) during Max Monday$/iu.exec(title);
  if (match?.[1]) {
    const pokemon = translatePokemonName(`Dynamax ${match[1]}`, names);
    if (pokemon) return `${pokemon}極巨星期一`;
  }

  match = /^Gigantamax (.+?) Max Battle Day$/iu.exec(title);
  if (match?.[1]) {
    const pokemon = translatePokemonName(`Gigantamax ${match[1]}`, names);
    if (pokemon) return `${pokemon}極巨對戰日`;
  }

  match = /^(.+?) Community Day Classic$/iu.exec(title);
  if (match?.[1]) {
    const pokemon = translatePokemonName(match[1], names);
    if (pokemon) return `${pokemon}經典社群日`;
  }

  match = /^(.+?) Community Day$/iu.exec(title);
  if (match?.[1]) {
    const pokemon = translatePokemonName(match[1], names);
    if (pokemon) return `${pokemon}社群日`;
  }

  match = /^GO Pass:\s*(\w+)$/iu.exec(title);
  if (match?.[1] && MONTHS[match[1]]) return `GO Pass：${MONTHS[match[1]]}`;

  if (title === "GO Battle League") return "GO對戰聯盟";
  return undefined;
}
