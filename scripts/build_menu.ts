/**
 * A utiltity that reads some of the mods configs and creates a menu schedule
 * to be used by the daily reset controller. Uses brute-force random iteration
 * to conform the menu to a set of rules and restrictions.
 */

import { parse, stringify } from "https://deno.land/std@0.151.0/encoding/yaml.ts";
import * as path from "https://deno.land/std@0.151.0/path/mod.ts";

const __dirname = path.dirname(path.fromFileUrl(Deno.mainModule));
const configPath = path.resolve(__dirname, "../src/config");

interface DailyProductConfig {
  DailyProductExchange: {
    Index: number;
    IngredientConflicts: string[];
    Delivery: {
      Product: string;
    };
    Dialog: Record<string, unknown>;
  }[];
}

enum IngredientMarketTypes {
  Creature = "Creature",
  Plant = "Plant",
  Meat = "Meat",
}

interface IngredientMarketConfig {
  IngredientMarket: {
    [key in IngredientMarketTypes]: {
      ID: string;
      Index: number;
      NameLower: string;
    }[];
  };
}

/*
function* cartesianIterator<T>(items: T[][]): Generator<T[]> {
  const remainder = items.length > 1 ? cartesianIterator(items.slice(1)) : [[]];
  for (const r of remainder) {
    for (const h of items.at(0)!) {
      yield [h, ...r];
    }
  }
}

// get values:
const cartesian = <T>(items: T[][]) => [...cartesianIterator(items)];
*/

function shuffle(a: unknown[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function compareArray(a: string[], b: string[], checkRecip = true, otherTest?: string[][]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    // same position
    if (a[i] === b[i]) {
      return true;
    }

    for (let x = 0; x < a.length; x++) {
      // duplicate match
      if (x !== i && a[x] === a[i] && b[x] === b[i]) {
        return true;
      }

      // reciprocated match
      if (checkRecip) {
        if (b[x] === a[i] && b[i] === a[x]) {
          return true;
        }
      }
    }

    if (otherTest) {
      const nameA = a[i].split("_")[2];
      const nameB = b[i].split("_")[2];
      const nameC = otherTest[0][i].split("_")[2];
      const nameD = otherTest[1][i].split("_")[2];
      // console.log(nameA, nameB, nameC, nameD);
      if (nameA === nameC || nameA === nameD || nameB === nameC || nameB === nameD) {
        return true;
      }
    }
  }

  return false;
}

function makeShuffledWithLength(list: string[], len: number): string[] {
  let base = [...shuffle(list) as string[]];
  while (base.length <= len) {
    base = [...base, ...shuffle(list) as string[]];
  }

  return base.slice(0, len);
}

function createPairings(listA: string[], listB: string[], checkRecip = true, otherTest?: string[][]) {
  const _listA = [...listA];
  const _listB = [...listB];
  while (compareArray(_listA, _listB, checkRecip, otherTest)) {
    shuffle(_listA);
    shuffle(_listB);
  }

  return [_listA, _listB];
}

function createEconomyModifiers(table: string[][], modifiersIndex: string[], modifiers: string[]) {
  const matchModifier = (m: string[]) => m.map((v, i) => table[modifiersIndex.indexOf(v)][i]);
  const onlyUnique = (m: string[]) => m.filter((v, i, a) => a.indexOf(v) === i);

  const _listA = [...modifiers];
  let _listB = matchModifier(_listA);
  while (compareArray(_listA, _listB) && onlyUnique(_listB).length !== _listB.length) {
    shuffle(_listA);
    _listB = matchModifier(_listA);
  }

  return [_listA, _listB];
}

function createFavePairings(table: string[][], faveList: string[], exchange: DailyProductConfig) {
  shuffle(faveList);
  let isValid = false;
  while (!isValid) {
    isValid = true;
    shuffle(faveList);

    for (let i = 0; i < faveList.length; i++) {
      const fave = faveList[i];
      const entry = exchange.DailyProductExchange.find((f) => f.Delivery.Product === fave);
      if (entry && entry.IngredientConflicts) {
        for (const conflict of entry.IngredientConflicts) {
          for (const t of table) {
            if (t[i] === conflict) {
              isValid = false;
            }
          }
        }
      }
    }
  }

  return faveList;
}

(async () => {
  const ScenarioCount = 24;
  const dailyProductExchange = parse(
    await Deno.readTextFile(path.resolve(configPath, "daily_product_exchange.yml")),
  ) as DailyProductConfig;

  const ingredientMarket = parse(
    await Deno.readTextFile(path.resolve(configPath, "ingredient_market.yml")),
  ) as IngredientMarketConfig;

  const mealFavorite = dailyProductExchange.DailyProductExchange.map((r) => r.Delivery.Product);
  const ingCreature = ingredientMarket.IngredientMarket.Creature.map((r) => r.ID);
  const ingPlant = ingredientMarket.IngredientMarket.Plant.map((r) => r.ID);
  const ingMeat = ingredientMarket.IngredientMarket.Meat.map((r) => r.ID);

  const [crSell, crBuy] = createPairings(
    makeShuffledWithLength(ingCreature, ScenarioCount),
    makeShuffledWithLength(ingCreature, ScenarioCount),
  );

  const [plSell, plBuy] = createPairings(
    makeShuffledWithLength(ingPlant, ScenarioCount),
    makeShuffledWithLength(ingPlant, ScenarioCount),
    false,
  );

  const [mtSell, mtBuy] = createPairings(
    makeShuffledWithLength(ingMeat, ScenarioCount),
    makeShuffledWithLength(ingMeat, ScenarioCount),
    true,
    [crSell, crBuy],
  );

  const marketForcesIdx = [
    "CreatureSell",
    "MeatSell",
    "PlantSell",
    "CreatureBuy",
    "MeatBuy",
    "PlantBuy",
  ];

  const [marketForces, items] = createEconomyModifiers(
    [crSell, mtSell, plSell, crBuy, mtBuy, plBuy],
    marketForcesIdx,
    makeShuffledWithLength([...marketForcesIdx], ScenarioCount),
  );

  const faveBase = makeShuffledWithLength(mealFavorite, ScenarioCount);

  const fave = createFavePairings(
    [crSell, mtSell, plSell, crBuy, mtBuy, plBuy],
    [...faveBase],
    dailyProductExchange,
  );

  const menuMatrix = {
    DailyMenuMatrix: {
      DailyFavorite: fave,
      Creature: {
        B: crBuy,
        S: crSell,
      },
      Plant: {
        B: plBuy,
        S: plSell,
      },
      Meat: {
        B: mtBuy,
        S: mtSell,
      },
      MarketForces: marketForces.map((Id, i) => {
        return {
          Id,
          SellIndex: (marketForcesIdx.indexOf(Id) > 2 ? 0 : marketForcesIdx.indexOf(Id) + 1),
          BuyIndex: (marketForcesIdx.indexOf(Id) > 2 ? marketForcesIdx.indexOf(Id) - 2 : 0),
          Item: items[i],
        };
      }),
    },
  };

  const csv = [];
  csv.push("Scenario, Favorite, CreatureBuy, CreatureSell, MeatBuy, MeatSell, PlantBuy, PlantSell, EconomySpecial");
  for (let i = 0; i < fave.length; i++) {
    csv.push(
      `${i + 1}, ${fave[i]}, ${crBuy[i]}, ${crSell[i]}, ${mtBuy[i]}, ${mtSell[i]}, ${plBuy[i]}, ${plSell[i]}, ${
        marketForces[i]
      }`,
    );
  }

  console.log(csv.join("\n"));
  await Deno.writeTextFile(path.resolve(configPath, "daily_menu_matrix.yml"), stringify(menuMatrix));
  await Deno.writeTextFile(path.resolve(configPath, "daily_menu_matrix.csv"), csv.join("\n"));
})().catch((err) => {
  throw err;
});
