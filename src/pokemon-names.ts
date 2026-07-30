import path from "node:path";
import { DATA_DIR } from "./config.js";
import { readJson } from "./io.js";
import { pokemonNamesSchema, type PokemonName } from "./types.js";

export type PokemonNameMap = ReadonlyMap<string, PokemonName>;

export async function loadPokemonNames(
  filePath = path.join(DATA_DIR, "pokemon-names.zh-TW.json"),
): Promise<PokemonNameMap> {
  const records = await readJson(filePath, pokemonNamesSchema);
  return new Map(records.map((record) => [record.english.toLocaleLowerCase("en"), record]));
}

const FORM_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["Gigantamax ", "超極巨化"],
  ["Dynamax ", "極巨化"],
  ["Mega ", "超級"],
  ["Primal ", "原始"],
  ["Alolan ", "阿羅拉的樣子"],
  ["Galarian ", "伽勒爾的樣子"],
  ["Hisuian ", "洗翠的樣子"],
  ["Paldean ", "帕底亞的樣子"],
];

export function translatePokemonName(
  english: string,
  names: PokemonNameMap,
): string | undefined {
  const clean = english.trim();
  const exact = names.get(clean.toLocaleLowerCase("en"));
  if (exact) return exact.zhTW;

  for (const [englishPrefix, zhPrefix] of FORM_PREFIXES) {
    if (clean.startsWith(englishPrefix)) {
      const base = translatePokemonName(clean.slice(englishPrefix.length), names);
      if (base) {
        return base.startsWith(zhPrefix) ? base : `${zhPrefix}${base}`;
      }
    }
  }
  return undefined;
}

export function translatePokemonList(
  english: string,
  names: PokemonNameMap,
): string | undefined {
  const parts = english.split(/\s*(?:,| and | & )\s*/u).filter(Boolean);
  if (parts.length === 0) return undefined;
  const translated = parts.map((part) => translatePokemonName(part, names));
  if (translated.some((part) => part === undefined)) return undefined;
  return translated.join("、");
}
