import ItemTool from "./ItemTool.js";

export default class ItemSword extends ItemTool {
    constructor(id, textureName, name, material) {
        super(id, textureName, name, material, 'sword');
    }
}
