import ItemStack from "../item/ItemStack.js";
import { BlockRegistry } from "../world/block/BlockRegistry.js";
import Block from "../world/block/Block.js";
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

    static registerOreRecipes() {
        const oreBlocks = ['coal', 'iron', 'gold', 'diamond', 'emerald'];
        for (const ore of oreBlocks) {
            this.registerShapedRecipe(BlockRegistry[ore.toUpperCase() + '_BLOCK'].id, 1, 3, 3, [
                BlockRegistry['ITEM_' + ore.toUpperCase()].id, BlockRegistry['ITEM_' + ore.toUpperCase()].id, BlockRegistry['ITEM_' + ore.toUpperCase()].id,
                BlockRegistry['ITEM_' + ore.toUpperCase()].id, BlockRegistry['ITEM_' + ore.toUpperCase()].id, BlockRegistry['ITEM_' + ore.toUpperCase()].id,
                BlockRegistry['ITEM_' + ore.toUpperCase()].id, BlockRegistry['ITEM_' + ore.toUpperCase()].id, BlockRegistry['ITEM_' + ore.toUpperCase()].id
            ]);
            this.registerShapelessRecipe(BlockRegistry['ITEM_' + ore.toUpperCase()].id, 9, [BlockRegistry[ore.toUpperCase() + '_BLOCK'].id]);
        }
    }

    static registerWoodRecipes() {
        const woodBlockIds = [
            BlockRegistry.WOOD.id,
            BlockRegistry.SPRUCE_PLANKS.id,
            BlockRegistry.BIRCH_PLANKS.id,
            BlockRegistry.JUNGLE_PLANKS.id,
            BlockRegistry.ACACIA_PLANKS.id
        ];
        const woodToSlab = {
            [BlockRegistry.WOOD.id]: BlockRegistry.WOOD_SLAB.id,
            [BlockRegistry.SPRUCE_PLANKS.id]: BlockRegistry.SPRUCE_SLAB.id,
            [BlockRegistry.BIRCH_PLANKS.id]: BlockRegistry.BIRCH_SLAB.id,
            [BlockRegistry.JUNGLE_PLANKS.id]: BlockRegistry.JUNGLE_SLAB.id,
            [BlockRegistry.ACACIA_PLANKS.id]: BlockRegistry.ACACIA_SLAB.id
        };
        for (const woodBlockId of woodBlockIds) {
            this.registerShapedRecipe(BlockRegistry.CHEST.id, 1, 3, 3, [
                woodBlockId, woodBlockId, woodBlockId,
                woodBlockId, 0          , woodBlockId,
                woodBlockId, woodBlockId, woodBlockId
            ]);
            this.registerShapedRecipe(BlockRegistry.CRAFTING_TABLE.id, 1, 2, 2, [
                woodBlockId, woodBlockId,
                woodBlockId, woodBlockId
            ]);
            this.registerShapedRecipe(woodToSlab[woodBlockId], 6, 3, 1, [
                woodBlockId, woodBlockId, woodBlockId
            ]);
            this.registerShapedRecipe(BlockRegistry.ITEM_STICK.id, 4, 1, 2, [
                woodBlockId,
                woodBlockId
            ])
        }
    }

    static registerAllRecipes() {
        this.registerShapelessRecipe(BlockRegistry.WOOD.id, 4, [BlockRegistry.LOG.id]);
        this.registerShapelessRecipe(BlockRegistry.SPRUCE_PLANKS.id, 4, [BlockRegistry.SPRUCE_LOG.id]);
        this.registerShapelessRecipe(BlockRegistry.BIRCH_PLANKS.id, 4, [BlockRegistry.BIRCH_LOG.id]);
        this.registerShapelessRecipe(BlockRegistry.JUNGLE_PLANKS.id, 4, [BlockRegistry.JUNGLE_LOG.id]);
        this.registerShapelessRecipe(BlockRegistry.ACACIA_PLANKS.id, 4, [BlockRegistry.ACACIA_LOG.id]);
        this.registerShapedRecipe(BlockRegistry.TORCH.id, 4, 1, 2, [BlockRegistry.ITEM_COAL.id, BlockRegistry.ITEM_STICK.id]);
        this.registerWoodRecipes();
        this.registerOreRecipes();
        this.registerToolRecipes();
    }

    static registerToolRecipes() {
        const S = BlockRegistry.ITEM_STICK.id;
        const toolTypes = ['pickaxe', 'sword', 'shovel', 'axe', 'hoe'];
        const materials = {
            wood: BlockRegistry.WOOD.id,
            spruce: BlockRegistry.SPRUCE_PLANKS.id,
            birch: BlockRegistry.BIRCH_PLANKS.id,
            jungle: BlockRegistry.JUNGLE_PLANKS.id,
            acacia: BlockRegistry.ACACIA_PLANKS.id,
            stone: BlockRegistry.COBBLE_STONE.id,
            iron: BlockRegistry.ITEM_IRON.id,
            diamond: BlockRegistry.ITEM_DIAMOND.id,
            gold: BlockRegistry.ITEM_GOLD.id
        };
        const materialToToolType = {
            wood: 'WOOD',
            spruce: 'WOOD',
            birch: 'WOOD',
            jungle: 'WOOD',
            acacia: 'WOOD',
            stone: 'STONE',
            iron: 'IRON',
            diamond: 'DIAMOND',
            gold: 'GOLD'
        };
        const patterns = {
            pickaxe: { width: 3, height: 3, shape: [1, 1, 1, 0, 2, 0, 0, 2, 0] },
            sword: { width: 1, height: 3, shape: [1, 1, 2] },
            shovel: { width: 1, height: 3, shape: [1, 2, 2] },
            axe: { width: 2, height: 3, shape: [1, 1, 1, 2, 0, 2] },
            hoe: { width: 2, height: 3, shape: [1, 1, 0, 2, 0, 2] }
        };

        for (const [mat, matId] of Object.entries(materials)) {
            for (const type of toolTypes) {
                const toolType = materialToToolType[mat];
                const key = `${toolType}_${type.toUpperCase()}`;
                const resultId = BlockRegistry[key]?.id;
                if (!resultId) continue;
                const pattern = patterns[type];
                const shape = pattern.shape.map(i => i === 0 ? 0 : i === 1 ? matId : S);
                this.registerShapedRecipe(resultId, 1, pattern.width, pattern.height, shape);
            }
        }
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