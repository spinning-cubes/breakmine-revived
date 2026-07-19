import CraftingRecipe from "./CraftingRecipe.js";

export default class ShapedCraftingRecipe extends CraftingRecipe {
    constructor(resultTypeId, resultCount = 1, width, height, ingredients) {
        super(resultTypeId, resultCount);
        this.width = width;
        this.height = height;
        this.ingredients = Array.isArray(ingredients) ? ingredients : [];
    }

    matches(gridItems, width, height) {
        if (this.width !== width || this.height !== height) {
            return false;
        }

        const normalized = (gridItems || []).map((item) => this.getItemTypeId(item));
        if (normalized.length < this.ingredients.length) {
            return false;
        }

        for (let index = 0; index < this.ingredients.length; index++) {
            const expected = this.ingredients[index];
            const actual = normalized[index];
            if (expected === 0) {
                if (actual !== 0) {
                    return false;
                }
            } else if (expected !== actual) {
                return false;
            }
        }

        return true;
    }

    getItemTypeId(item) {
        if (!item) {
            return 0;
        }
        if (typeof item === 'number') {
            return item;
        }
        if (typeof item === 'object') {
            if (typeof item.isEmpty === 'function' && item.isEmpty()) {
                return 0;
            }
            if (typeof item.getType === 'function') {
                return item.getType();
            }
            if (item.typeId !== undefined) {
                return item.typeId;
            }
        }
        return 0;
    }
}
