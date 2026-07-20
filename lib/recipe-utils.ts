import type { Recipe, Ingredient, RecipeIngredient } from './types';

export interface IngredientStatus {
  name: string;
  qtyNeeded: number;
  qtyHave: number;
  unit: string;
  isEnough: boolean;
  section: 'main' | 'seasoning';
  optional?: boolean;
}

export interface RecipeAnalysis {
  isCookable: boolean;
  ingredientsStatus: IngredientStatus[];
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function analyzeRecipe(recipe: Recipe, pantry: Ingredient[]): RecipeAnalysis {
  const statusList: IngredientStatus[] = [];
  let isCookable = true;

  // 組合庫存：同名食材數量加總
  const stockMap = new Map<string, number>();
  for (const i of pantry) {
    if (i.quantity > 0) {
      const norm = normalizeName(i.name);
      stockMap.set(norm, (stockMap.get(norm) || 0) + (Number(i.quantity) || 0));
    }
  }

  const checkSection = (items: RecipeIngredient[], section: 'main' | 'seasoning') => {
    for (const req of items) {
      // 支援斜線命名法 (例如: 牛肋條/牛腱肉、醬油|膏)
      const alternatives = req.name.split(/[/|、]/).map(n => normalizeName(n)).filter(Boolean);
      
      let have = 0;
      for (const alt of alternatives) {
        have += stockMap.get(alt) || 0;
      }
      
      const needed = Number(req.quantity) || 0;
      
      // 尋找庫存中對應的食材，並比對其單位是否不一致
      const match = pantry.find(i => alternatives.includes(normalizeName(i.name)));
      const isUnitMismatch = !!(match && match.unit && req.unit && normalizeName(match.unit) !== normalizeName(req.unit));

      const isEnough = (section === 'seasoning' || isUnitMismatch)
        ? (have > 0 || !!req.optional)
        : (have >= needed || !!req.optional);

      if (!isEnough && !req.optional && section === 'main') {
        isCookable = false; // 只有主食材且非 optional 不夠時，才算無法煮
      }

      statusList.push({
        name: req.name,
        qtyNeeded: needed,
        qtyHave: have,
        unit: req.unit || '',
        isEnough,
        section,
        optional: req.optional
      });
    }
  };

  checkSection(recipe.ingredients_main || [], 'main');
  checkSection(recipe.seasonings || [], 'seasoning');

  return {
    isCookable,
    ingredientsStatus: statusList
  };
}
