import { beforeAll, describe, expect, it } from "vitest";
import { loadPokemonNames, translatePokemonName, type PokemonNameMap } from "../src/pokemon-names.js";
import { translateTitleByRule } from "../src/title-rules.js";

let names: PokemonNameMap;
beforeAll(async () => {
  names = await loadPokemonNames();
});

describe("固定活動翻譯規則", () => {
  it.each([
    ["Kyurem Raid Hour", "酋雷姆團體戰時刻"],
    ["Bidoof Spotlight Hour", "大牙狸聚焦時刻"],
    ["Solgaleo in 5-star Raid Battles", "索爾迦雷歐五星團體戰"],
    ["Mega Salamence in Mega Raids", "超級暴飛龍超級團體戰"],
    ["Dynamax Feebas during Max Monday", "極巨化醜醜魚極巨星期一"],
    ["Gigantamax Rillaboom Max Battle Day", "超極巨化轟擂金剛猩極巨對戰日"],
    ["Nickit Community Day", "偷兒狐社群日"],
    ["Eevee Community Day Classic", "伊布經典社群日"],
    ["GO Pass: July", "GO Pass：7月"],
  ])("%s → %s", (english, expected) => {
    expect(translateTitleByRule(english, names)).toBe(expected);
  });

  it("型態前綴不重複", () => {
    expect(translatePokemonName("Mega Salamence", names)).toBe("超級暴飛龍");
    expect(translateTitleByRule("Mega Salamence in Mega Raids", names)).not.toContain(
      "超級超級",
    );
  });

  it("找不到正式名稱時不捏造", () => {
    expect(translatePokemonName("DefinitelyNotAPokemon", names)).toBeUndefined();
  });
});
