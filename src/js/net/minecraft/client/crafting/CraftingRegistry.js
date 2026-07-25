import ItemStack from "../item/ItemStack.js";
import { BlockRegistry } from "../world/block/BlockRegistry.js";
import ShapedCraftingRecipe from "./recipe/ShapedCraftingRecipe.js";
import ShapelessCraftingRecipe from "./recipe/ShapelessCraftingRecipe.js";

export default class CraftingRegistry {
    static recipes = [];

    static reset() {
        this.recipes = [];
        this.registerAllRecipes();
    }

    static registerRecipe(recipeInstance) {
        if (recipeInstance && typeof recipeInstance.matches === 'function') {
            this.recipes.push(recipeInstance);
        }
    }

    static registerAllRecipes() {
        this.registerShapelessRecipe(BlockRegistry.WOOD.id, 4, [BlockRegistry.LOG.id]);
        this.registerShapelessRecipe(BlockRegistry.SPRUCE_PLANKS.id, 4, [BlockRegistry.SPRUCE_LOG.id]);
        this.registerShapelessRecipe(BlockRegistry.BIRCH_PLANKS.id, 4, [BlockRegistry.BIRCH_LOG.id]);
        this.registerShapelessRecipe(BlockRegistry.JUNGLE_PLANKS.id, 4, [BlockRegistry.JUNGLE_LOG.id]);
        this.registerShapelessRecipe(BlockRegistry.ACACIA_PLANKS.id, 4, [BlockRegistry.ACACIA_LOG.id]);
        this.registerShapedRecipe(BlockRegistry.CRAFTING_TABLE.id, 1, 2, 2, [BlockRegistry.WOOD.id, BlockRegistry.WOOD.id, BlockRegistry.WOOD.id, BlockRegistry.WOOD.id]);
    }

    static registerShapedRecipe(resultTypeId, resultCount = 1, width, height, shape) {
        const normalizedIngredients = [];
        for (const row of shape) {
            if (Array.isArray(row)) {
                normalizedIngredients.push(...row);
            } else {
                normalizedIngredients.push(row);
            }
        }

        const recipe = new ShapedCraftingRecipe(resultTypeId, resultCount, width, height, normalizedIngredients);
        this.registerRecipe(recipe);
    }

    static registerShapelessRecipe(resultTypeId, resultCount = 1, ingredients) {
        const normalizedIngredients = Array.isArray(ingredients) ? ingredients : [];
        const recipe = new ShapelessCraftingRecipe(resultTypeId, resultCount, normalizedIngredients);
        this.registerRecipe(recipe);
    }

    static getCraftResult(gridItems, width, height) {
        const slots = Array.isArray(gridItems) ? gridItems : [];
        const recipe = this.findRecipe(slots, width, height);
        
        if (!recipe) {
            return null;
        }

        return recipe.matches(gridItems, width, height) ? recipe.getResult() : null;
    }

    static findRecipe(gridItems, width, height) {
        for (const recipe of this.recipes) {
            if (recipe.matches(gridItems, width, height)) {
                return recipe;
            }
        }
        return null;
    }
}